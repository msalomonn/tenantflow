import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Pool,type PoolClient} from 'pg';
import {getMigrations} from 'better-auth/db/migration';
import {createApplication} from '../../apps/api/src/app.js';

const exec=promisify(execFile);
const container=`tenantflow-portability-${randomUUID()}`;
const passwords={admin:randomBytes(24).toString('hex'),migrator:randomBytes(24).toString('hex'),app:randomBytes(24).toString('hex'),auth:randomBytes(24).toString('hex')};
let port:string,started=false;
const pools:Pool[]=[];
const actor='portable-fixture-user';
const legacyOrg='980c7b7c-f6c4-43a1-ae42-c473c465ea36';
function url(database:string,user='postgres',password=passwords.admin){return `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;}
function pool(database:string,user='postgres',password=passwords.admin){const p=new Pool({connectionString:url(database,user,password),connectionTimeoutMillis:2000});pools.push(p);return p;}
function environment(database:string,adminUser='migration_operator',adminPassword=passwords.migrator){const inherited={...process.env};delete inherited.NODE_TEST_CONTEXT;return {...inherited,NODE_ENV:'test',APP_ORIGIN:'http://localhost:4310',BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),DATABASE_ADMIN_URL:url(database,adminUser,adminPassword),DATABASE_URL:url(database,'tenantflow_app',passwords.app),AUTH_DATABASE_URL:url(database,'tenantflow_auth',passwords.auth),APP_DB_PASSWORD:passwords.app,AUTH_DB_PASSWORD:passwords.auth};}
function safe(text:string){for(const password of Object.values(passwords))text=text.replaceAll(password,'[redacted]');return text;}
async function migrate(database:string,success=true){
 let output='',code=0;
 try{const r=await exec(process.execPath,['--import','tsx','scripts/migrate.ts'],{env:environment(database),timeout:60000,maxBuffer:4*1024*1024});output=r.stdout+r.stderr;}
 catch(error){const e=error as {code?:number;stdout?:string;stderr?:string};code=e.code??1;output=(e.stdout??'')+(e.stderr??'');}
 if(success)assert.equal(code,0,safe(output));else assert.notEqual(code,0,'Unsafe/failed migration unexpectedly succeeded');
 return safe(output);
}
async function context(database:string,fn:(c:PoolClient)=>Promise<void>){
 const p=pool(database,'tenantflow_app',passwords.app),c=await p.connect();
 try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[actor,legacyOrg]);await fn(c);}
 finally{await c.query('ROLLBACK');c.release();}
}
async function legacy(database:string){
 // Recreate the unchanged 001–003 schema using an ordinary migration owner.
 const p=pool(database,'migration_operator',passwords.migrator);
 for(const [name,password] of [['tenantflow_app',passwords.app],['tenantflow_auth',passwords.auth]]){
  if(!(await p.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await p.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
 }
 await p.query('CREATE SCHEMA auth; REVOKE ALL ON SCHEMA auth FROM PUBLIC; REVOKE CREATE ON SCHEMA public FROM PUBLIC;');
 const auth=new Pool({connectionString:url(database,'migration_operator',passwords.migrator),options:'-c search_path=auth'});pools.push(auth);
 await (await getMigrations({database:auth,emailAndPassword:{enabled:true}})).runMigrations();
 await p.query('GRANT USAGE ON SCHEMA auth TO tenantflow_auth; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA auth TO tenantflow_auth; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA auth TO tenantflow_auth; CREATE TABLE public.schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());');
 for(const name of (await readdir('db/migrations')).filter(n=>/^00[123]-/.test(n)).sort()){
  const sql=await readFile(`db/migrations/${name}`,'utf8');await p.query(sql);await p.query('INSERT INTO public.schema_migrations(name,sha256) VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);
 }
 const admin=pool(database);
 await admin.query('INSERT INTO auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,now(),now())',[actor,'Portable fixture','portable@example.test']);
 await admin.query('INSERT INTO app.organizations(id,name) VALUES($1,$2)',[legacyOrg,'Keep existing organization']);
 await admin.query("INSERT INTO app.memberships VALUES($1,$2,'owner')",[legacyOrg,actor]);
 await admin.query("INSERT INTO app.projects(organization_id,name,archived_at) VALUES($1,'Keep archived project',now())",[legacyOrg]);
 return admin;
}
before(async()=>{
 const compose=await readFile('compose.yaml','utf8'),image=compose.match(/image:\s*(postgres:18@sha256:[a-f0-9]+)/)?.[1];assert.ok(image);
 await exec('docker',['run','--detach','--rm','--name',container,'--env','POSTGRES_PASSWORD','--publish','127.0.0.1::5432',image],{env:{...process.env,POSTGRES_PASSWORD:passwords.admin},timeout:60000});started=true;
 port=(await exec('docker',['port',container,'5432/tcp'])).stdout.trim().split(':').at(-1)!;
 const admin=pool('postgres');let ready=false;
 for(let n=0;n<60;n++){try{await admin.query('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
 assert.ok(ready,'Disposable PostgreSQL did not become ready');
 await admin.query(`CREATE ROLE migration_operator LOGIN PASSWORD '${passwords.migrator}' CREATEROLE NOCREATEDB NOSUPERUSER NOBYPASSRLS`);
 for(const name of ['fresh','legacy','failure'])await admin.query(`CREATE DATABASE ${name} OWNER migration_operator`);
}, {timeout:90000});
after(async()=>{await Promise.allSettled(pools.map(p=>p.end()));if(started)await exec('docker',['rm','--force',container]);});

test('R01/R02/R05: fresh non-superuser migration and full authorization/concurrency suite',{timeout:150000},async()=>{
 await migrate('fresh');await migrate('fresh');
 const admin=pool('fresh');
 assert.deepEqual((await admin.query("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='migration_operator'")).rows[0],{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:true});
 const functions=(await admin.query("SELECT p.proname,r.rolname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='app' ORDER BY p.proname")).rows;
 assert.equal(functions.length,4);for(const f of functions){assert.equal(f.rolname,'tenantflow_definer');assert.equal(f.prosecdef,true);assert.deepEqual(f.proconfig,['search_path=""']);}
 const r=(await admin.query("SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='tenantflow_definer'")).rows[0];assert.ok(r);assert.ok(Object.values(r).every(v=>v===false));
 assert.equal((await admin.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='app' AND tableowner='migration_operator'")).rows[0].count,3);
 assert.equal((await admin.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity")).rows[0].count,3);
 const files=(await readdir('tests/integration')).filter(f=>f.endsWith('.test.ts')).sort().map(f=>'tests/integration/'+f);
 let result;
 try{result=await exec(process.execPath,['--import','tsx','--test','--test-reporter=spec','--test-concurrency=1',...files],{env:environment('fresh','postgres',passwords.admin),timeout:120000,maxBuffer:4*1024*1024});}
 catch(error){const e=error as {stdout?:string;stderr?:string};assert.fail(safe((e.stdout??'')+(e.stderr??'')));}
 assert.match(result.stdout,/pass 43/);assert.match(result.stdout,/fail 0/);
 console.log('Disposable non-superuser-owned schema: all 43 established integration cases passed.');
});

test('R01: legacy forced-RLS failure is repaired without losing data or old checksums',async()=>{
 const admin=await legacy('legacy');const before=(await admin.query('SELECT * FROM public.schema_migrations ORDER BY name')).rows;
 await context('legacy',async c=>{await assert.rejects(c.query("SELECT app.create_organization('Before fix')"),{code:'42501'});});
 await migrate('legacy');await migrate('legacy');
 await context('legacy',async c=>{
  assert.equal((await c.query("SELECT app.create_organization('After upgrade') AS id")).rowCount,1);
  assert.equal((await c.query('SELECT * FROM app.list_members($1)',[legacyOrg])).rows[0].user_id,actor);
  await assert.rejects(c.query("SELECT app.mutate_member($1,'remove',$2,NULL)",[legacyOrg,actor]),{code:'PT409'});
 });
 assert.deepEqual((await admin.query("SELECT * FROM public.schema_migrations WHERE name < '004' ORDER BY name")).rows,before);
 assert.equal((await admin.query('SELECT name FROM app.organizations WHERE id=$1',[legacyOrg])).rows[0].name,'Keep existing organization');
 assert.equal((await admin.query('SELECT name,archived_at FROM app.projects WHERE organization_id=$1',[legacyOrg])).rows[0].name,'Keep archived project');
 assert.ok((await admin.query('SELECT archived_at FROM app.projects WHERE organization_id=$1',[legacyOrg])).rows[0].archived_at);
});

test('R03/R04: minimal grants and unsafe role/membership fail migration and startup',async()=>{
 const admin=pool('fresh');
 for(const name of ['tenantflow_app','tenantflow_auth']){
  const p=pool('fresh',name,name==='tenantflow_app'?passwords.app:passwords.auth);
  assert.equal((await p.query("SELECT pg_has_role(current_user,'tenantflow_definer','MEMBER') AS member")).rows[0].member,false);
  await assert.rejects(p.query('SET ROLE tenantflow_definer'),{code:'42501'});
 }
 assert.equal((await admin.query("SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='app' AND a.grantee=0 AND a.privilege_type='EXECUTE'")).rows[0].count,0);
 assert.equal((await admin.query("SELECT has_function_privilege('tenantflow_app','app.require_membership_owner(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
 assert.equal((await admin.query("SELECT has_function_privilege('tenantflow_auth','app.list_members(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
 assert.equal((await admin.query("SELECT has_column_privilege('tenantflow_definer','app.organizations','id','UPDATE') AS allowed")).rows[0].allowed,false);
 const privileges=(await admin.query("SELECT has_schema_privilege('tenantflow_definer','app','CREATE') AS ddl,has_table_privilege('tenantflow_definer','app.projects','SELECT') AS projects,has_table_privilege('tenantflow_definer','auth.account','SELECT') AS passwords,has_table_privilege('tenantflow_definer','auth.session','SELECT') AS sessions,has_column_privilege('tenantflow_definer','auth.\"user\"','email','SELECT') AS email")).rows[0];assert.deepEqual(privileges,{ddl:false,projects:false,passwords:false,sessions:false,email:true});
 await admin.query('ALTER ROLE tenantflow_definer LOGIN');
 try{assert.match(await migrate('fresh',false),/Unsafe database definer role/);}finally{await admin.query('ALTER ROLE tenantflow_definer NOLOGIN');}
 await admin.query('GRANT tenantflow_definer TO tenantflow_app WITH INHERIT FALSE, SET TRUE');
 const instance=createApplication({databaseUrl:url('fresh','tenantflow_app',passwords.app),authDatabaseUrl:url('fresh','tenantflow_auth',passwords.auth),origin:'http://localhost:4310',secret:randomBytes(32).toString('hex'),production:false});
 try{await assert.rejects(instance.assertDatabaseRoles(),/Unsafe database definer/);assert.match(await migrate('fresh',false),/Unsafe database definer/);}
 finally{await instance.close();await admin.query('REVOKE tenantflow_definer FROM tenantflow_app');}
 await admin.query('CREATE ROLE portable_bridge NOLOGIN; GRANT tenantflow_definer TO portable_bridge; GRANT portable_bridge TO tenantflow_auth');
 const indirect=createApplication({databaseUrl:url('fresh','tenantflow_app',passwords.app),authDatabaseUrl:url('fresh','tenantflow_auth',passwords.auth),origin:'http://localhost:4310',secret:randomBytes(32).toString('hex'),production:false});
 try{await assert.rejects(indirect.assertDatabaseRoles(),/Unsafe database definer/);assert.match(await migrate('fresh',false),/Unsafe database definer/);}
 finally{await indirect.close();await admin.query('REVOKE portable_bridge FROM tenantflow_auth; REVOKE tenantflow_definer FROM portable_bridge; DROP ROLE portable_bridge');}
 await migrate('fresh');
});

test('R06: failed role migration rolls back ownership/grants and succeeds after repair',async()=>{
 const admin=await legacy('failure');
 await admin.query('CREATE POLICY definer_organizations_select ON app.organizations FOR SELECT TO tenantflow_app USING(false)');
 assert.match(await migrate('failure',false),/already exists/);
 assert.equal((await admin.query("SELECT count(*)::int AS count FROM public.schema_migrations WHERE name LIKE '004-%'")).rows[0].count,0);
 assert.equal((await admin.query("SELECT pg_get_userbyid(proowner) AS owner FROM pg_proc WHERE oid='app.create_organization(text)'::regprocedure")).rows[0].owner,'migration_operator');
 assert.equal((await admin.query("SELECT has_schema_privilege('tenantflow_definer','app','CREATE') AS allowed")).rows[0].allowed,false);
 assert.equal((await admin.query("SELECT has_column_privilege('tenantflow_definer','app.organizations','name','INSERT') AS allowed")).rows[0].allowed,false);
 await admin.query('DROP POLICY definer_organizations_select ON app.organizations');
 await migrate('failure');await migrate('failure');
 await context('failure',async c=>{assert.equal((await c.query("SELECT app.create_organization('After rollback repair')")).rowCount,1);});
});
