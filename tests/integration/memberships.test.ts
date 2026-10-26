import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApplication} from '../../apps/api/src/app.js';
import {configFromEnvironment} from '../../apps/api/src/config.js';
const origin='http://localhost:4310';
const admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
const instance=createApplication(configFromEnvironment());
let server:ReturnType<typeof instance.app.listen>,base:string;
type Actor={id:string;email:string;cookie:string};
let alice:Actor,bob:Actor,outsider:Actor;
const orgs:string[]=[],users:string[]=[];
async function request(path:string,actor?:Actor,method='GET',body?:unknown){
 const response=await fetch(base+path,{method,headers:{Origin:origin,Cookie:actor?.cookie??'',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,body:await response.json(),response};
}
async function signup(name:string):Promise<Actor>{
 const email=`members-${name}-${randomUUID()}@example.test`;
 const r=await request('/api/auth/sign-up/email',undefined,'POST',{name,email,password:'Synthetic-member-password-123!'});
 assert.equal(r.status,200);users.push(r.body.user.id);
 return {id:r.body.user.id,email,cookie:r.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
async function organization(actor=alice){
 const r=await request('/api/organizations',actor,'POST',{name:'Membership review'});assert.equal(r.status,201);
 orgs.push(r.body.organization.id);return r.body.organization.id as string;
}
const path=(org:string,user?:string)=>`/api/organizations/${org}/members${user?'/'+user:''}`;
async function add(org:string,role='member',actor=alice,target=bob){return request(path(org),actor,'POST',{email:target.email,role});}
before(async()=>{
 server=instance.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const address=server.address();assert.ok(address&&typeof address!=='string');base=`http://127.0.0.1:${address.port}`;
 alice=await signup('Alice');bob=await signup('Bob');outsider=await signup('Outside');
});
after(async()=>{
 if(server)await new Promise<void>(r=>server.close(()=>r()));
 await admin.query('DELETE FROM app.organizations WHERE id=ANY($1::uuid[])',[orgs]);
 await admin.query('DELETE FROM auth."user" WHERE id=ANY($1::text[])',[users]);
 await instance.close();await admin.end();
});
test('TF-A05: owner can list/add/change/remove existing users without leaking auth fields',async()=>{
 const org=await organization();
 assert.equal((await request(path(org))).status,401);
 const added=await request(path(org),alice,'POST',{email:' '+bob.email.toUpperCase()+' ',role:'viewer'});
 assert.equal(added.status,201);assert.equal(added.body.member.role,'viewer');
 const list=await request(path(org),alice);assert.equal(list.status,200);assert.equal(list.body.members.length,2);
 assert.deepEqual(Object.keys(list.body.members[0]).sort(),['email','name','role','user_id']);
 assert.equal((await request(path(org,bob.id),alice,'PATCH',{role:'admin'})).body.member.role,'admin');
 assert.equal((await request(path(org,bob.id),alice,'DELETE',{})).status,200);
 assert.equal((await request(path(org),alice)).body.members.length,1);
});
test('TF-A05: admin/member/viewer cannot list or mutate members; project writes follow role',async()=>{
 const org=await organization();assert.equal((await add(org,'admin')).status,201);
 for(const role of ['admin','member','viewer']){
  assert.equal((await request(path(org,bob.id),alice,'PATCH',{role})).status,200);
  assert.equal((await request(path(org),bob)).status,403);
  assert.equal((await add(org,'owner',bob,outsider)).status,403);
  assert.equal((await request(path(org,alice.id),bob,'PATCH',{role:'member'})).status,403);
  assert.equal((await request(path(org,alice.id),bob,'DELETE',{})).status,403);
  assert.equal((await request(`/api/organizations/${org}/projects`,bob,'POST',{name:'Role check'})).status,role==='viewer'?403:201);
 }
});
test('TF-A04/A08: outsider and foreign target cannot expose or mutate memberships',async()=>{
 const a=await organization(),b=await organization(outsider);assert.equal((await add(b,'member',outsider,bob)).status,201);
 for(const [method,body] of [['GET',undefined],['POST',{email:bob.email,role:'owner'}],['PATCH',{role:'owner'}],['DELETE',{}]] as const){
  assert.equal((await request(path(a,method==='PATCH'||method==='DELETE'?alice.id:undefined),outsider,method,body)).status,404);
 }
 assert.equal((await request(path(a,bob.id),alice,'PATCH',{role:'owner'})).status,404);
 assert.equal((await request(path(a,bob.id),alice,'DELETE',{})).status,404);
 assert.equal((await request(path(b),outsider)).body.members.find((m: {user_id:string})=>m.user_id===bob.id).role,'member');
});
test('TF-A07: duplicate, unknown account and invalid input are rejected',async()=>{
 const org=await organization();assert.equal((await add(org)).status,201);assert.equal((await add(org)).status,409);
 assert.equal((await request(path(org),alice,'POST',{email:'missing-'+randomUUID()+'@example.test',role:'member'})).status,404);
 for(const body of [{email:bob.email,role:'root'},{email:'bad',role:'member'},{email:bob.email,role:'member',organization_id:org}])assert.equal((await request(path(org),alice,'POST',body)).status,400);
 assert.equal((await request(path(org,bob.id),alice,'PATCH',{role:'root'})).status,400);
 assert.equal((await request(path(org,bob.id),alice,'DELETE',{role:'owner'})).status,400);
 assert.equal((await request('/api/organizations/bad/members',alice)).status,400);
});
test('TF-A07: last owner cannot be removed/demoted; assigning owner again is allowed',async()=>{
 const org=await organization();assert.equal((await add(org,'admin')).status,201);
 assert.equal((await request(path(org,alice.id),alice,'DELETE',{})).status,409);
 for(const role of ['admin','member','viewer'])assert.equal((await request(path(org,alice.id),alice,'PATCH',{role})).status,409);
 assert.equal((await request(path(org,alice.id),alice,'PATCH',{role:'owner'})).status,200);
});
test('TF-A08: self-demotion and removal apply to the very next request',async()=>{
 const org=await organization();assert.equal((await add(org,'owner')).status,201);
 assert.equal((await request(path(org,alice.id),alice,'PATCH',{role:'member'})).status,200);
 assert.equal((await request(path(org),alice)).status,403);
 assert.equal((await request(`/api/organizations/${org}/projects`,alice,'POST',{name:'Still a member'})).status,201);
 assert.equal((await request(path(org,alice.id),bob,'DELETE',{})).status,200);
 assert.equal((await request(`/api/organizations/${org}/projects`,alice)).status,404);
 assert.ok(!(await request('/api/organizations',alice)).body.organizations.some((o:{id:string})=>o.id===org));
});
for(const method of ['PATCH','DELETE'])test(`TF-A07: simultaneous owner ${method} requests preserve one owner`,async()=>{
 const org=await organization();assert.equal((await add(org,'owner')).status,201);
 const gate=await admin.connect();await gate.query('BEGIN');await gate.query('SELECT id FROM app.organizations WHERE id=$1 FOR UPDATE',[org]);
 const pending=[alice,bob].map(actor=>request(path(org,actor.id),actor,method,method==='PATCH'?{role:'member'}:{}));
 try{
  let blocked=0;
  for(let i=0;i<100;i++){
   const r=await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename='tenantflow_app' AND wait_event_type='Lock' AND query LIKE '%app.mutate_member%'");
   blocked=r.rows[0].n;if(blocked===2)break;await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(blocked,2,'Both requests must wait on the same locked organization from separate connections');
 }finally{await gate.query('COMMIT');gate.release();}
 const results=await Promise.all(pending);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const owners=await admin.query("SELECT user_id FROM app.memberships WHERE organization_id=$1 AND role='owner'",[org]);assert.equal(owners.rowCount,1);
 const remaining=owners.rows[0].user_id===alice.id?alice:bob;assert.equal((await request(path(org),remaining)).status,200);
});
test('TF-A07: concurrent duplicate additions have one winner',async()=>{
 const org=await organization();const results=await Promise.all([add(org),add(org)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
});
test('Runtime role cannot bypass owner checks with direct function or table writes',async()=>{
 const org=await organization();assert.equal((await add(org,'member')).status,201);
 const c=await instance.dataPool.connect();
 try{
  await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[bob.id,org]);
  await assert.rejects(c.query('SELECT app.mutate_member($1,$2,$3,$4)',[org,'update',bob.id,'owner']),{code:'PT403'});
  await c.query('ROLLBACK');await c.query('BEGIN');
  await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[alice.id,org]);
  await assert.rejects(c.query("UPDATE app.memberships SET role='owner' WHERE organization_id=$1 AND user_id=$2",[org,bob.id]),{code:'42501'});
 }finally{await c.query('ROLLBACK');c.release();}
});

test('A waiting owner mutation rechecks authority after a competing demotion',async()=>{
 const org=await organization();assert.equal((await add(org,'owner')).status,201);
 const gate=await admin.connect();await gate.query('BEGIN');await gate.query('SELECT id FROM app.organizations WHERE id=$1 FOR UPDATE',[org]);
 const pending=request(path(org,alice.id),bob,'DELETE',{});
 try{
  let blocked=false;
  for(let i=0;i<100;i++){
   const r=await admin.query("SELECT 1 FROM pg_stat_activity WHERE usename='tenantflow_app' AND wait_event_type='Lock' AND query LIKE '%app.mutate_member%'");
   if(r.rowCount){blocked=true;break;}await new Promise(r=>setTimeout(r,20));
  }
  assert.ok(blocked,'Owner request reached the locked mutation');
  // Simulate the competing transaction's completed role change while holding the same lock.
  await gate.query("UPDATE app.memberships SET role='member' WHERE organization_id=$1 AND user_id=$2",[org,bob.id]);
 }finally{await gate.query('COMMIT');gate.release();}
 assert.equal((await pending).status,403);
 assert.equal((await request(path(org),alice)).status,200);
});

test('Account deletion remains disabled so it cannot cascade away the last owner',async()=>{
 const org=await organization();
 const result=await fetch(base+'/api/auth/delete-user',{method:'POST',headers:{Origin:origin,Cookie:alice.cookie,'Content-Type':'application/json'},body:JSON.stringify({password:'Synthetic-member-password-123!'})});
 assert.equal(result.status,404);
 assert.equal((await request(path(org),alice)).body.members[0].role,'owner');
});
