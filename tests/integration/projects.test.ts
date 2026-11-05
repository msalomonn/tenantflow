import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApplication} from '../../apps/api/src/app.js';
import {configFromEnvironment} from '../../apps/api/src/config.js';
const origin='http://localhost:4310';
const admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
const instance=createApplication({...configFromEnvironment(),poolSize:4});
let server:ReturnType<typeof instance.app.listen>,base:string;
type Actor={id:string;email:string;cookie:string};
let owner:Actor,teammate:Actor,outsider:Actor,org:string,foreign:string;
const users:string[]=[],orgs:string[]=[];
const path=(id:string,project?:string)=>`/api/organizations/${id}${project?'/projects/'+project:''}`;
async function request(url:string,actor?:Actor,method='GET',body?:unknown,extra:Record<string,string>={}){
 const r=await fetch(base+url,{method,headers:{Origin:origin,Cookie:actor?.cookie??'',...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),response:r};
}
async function signup(name:string){
 const email=`lifecycle-${randomUUID()}@example.test`;
 const r=await request('/api/auth/sign-up/email',undefined,'POST',{name,email,password:'Synthetic-project-password-123!'});
 assert.equal(r.status,200);users.push(r.body.user.id);
 return {id:r.body.user.id,email,cookie:r.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
async function project(){const r=await request(path(org)+'/projects',owner,'POST',{name:'Synthetic project'});assert.equal(r.status,201);return r.body.project.id as string;}
async function role(value:string){assert.equal((await request(path(org)+'/members/'+teammate.id,owner,'PATCH',{role:value})).status,200);}
before(async()=>{
 await instance.assertDatabaseRoles();server=instance.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const a=server.address();assert.ok(a&&typeof a!=='string');base=`http://127.0.0.1:${a.port}`;
 owner=await signup('Owner');teammate=await signup('Teammate');outsider=await signup('Outsider');
 for(const actor of [owner,outsider]){const r=await request('/api/organizations',actor,'POST',{name:'Lifecycle studio'});assert.equal(r.status,201);orgs.push(r.body.organization.id);}
 [org,foreign]=orgs;assert.equal((await request(path(org)+'/members',owner,'POST',{email:teammate.email,role:'member'})).status,201);
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));await admin.query('DELETE FROM app.organizations WHERE id=ANY($1::uuid[])',[orgs]);await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::text[])',[users]);await instance.close();await admin.end();});
test('P01/P03: rename trims; archive retains data, is idempotent and blocks later rename',async()=>{
 const id=await project();let r=await request(path(org,id),owner,'PATCH',{name:'  Updated project  '});assert.equal(r.status,200);assert.equal(r.body.project.name,'Updated project');
 r=await request(path(org,id),owner,'PATCH',{archived:true});assert.equal(r.status,200);assert.ok(r.body.project.archived_at);const timestamp=r.body.project.archived_at;
 assert.equal((await request(path(org,id),owner,'PATCH',{archived:true})).body.project.archived_at,timestamp);
 assert.equal((await request(path(org,id),owner,'PATCH',{name:'Revived'})).status,409);
 assert.ok(!(await request(path(org)+'/projects',owner)).body.projects.some((p:{id:string})=>p.id===id));
 const detail=await request(path(org,id),owner);assert.equal(detail.status,200);assert.equal(detail.body.project.name,'Updated project');assert.equal(detail.body.project.archived_at,timestamp);
 assert.equal((await admin.query('SELECT name FROM app.projects WHERE id=$1',[id])).rows[0].name,'Updated project');
});
test('P02/P04: project and organization mutations enforce all four roles',async()=>{
 for(const next of ['owner','admin','member','viewer']){
  await role(next);const id=await project();const expected=next==='viewer'?403:200;
  assert.equal((await request(path(org,id),teammate,'PATCH',{name:'By '+next})).status,expected);
  assert.equal((await request(path(org,id),teammate,'PATCH',{archived:true})).status,expected);
  assert.equal((await request(path(org),teammate,'PATCH',{name:'Studio '+next})).status,['owner','admin'].includes(next)?200:403);
 }
 assert.equal((await request(path(org),owner,'PATCH',{name:'  Owner studio  '})).body.organization.name,'Owner studio');
});
test('P02: absent sessions, foreign IDs and forged tenant context never mutate',async()=>{
 const id=await project();
 for(const payload of [{name:'Attack'},{archived:true}]){
  assert.equal((await request(path(org,id),undefined,'PATCH',payload)).status,401);
  assert.equal((await request(path(org,id),outsider,'PATCH',payload,{'x-tenant-id':org})).status,404);
  assert.equal((await request(path(foreign,id),outsider,'PATCH',payload)).status,404);
  assert.equal((await request(path(org,randomUUID()),owner,'PATCH',payload)).status,404);
 }
 assert.equal((await request(path(org),undefined,'PATCH',{name:'Attack'})).status,401);
 assert.equal((await request(path(org),outsider,'PATCH',{name:'Attack'})).status,404);
 assert.equal((await request(path(org,id),owner)).body.project.name,'Synthetic project');
 assert.equal((await request(path(org,id),owner,'PATCH',{name:'CSRF'},{Origin:'https://attacker.example'})).status,403);
 assert.equal((await request(path(org),owner,'PATCH',{name:'CSRF'},{Origin:''})).status,403);
});
test('P01: invalid inputs rejected without partial writes; unicode limit is code points',async()=>{
 const id=await project();
 for(const payload of [{},[],{name:''},{name:'  '},{name:'x'.repeat(121)},{name:'bad\u0000name'},{name:4},{archived:false},{archived:'true'},{name:'X',archived:true},{name:'X',organization_id:foreign},{id:randomUUID()}]){
  assert.equal((await request(path(org,id),owner,'PATCH',payload)).status,400,JSON.stringify(payload));
 }
 for(const payload of [{},{name:' '},{name:'x'.repeat(121)},{name:'bad\u0000name'},{name:'X',id:foreign}])assert.equal((await request(path(org),owner,'PATCH',payload)).status,400);
 assert.equal((await request(path(org,id),owner,'PATCH',{name:'🌱'.repeat(120)})).status,200);
 assert.equal((await request(path(org,id),owner,'PATCH',{name:'🌱'.repeat(121)})).status,400);
});
test('P02: demotion and removal apply on next project mutation',async()=>{
 const id=await project();await role('member');assert.equal((await request(path(org,id),teammate,'PATCH',{name:'Before demotion'})).status,200);
 await role('viewer');assert.equal((await request(path(org,id),teammate,'PATCH',{archived:true})).status,403);
 assert.equal((await request(path(org)+'/members/'+teammate.id,owner,'DELETE',{})).status,200);
 assert.equal((await request(path(org,id),teammate,'PATCH',{name:'After removal'})).status,404);
 assert.equal((await request(path(org)+'/members',owner,'POST',{email:teammate.email,role:'viewer'})).status,201);
});
test('P03: concurrent archive and rename cannot revive a project',async()=>{
 const id=await project();
 const lock=await admin.connect();await lock.query('BEGIN');await lock.query('SELECT id FROM app.projects WHERE id=$1 FOR UPDATE',[id]);
 const pending=Promise.all([request(path(org,id),owner,'PATCH',{archived:true}),request(path(org,id),owner,'PATCH',{archived:true}),request(path(org,id),owner,'PATCH',{name:'Concurrent name'})]);
 try{
  const deadline=Date.now()+5000;
  while(true){
   const waiting=await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND usename='tenantflow_app' AND wait_event_type='Lock' AND query LIKE 'SELECT id,organization_id,name,created_at,archived_at FROM app.projects%FOR UPDATE'");
   if(waiting.rows[0].n>=3)break;
   assert.ok(Date.now()<deadline,'three project mutations must overlap behind the row lock');
   await new Promise(resolve=>setTimeout(resolve,20));
  }
 }finally{await lock.query('ROLLBACK');lock.release();}
 const rs=await pending;
 assert.equal(rs[0].status,200);assert.equal(rs[1].status,200);assert.equal(rs[0].body.project.archived_at,rs[1].body.project.archived_at);assert.ok([200,409].includes(rs[2].status));
 assert.ok((await request(path(org,id),owner)).body.project.archived_at);
});
test('P02: RLS and column grants reject direct foreign/viewer updates and tenant changes',async()=>{
 const id=await project();
 for(const actor of [outsider,teammate]){
  const c=await instance.dataPool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[actor.id,org]);
   assert.equal((await c.query('UPDATE app.projects SET name=$1 WHERE id=$2',['Direct attack',id])).rowCount,0);
   assert.equal((await c.query('UPDATE app.organizations SET name=$1 WHERE id=$2',['Direct attack',org])).rowCount,0);
  }finally{await c.query('ROLLBACK');c.release();}
 }
 const c=await instance.dataPool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[owner.id,org]);
  await assert.rejects(c.query('UPDATE app.projects SET organization_id=$1 WHERE id=$2',[foreign,id]),{code:'42501'});
 }finally{await c.query('ROLLBACK');c.release();}
 assert.equal((await instance.dataPool.query('UPDATE app.projects SET name=$1 WHERE id=$2',['Unscoped',id])).rowCount,0);
});
test('P03/P04: persisted rename/archive survive API replacement',async()=>{
 const id=await project();assert.equal((await request(path(org,id),owner,'PATCH',{name:'Persisted'})).status,200);assert.equal((await request(path(org,id),owner,'PATCH',{archived:true})).status,200);
 assert.equal((await request(path(org),owner,'PATCH',{name:'Persisted studio'})).status,200);
 const second=createApplication(configFromEnvironment());const listener=second.app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.once('listening',r));
 try{const a=listener.address();assert.ok(a&&typeof a!=='string');const url=`http://127.0.0.1:${a.port}`;
  const detail=await fetch(url+path(org,id),{headers:{Cookie:owner.cookie}});assert.equal(detail.status,200);const p=(await detail.json()).project;assert.equal(p.name,'Persisted');assert.ok(p.archived_at);
  const list=await (await fetch(url+'/api/organizations',{headers:{Cookie:owner.cookie}})).json();assert.equal(list.organizations.find((o:{id:string})=>o.id===org).name,'Persisted studio');
 }finally{await new Promise<void>(r=>listener.close(()=>r()));await second.close();}
});
