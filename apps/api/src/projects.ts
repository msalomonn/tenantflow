import type {Express} from 'express';
import type {PoolClient} from 'pg';
type Boundary={
 transaction<T>(userId:string,orgId:string|undefined,fn:(client:PoolClient)=>Promise<T>):Promise<T>;
 membership(client:PoolClient,orgId:string,userId:string):Promise<string>;
 uuid(value:unknown):string;
 nameFrom(body:unknown):string;
 fail(status:number,message:string):never;
};
const fields='id,organization_id,name,created_at,archived_at';
export function mountProjectLifecycle(app:Express,b:Boundary){
 app.patch('/api/organizations/:orgId/projects/:projectId',async(req,res)=>{
  const org=b.uuid(req.params.orgId),id=b.uuid(req.params.projectId);
  const project=await b.transaction(res.locals.user.id,org,async c=>{
   const role=await b.membership(c,org,res.locals.user.id);
   // Check existence within the tenant before exposing a role-specific error.
   const exists=await c.query('SELECT id FROM app.projects WHERE organization_id=$1 AND id=$2',[org,id]);
   if(!exists.rowCount)b.fail(404,'Project not found.');
   if(role==='viewer')b.fail(403,'Your role allows viewing projects only.');
   const body=req.body;
   const archive=body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===1&&body.archived===true;
   const name=archive?undefined:b.nameFrom(body);
   // Row locking orders concurrent archive/rename before inspecting archived state.
   const current=await c.query(`SELECT ${fields} FROM app.projects WHERE organization_id=$1 AND id=$2 FOR UPDATE`,[org,id]);
   if(!current.rowCount)b.fail(404,'Project not found.');
   if(current.rows[0].archived_at){
    if(archive)return current.rows[0];
    b.fail(409,'This project is archived and cannot be edited.');
   }
   const result=archive
    ?await c.query(`UPDATE app.projects SET archived_at=clock_timestamp() WHERE organization_id=$1 AND id=$2 RETURNING ${fields}`,[org,id])
    :await c.query(`UPDATE app.projects SET name=$3 WHERE organization_id=$1 AND id=$2 RETURNING ${fields}`,[org,id,name]);
   if(!result.rowCount)b.fail(404,'Project not found.');
   return result.rows[0];
  });
  res.json({project});
 });
 app.patch('/api/organizations/:orgId',async(req,res)=>{
  const org=b.uuid(req.params.orgId);
  const organization=await b.transaction(res.locals.user.id,org,async c=>{
   const role=await b.membership(c,org,res.locals.user.id);
   if(!['owner','admin'].includes(role))b.fail(403,'Only owners and admins can rename the organization.');
   const name=b.nameFrom(req.body);
   const result=await c.query('UPDATE app.organizations SET name=$2 WHERE id=$1 RETURNING id,name,created_at',[org,name]);
   if(!result.rowCount)b.fail(404,'Organization not found.');
   return {...result.rows[0],role};
  });
  res.json({organization});
 });
}
