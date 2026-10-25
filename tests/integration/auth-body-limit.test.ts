import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Pool} from 'pg';
import {createApplication} from '../../apps/api/src/app.js';
import {configFromEnvironment} from '../../apps/api/src/config.js';

const origin='http://localhost:4310';
const limit=16*1024;
const admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
const instance=createApplication(configFromEnvironment());
const emails:string[]=[];
let server:ReturnType<typeof instance.app.listen>;
let base:string;

function account() {
  const email=`body-limit-${randomUUID()}@example.test`;
  emails.push(email);
  return {name:'Body limit test',email,password:'Synthetic-body-limit-password-123!'};
}

// Writing separate buffers without Content-Length exercises HTTP chunked transfer.
function send(path:string,body:Buffer,chunked=false,headers:Record<string,string>={}) {
  return new Promise<{status:number;body:Record<string,any>;cookies:string[]}>((resolve,reject)=>{
    const req=httpRequest(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(chunked?{}:{'Content-Length':String(body.length)}),...headers}},res=>{
      const chunks:Buffer[]=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('error',reject);
      res.on('end',()=>{
        try {resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString()),cookies:res.headers['set-cookie']??[]});}
        catch(error) {reject(error);}
      });
    });
    req.setTimeout(5000,()=>req.destroy(new Error('HTTP test timed out')));
    req.on('error',reject);
    const midpoint=Math.ceil(body.length/2);
    req.write(body.subarray(0,midpoint));
    req.end(body.subarray(midpoint));
  });
}

before(async()=>{
  await instance.assertDatabaseRoles();
  server=instance.app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  base=`http://127.0.0.1:${address.port}`;
});
after(async()=>{
  if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  // Remove only accounts created by this suite, including a regression's unexpected inserts.
  await admin.query('DELETE FROM auth."user" WHERE email=ANY($1::text[])',[emails]);
  await instance.close();await admin.end();
});

for(const transport of ['content-length','chunked','gzip'] as const) {
  test(`Auth rejects oversized ${transport} signup before creating a user`,async()=>{
    const data={...account(),name:'R'.repeat(32*1024)};
    const raw=Buffer.from(JSON.stringify(data));
    const body=transport==='gzip'?gzipSync(raw):raw;
    if(transport==='gzip')assert.ok(body.length<limit,'Compressed input is small; the inflated size must be bounded');
    const response=await send('/api/auth/sign-up/email',body,transport==='chunked',transport==='gzip'?{'Content-Encoding':'gzip'}:{});
    assert.equal(response.status,413);
    assert.deepEqual(response.body,{error:'Request body is too large.'});
    assert.equal(response.cookies.length,0);
    assert.equal((await admin.query('SELECT 1 FROM auth."user" WHERE email=$1',[data.email])).rowCount,0);
  });
}

test('Small chunked signup, sign-out and sign-in keep real session cookies working',async()=>{
  const data=account();
  const signup=await send('/api/auth/sign-up/email',Buffer.from(JSON.stringify(data)),true);
  assert.equal(signup.status,200);
  assert.ok(signup.cookies.some(cookie=>cookie.includes('session_token')&&/HttpOnly/i.test(cookie)));
  const cookie=signup.cookies.map(value=>value.split(';')[0]).join('; ');
  assert.equal((await fetch(base+'/api/me',{headers:{Cookie:cookie}})).status,200);
  const signout=await send('/api/auth/sign-out',Buffer.from('{}'),true,{Cookie:cookie});
  assert.equal(signout.status,200);
  assert.equal((await fetch(base+'/api/me',{headers:{Cookie:cookie}})).status,401);
  const signin=await send('/api/auth/sign-in/email',Buffer.from(JSON.stringify({email:data.email,password:data.password})),true);
  assert.equal(signin.status,200);
  const freshCookie=signin.cookies.map(value=>value.split(';')[0]).join('; ');
  assert.equal((await fetch(base+'/api/me',{headers:{Cookie:freshCookie}})).status,200);
});

test('Auth accepts a valid JSON body exactly at the 16 KiB boundary',async()=>{
  const json=JSON.stringify(account());
  const body=Buffer.from(json+' '.repeat(limit-Buffer.byteLength(json)));
  assert.equal(body.length,limit);
  assert.equal((await send('/api/auth/sign-up/email',body)).status,200);
});

test('Malformed auth JSON returns a safe 400 response',async()=>{
  const response=await send('/api/auth/sign-up/email',Buffer.from('{"password":"synthetic-do-not-echo",'),true);
  assert.equal(response.status,400);
  assert.deepEqual(response.body,{error:'Invalid JSON body.'});
  assert.equal(response.cookies.length,0);
});
