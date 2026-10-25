import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createApplication } from '../../apps/api/src/app.js';
import { configFromEnvironment } from '../../apps/api/src/config.js';

const origin = 'http://localhost:4310';
let base: string;
let alice: string, bob: string, aliceId: string, bobId: string, orgA: string, orgB: string, projectA: string;
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const instance = createApplication({ ...configFromEnvironment(), poolSize: 1 });
let server: ReturnType<typeof instance.app.listen>;
async function request(path: string, cookie = '', method = 'GET', body?: unknown, extra: Record<string,string> = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: origin, Cookie: cookie, ...(body ? {'Content-Type':'application/json'} : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), response };
}
async function signUp(name: string) {
  const result = await request('/api/auth/sign-up/email','', 'POST', {name,email:`${name}-${randomUUID()}@example.test`,password:'Synthetic-test-password-123!'});
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.ok(result.response.headers.getSetCookie().some(c=>c.includes('session_token') && /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c)));
  return { cookie: result.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '), id: result.body.user.id };
}
before(async () => {
  await instance.assertDatabaseRoles();
  server=instance.app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address(); assert.ok(address && typeof address!=='string'); base=`http://127.0.0.1:${address.port}`;
  ({cookie:alice,id:aliceId}=await signUp('Alice'));
  ({cookie:bob,id:bobId}=await signUp('Bob'));
  const a=await request('/api/organizations',alice,'POST',{name:'North Studio'}); assert.equal(a.status,201); orgA=a.body.organization.id;
  const b=await request('/api/organizations',bob,'POST',{name:'South Studio'}); assert.equal(b.status,201); orgB=b.body.organization.id;
  const p=await request(`/api/organizations/${orgA}/projects`,alice,'POST',{name:'Private north project'}); assert.equal(p.status,201); projectA=p.body.project.id;
});
after(async () => {
  if (server) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await instance.close(); await admin.end();
});
test('TF-A01: protected routes require a valid real session',async()=>{
  assert.equal((await request('/api/me')).status,401);
  assert.equal((await request('/api/organizations','bad-token')).status,401);
});
test('TF-A02: organization creation includes owner membership atomically',async()=>{
  const result=await admin.query('SELECT role FROM app.memberships WHERE organization_id=$1 AND user_id=$2',[orgA,aliceId]);
  assert.equal(result.rows[0].role,'owner');
  const before=await admin.query('SELECT count(*) FROM app.organizations');
  assert.equal((await request('/api/organizations',alice,'POST',{name:'   '})).status,400);
  assert.equal((await admin.query('SELECT count(*) FROM app.organizations')).rows[0].count,before.rows[0].count);
});
test('TF-A03/A04: foreign tenant IDs and forged headers never expose data',async()=>{
  const list=await request('/api/organizations',bob); assert.ok(!list.body.organizations.some((o:{id:string})=>o.id===orgA));
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob,'GET',undefined,{'x-tenant-id':orgA})).status,404);
  assert.equal((await request(`/api/organizations/${orgB}/projects/${projectA}`,bob)).status,404);
  assert.equal((await request(`/api/organizations/${orgA}/projects/${projectA}`,bob)).status,404);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob,'POST',{name:'Attack',organization_id:orgB})).status,404);
  assert.equal((await request(`/api/organizations/${orgB}/projects`,bob)).body.projects.length,0);
});
test('TF-A02: a failing owner insert rolls back organization creation',async()=>{
  const count=(await admin.query('SELECT count(*) FROM app.organizations')).rows[0].count;
  const c=await instance.dataPool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.user_id',$1,true)",['nonexistent-'+randomUUID()]);
    await assert.rejects(c.query("SELECT app.create_organization('Must roll back')"),{code:'23503'});
  } finally {await c.query('ROLLBACK');c.release();}
  assert.equal((await admin.query('SELECT count(*) FROM app.organizations')).rows[0].count,count);
});
test('TF-A05: viewer is read-only; membership change takes effect next request',async()=>{
  await admin.query('INSERT INTO app.memberships(organization_id,user_id,role) VALUES($1,$2,$3)',[orgA,bobId,'viewer']);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob)).body.projects.length,1);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob,'POST',{name:'Blocked'})).status,403);
  await admin.query("UPDATE app.memberships SET role='member' WHERE organization_id=$1 AND user_id=$2",[orgA,bobId]);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob,'POST',{name:'Allowed'})).status,201);
  await admin.query('DELETE FROM app.memberships WHERE organization_id=$1 AND user_id=$2',[orgA,bobId]);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,bob)).status,404);
});
test('RLS: restricted database role denies unscoped reads and foreign inserts',async()=>{
  const pool=instance.dataPool;
  const role=await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.equal(role.rows[0].rolsuper,false); assert.equal(role.rows[0].rolbypassrls,false);
  assert.equal((await pool.query('SELECT * FROM app.projects')).rowCount,0);
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[bobId,orgA]);
    assert.equal((await c.query('SELECT * FROM app.projects')).rowCount,0);
    await assert.rejects(c.query('INSERT INTO app.projects(organization_id,name) VALUES($1,$2)',[orgA,'Direct attack']),{code:'42501'});
  } finally { await c.query('ROLLBACK'); c.release(); }
  assert.equal((await pool.query('SELECT * FROM app.projects')).rowCount,0);
});
test('Pooled connections and rollback do not retain another request context',async()=>{
  for(let i=0;i<3;i++) {
    assert.equal((await request(`/api/organizations/${orgA}/projects`,alice)).status,200);
    assert.equal((await request(`/api/organizations/${orgA}/projects`,alice,'POST',{name:''})).status,400);
    assert.equal((await request(`/api/organizations/${orgA}/projects`,bob)).status,404);
    assert.equal((await request(`/api/organizations/${orgB}/projects`,bob)).body.projects.length,0);
  }
});
test('CSRF: unsafe operations reject foreign or absent origins',async()=>{
  assert.equal((await request('/api/organizations',alice,'POST',{name:'CSRF'},{Origin:'https://attacker.example'})).status,403);
  assert.equal((await request('/api/organizations',alice,'POST',{name:'No origin'},{Origin:''})).status,403);
  assert.equal((await request('/api/auth/sign-in/email','', 'POST',{email:'bad@example.test',password:'x'},{Origin:'https://attacker.example'})).status,403);
});
test('Validation rejects invalid IDs, unknown fields and excessively long names',async()=>{
  assert.equal((await request('/api/organizations/not-a-uuid/projects',alice)).status,400);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,alice,'POST',{name:'A',organization_id:orgB})).status,400);
  assert.equal((await request(`/api/organizations/${orgA}/projects`,alice,'POST',{name:'a'.repeat(121)})).status,400);
});
test('Projects and sessions survive replacement of the API instance',async()=>{
  const second=createApplication(configFromEnvironment());
  const listener=second.app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>listener.once('listening',resolve));
  try {
    const address=listener.address(); assert.ok(address&&typeof address!=='string');
    const r=await fetch(`http://127.0.0.1:${address.port}/api/organizations/${orgA}/projects/${projectA}`,{headers:{Cookie:alice}});
    assert.equal(r.status,200);assert.equal((await r.json()).project.id,projectA);
  } finally {await new Promise<void>(resolve=>listener.close(()=>resolve()));await second.close();}
});
test('TF-A01: sign-out revokes the persisted session immediately',async()=>{
  const user=await signUp('Logout');
  assert.equal((await request('/api/me',user.cookie)).status,200);
  assert.equal((await request('/api/auth/sign-out',user.cookie,'POST',{})).status,200);
  assert.equal((await request('/api/me',user.cookie)).status,401);
});
