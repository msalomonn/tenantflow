import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApplication} from '../../apps/api/src/app.js';
import {configFromEnvironment} from '../../apps/api/src/config.js';
const config=configFromEnvironment(),origin=config.origin;
const admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
const instance=createApplication(config);
let server:ReturnType<typeof instance.app.listen>,base:string,org:string,project:string;
const users:string[]=[];
type Actor={id:string;email:string;cookie:string};let owner:Actor;
const password='Synthetic-boundary-password-123!';
async function request(path:string,cookie='',method='GET',body?:unknown,headers:Record<string,string>={}){
 const r=await fetch(base+path,{method,headers:{Origin:origin,Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),response:r};
}
async function respectingLimit(send:()=>Promise<Response>){
 let response=await send();
 if(response.status===429){const seconds=Number(response.headers.get('retry-after')??10);assert.ok(Number.isFinite(seconds)&&seconds>=0&&seconds<=10);await response.body?.cancel();await new Promise(r=>setTimeout(r,(seconds+.2)*1000));response=await send();}
 return response;
}
async function signup():Promise<Actor>{
 const email=`boundary-${randomUUID()}@example.test`;const r=await request('/api/auth/sign-up/email','','POST',{name:'Boundary account',email,password});assert.equal(r.status,200);users.push(r.body.user.id);
 return {id:r.body.user.id,email,cookie:r.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
before(async()=>{
 server=instance.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');base=`http://127.0.0.1:${a.port}`;
 owner=await signup();const o=await request('/api/organizations',owner.cookie,'POST',{name:'Boundary studio'});assert.equal(o.status,201);org=o.body.organization.id;
 const p=await request(`/api/organizations/${org}/projects`,owner.cookie,'POST',{name:'Private project'});assert.equal(p.status,201);project=p.body.project.id;
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));if(org)await admin.query('DELETE FROM app.organizations WHERE id=$1',[org]);await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::text[])',[users]);await instance.close();await admin.end();});
function protectedRoutes():Array<[string,string,unknown?]>{return [
 ['GET','/api/me'],['GET','/api/organizations'],['POST','/api/organizations',{name:'Unauthorized'}],['PATCH',`/api/organizations/${org}`,{name:'Unauthorized'}],
 ['GET',`/api/organizations/${org}/projects`],['POST',`/api/organizations/${org}/projects`,{name:'Unauthorized'}],['GET',`/api/organizations/${org}/projects/${project}`],['PATCH',`/api/organizations/${org}/projects/${project}`,{archived:true}],
 ['GET',`/api/organizations/${org}/members`],['POST',`/api/organizations/${org}/members`,{email:owner.email,role:'owner'}],['PATCH',`/api/organizations/${org}/members/${owner.id}`,{role:'viewer'}],['DELETE',`/api/organizations/${org}/members/${owner.id}`,{}]
 ];}
test('H02: absent and forged sessions/identity headers fail every protected route',async()=>{
 for(const cookie of ['', 'better-auth.session_token=forged'])for(const [method,path,body] of protectedRoutes()){
  const r=await request(path,cookie,method,body,{'x-user-id':owner.id,'x-tenant-id':org,'x-organization-id':org});assert.equal(r.status,401,method+' '+path);assert.deepEqual(r.body,{error:'Sign in to continue.'});
 }
});
test('H02: wrong password establishes no session; expired and revoked sessions fail all routes',async()=>{
 const wrong=await request('/api/auth/sign-in/email','','POST',{email:owner.email,password:'Incorrect-synthetic-password'});assert.equal(wrong.status,401);assert.ok(!wrong.response.headers.getSetCookie().some(c=>c.includes('session_token=')&&!c.includes('Max-Age=0')));
 const expired=await signup();assert.equal((await request('/api/me',expired.cookie)).status,200);
 await admin.query('UPDATE auth.session SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1',[expired.id]);
 for(const [method,path,body] of protectedRoutes())assert.equal((await request(path,expired.cookie,method,body)).status,401,method+' '+path);
 const revoked=await signup();assert.equal((await request('/api/auth/sign-out',revoked.cookie,'POST',{})).status,200);
 for(const [method,path,body] of protectedRoutes())assert.equal((await request(path,revoked.cookie,method,body)).status,401,method+' '+path);
});
test('H03: unsafe methods require trusted exact origin and JSON before mutation',async()=>{
 const routes=protectedRoutes().filter(([method])=>method!=='GET');
 const invalidHeaders:Record<string,string>[]=[{Origin:''},{Origin:'https://attacker.example'},{'sec-fetch-site':'cross-site'}];
 for(const [method,path,body] of routes){
  for(const headers of invalidHeaders)assert.equal((await request(path,owner.cookie,method,body,headers)).status,403,method+' '+path);
  assert.equal((await request(path,owner.cookie,method,body,{'Content-Type':'text/plain'})).status,415);
 }
 assert.equal((await request(`/api/organizations/${org}/projects/${project}`,owner.cookie)).body.project.name,'Private project');
});
test('H03: privileged application and authentication database roles fail startup validation',async()=>{
 for(const key of ['databaseUrl','authDatabaseUrl']){
  const unsafe=createApplication({...config,[key]:process.env.DATABASE_ADMIN_URL!});
  try{await assert.rejects(unsafe.assertDatabaseRoles(),/Unsafe database runtime role/);}finally{await unsafe.close();}
 }
});
test('H03: production requires HTTPS and a strong-length secret',()=>{
 const previous={NODE_ENV:process.env.NODE_ENV,APP_ORIGIN:process.env.APP_ORIGIN,BETTER_AUTH_SECRET:process.env.BETTER_AUTH_SECRET};
 try{
  process.env.NODE_ENV='production';process.env.APP_ORIGIN='http://localhost:4310';assert.throws(()=>configFromEnvironment(),/Production requires an HTTPS/);
  process.env.APP_ORIGIN='https://tenantflow.example.test';process.env.BETTER_AUTH_SECRET='short';assert.throws(()=>configFromEnvironment(),/at least 32 characters/);
  process.env.BETTER_AUTH_SECRET='synthetic-test-secret-'.repeat(3);assert.equal(configFromEnvironment().production,true);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('H03: production-mode cookies carry Secure, HttpOnly and SameSite flags',async()=>{
 const production=createApplication({...config,production:true,origin:'https://tenantflow.example.test'});const listener=production.app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.once('listening',r));
 try{
  const a=listener.address();assert.ok(a&&typeof a!=='string');const r=await respectingLimit(()=>fetch(`http://127.0.0.1:${a.port}/api/auth/sign-up/email`,{method:'POST',headers:{Origin:'https://tenantflow.example.test','Content-Type':'application/json'},body:JSON.stringify({name:'Cookie flags',email:`flags-${randomUUID()}@example.test`,password})}));
  assert.equal(r.status,200);const data=await r.json();users.push(data.user.id);const cookie=r.headers.getSetCookie().find(c=>c.includes('session_token='));assert.ok(cookie);assert.match(cookie,/; Secure/i);assert.match(cookie,/; HttpOnly/i);assert.match(cookie,/; SameSite=Lax/i);
 }finally{await new Promise<void>(r=>listener.close(()=>r()));await production.close();}
});
