import express from 'express';
import { resolve } from 'node:path';
import { createApplication } from './app.js';
import { configFromEnvironment } from './config.js';
const config=configFromEnvironment();
const instance=createApplication(config);
await instance.assertDatabaseRoles();
let vite:Awaited<ReturnType<typeof import('vite').createServer>>|undefined;
if(config.production) {
  instance.app.use((_req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"); next();});
  instance.app.use(express.static(resolve('dist/web')));
  instance.app.get('/{*splat}',(_req,res)=>res.sendFile(resolve('dist/web/index.html')));
} else {
  const {createServer}=await import('vite');
  vite=await createServer({configFile:resolve('apps/web/vite.config.ts'),server:{middlewareMode:true},appType:'spa'});
  instance.app.use(vite.middlewares);
}
const port=Number(process.env.PORT??4310);
const server=instance.app.listen(port,'127.0.0.1',()=>console.log(`TenantFlow listening at ${config.origin}`));
async function shutdown() { server.close(async()=>{await vite?.close(); await instance.close(); process.exit(0);}); }
process.once('SIGINT',shutdown); process.once('SIGTERM',shutdown);
