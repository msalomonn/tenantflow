import type {Express} from 'express';
import type {PoolClient} from 'pg';

type Boundary={
  transaction<T>(userId:string,orgId:string|undefined,fn:(client:PoolClient)=>Promise<T>):Promise<T>;
  membership(client:PoolClient,orgId:string,userId:string):Promise<string>;
  uuid(value:unknown):string;
  fail(status:number,message:string):never;
};

export function mountMembershipRoutes(app:Express,boundary:Boundary) {
  const {transaction,membership,uuid,fail}=boundary;
  async function owner<T>(userId:string,orgId:string,fn:(client:PoolClient)=>Promise<T>) {
    return transaction(userId,orgId,async client=>{
      if(await membership(client,orgId,userId)!=='owner')fail(403,'Only owners can manage members.');
      return fn(client); // SQL repeats authorization after acquiring the organization lock.
    });
  }
  function object(body:unknown,keys:string[]):Record<string,unknown> {
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))fail(400,'Invalid membership fields.');
    return body as Record<string,unknown>;
  }
  function role(value:unknown):string {
    if(typeof value!=='string'||!['owner','admin','member','viewer'].includes(value))fail(400,'Choose owner, admin, member or viewer.');
    return value as string;
  }
  function userId(value:unknown):string {
    if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))fail(400,'Invalid user identifier.');
    return value as string;
  }
  const base='/api/organizations/:orgId/members';
  app.get(base,async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const members=await owner(res.locals.user.id,orgId,async client=>(await client.query('SELECT * FROM app.list_members($1)',[orgId])).rows);
    res.json({members});
  });
  app.post(base,async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const result=await owner(res.locals.user.id,orgId,async client=>{
      const body=object(req.body,['email','role']);
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))fail(400,'Enter a valid registered email address.');
      return (await client.query('SELECT app.mutate_member($1,$2,$3,$4) AS result',[orgId,'add',email,role(body.role)])).rows[0].result;
    });
    res.status(201).json(result);
  });
  app.patch(base+'/:userId',async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const result=await owner(res.locals.user.id,orgId,async client=>{
      const body=object(req.body,['role']);
      return (await client.query('SELECT app.mutate_member($1,$2,$3,$4) AS result',[orgId,'update',userId(req.params.userId),role(body.role)])).rows[0].result;
    });
    res.json(result);
  });
  app.delete(base+'/:userId',async(req,res)=>{
    const orgId=uuid(req.params.orgId);
    const result=await owner(res.locals.user.id,orgId,async client=>{
      object(req.body,[]);
      return (await client.query('SELECT app.mutate_member($1,$2,$3,$4) AS result',[orgId,'remove',userId(req.params.userId),null])).rows[0].result;
    });
    res.json(result);
  });
}
