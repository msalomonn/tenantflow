import express, { type Request, type Response, type NextFunction } from 'express';
import { Pool, type PoolClient } from 'pg';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { createAuth } from './auth.js';
import type { Config } from './config.js';
import { assertDefinerRole } from './database-roles.js';
import { mountProjectLifecycle } from './projects.js';
import { mountMembershipRoutes } from './memberships.js';

class HttpError extends Error { constructor(public status:number, message:string) { super(message); } }
function nameFrom(body:unknown):string {
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>k!=='name')) throw new HttpError(400,'Only a name is accepted.');
  const name=(body as {name?:unknown}).name;
  if(typeof name!=='string' || name.includes('\0') || [...name.trim()].length<1 || [...name.trim()].length>120) throw new HttpError(400,'Use a name between 1 and 120 characters.');
  return name.trim();
}
function uuid(value:unknown):string {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400,'Invalid resource identifier.');
  return value;
}

export function createApplication(config:Config) {
  const dataPool=new Pool({connectionString:config.databaseUrl,max:config.poolSize??10});
  const authPool=new Pool({connectionString:config.authDatabaseUrl,options:'-c search_path=auth',max:5});
  const auth=createAuth(authPool,config);
  const app=express();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    // Local/direct-server deployment: never trust client-supplied forwarding headers for throttling.
    req.headers['x-tenantflow-client-ip']=req.socket.remoteAddress??'';
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    if(req.path.startsWith('/api/')) res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if(req.headers.origin!==config.origin || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Untrusted request origin.'});
      if(!req.is('application/json')) return res.status(415).json({error:'JSON content type is required.'});
    }
    next();
  });
  // Bound decoded JSON before any handler, including unauthenticated auth routes.
  // The pinned Better Auth Node adapter accepts the already-consumed req.body.
  app.use(express.json({limit:'16kb'}));
  app.all('/api/auth/*splat',toNodeHandler(auth));
  app.get('/api/health',async(_req,res)=>{ await dataPool.query('SELECT 1'); res.json({status:'ok'}); });
  app.use('/api',async(req,res,next)=>{
    const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
    if(!session) return res.status(401).json({error:'Sign in to continue.'});
    res.locals.user=session.user;
    next();
  });
  app.get('/api/me',(_req,res)=>res.json({user:{id:res.locals.user.id,name:res.locals.user.name,email:res.locals.user.email}}));

  async function transaction<T>(userId:string,orgId:string|undefined,fn:(c:PoolClient)=>Promise<T>):Promise<T> {
    const c=await dataPool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",[userId,orgId??'']);
      const result=await fn(c); await c.query('COMMIT'); return result;
    } catch(e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }
  }
  async function membership(c:PoolClient,orgId:string,userId:string) {
    const result=await c.query('SELECT role FROM app.memberships WHERE organization_id=$1 AND user_id=$2',[orgId,userId]);
    if(!result.rowCount) throw new HttpError(404,'Organization not found.');
    return result.rows[0].role as string;
  }
  app.get('/api/organizations',async(_req,res)=>{
    const organizations=await transaction(res.locals.user.id,undefined,async c=>(await c.query('SELECT o.id,o.name,o.created_at,m.role FROM app.organizations o JOIN app.memberships m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at,o.id',[res.locals.user.id])).rows);
    res.json({organizations});
  });
  app.post('/api/organizations',async(req,res)=>{
    const name=nameFrom(req.body);
    const organization=await transaction(res.locals.user.id,undefined,async c=>{
      const result=await c.query('SELECT app.create_organization($1) AS id',[name]);
      return (await c.query("SELECT id,name,created_at,'owner'::text AS role FROM app.organizations WHERE id=$1",[result.rows[0].id])).rows[0];
    });
    res.status(201).json({organization});
  });
  app.get('/api/organizations/:orgId/projects',async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const projects=await transaction(res.locals.user.id,orgId,async c=>{
      await membership(c,orgId,res.locals.user.id);
      return (await c.query('SELECT id,organization_id,name,created_at FROM app.projects WHERE organization_id=$1 AND archived_at IS NULL ORDER BY created_at DESC,id',[orgId])).rows;
    });
    res.json({projects});
  });
  app.get('/api/organizations/:orgId/projects/:projectId',async(req,res)=>{
    const orgId=uuid(req.params.orgId),projectId=uuid(req.params.projectId);
    const project=await transaction(res.locals.user.id,orgId,async c=>{
      await membership(c,orgId,res.locals.user.id);
      const result=await c.query('SELECT id,organization_id,name,created_at,archived_at FROM app.projects WHERE organization_id=$1 AND id=$2',[orgId,projectId]);
      if(!result.rowCount) throw new HttpError(404,'Project not found.');
      return result.rows[0];
    });
    res.json({project});
  });
  app.post('/api/organizations/:orgId/projects',async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const project=await transaction(res.locals.user.id,orgId,async c=>{
      const role=await membership(c,orgId,res.locals.user.id);
      if(role==='viewer') throw new HttpError(403,'Your role allows viewing projects only.');
      const name=nameFrom(req.body);
      return (await c.query('INSERT INTO app.projects(organization_id,name) VALUES($1,$2) RETURNING id,organization_id,name,created_at',[orgId,name])).rows[0];
    });
    res.status(201).json({project});
  });
  mountProjectLifecycle(app,{transaction,membership,uuid,nameFrom,fail(status,message){throw new HttpError(status,message);}});
  mountMembershipRoutes(app,{transaction,membership,uuid,fail(status,message){throw new HttpError(status,message);}});
  app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof HttpError) return res.status(error.status).json({error:error.message});
    if(error instanceof SyntaxError) return res.status(400).json({error:'Invalid JSON body.'});
    if(typeof error==='object' && error!==null && 'type' in error && error.type==='entity.too.large') return res.status(413).json({error:'Request body is too large.'});
    const code=typeof error==='object' && error!==null && 'code' in error ? String(error.code) : 'unknown';
    const membershipErrors:Record<string,[number,string]>={PT400:[400,'Invalid membership request.'],PT403:[403,'Only owners can manage members.'],PT404:[404,'Organization, registered user or membership not found.'],PT409:[409,'This user is already a member, or the change would remove the last owner.']};
    if(code in membershipErrors){const [status,message]=membershipErrors[code];return res.status(status).json({error:message});}
    // Log only an error code: request content, sessions and credentials stay out of logs.
    console.error('request_failed',code);
    return res.status(500).json({error:'The request could not be completed. Please try again.'});
  });
  return {
    app,dataPool,
    async assertDatabaseRoles() {
      for(const [pool,expected] of [[dataPool,'tenantflow_app'],[authPool,'tenantflow_auth']] as const) {
        const r=await pool.query('SELECT current_user AS name,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
        const v=r.rows[0];
        if(v.name!==expected||v.rolsuper||v.rolbypassrls||v.rolcreatedb||v.rolcreaterole) throw new Error('Unsafe database runtime role');
      }
      await assertDefinerRole(dataPool);
      const owned=await dataPool.query("SELECT 1 FROM pg_tables WHERE schemaname='app' AND tableowner=current_user");
      if(owned.rowCount) throw new Error('Runtime role must not own tenant tables');
    },
    async close() { await dataPool.end(); await authPool.end(); }
  };
}
