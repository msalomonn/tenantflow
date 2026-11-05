import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const origin='http://localhost:4310';
async function signup(request:APIRequestContext,name='Lifecycle Owner'){
 const email=`lifecycle-ui-${randomUUID()}@example.test`;const data={name,email,password:'Synthetic-project-browser-123!'};
 let r=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});
 if(r.status()===429){const seconds=Number(r.headers()['retry-after']??10);expect(seconds).toBeLessThanOrEqual(10);await new Promise(resolve=>setTimeout(resolve,(seconds+.2)*1000));r=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});}
 expect(r.status()).toBe(200);return {email,id:(await r.json()).user.id};
}
async function org(request:APIRequestContext,name:string){const r=await request.post('/api/organizations',{headers:{Origin:origin},data:{name}});expect(r.status()).toBe(201);return (await r.json()).organization.id as string;}
async function project(request:APIRequestContext,organization:string,name='Original project'){const r=await request.post(`/api/organizations/${organization}/projects`,{headers:{Origin:origin},data:{name}});expect(r.status()).toBe(201);return (await r.json()).project.id as string;}
test('rename project and organization, cancel then archive with persistent feedback',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await signup(page.request);const id=await org(page.request,'Lifecycle Studio');await project(page.request,id);await page.goto('/');
 await page.getByRole('button',{name:'Edit Original project',exact:true}).click();await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Original project');await page.getByLabel('Project name',{exact:true}).fill('Cancelled name');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Original project',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit Original project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('  Release plan  ');await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('heading',{name:'Release plan',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Rename organization',exact:true}).click();await page.getByLabel('Organization name',{exact:true}).fill('Delivery Studio');await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByLabel('WORKSPACE',{exact:true}).locator('option:checked')).toHaveText('Delivery Studio');
 await page.screenshot({path:`docs/screenshots/projects-edited-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Archive Release plan',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('not deleted');await page.screenshot({path:`docs/screenshots/projects-archive-confirm-${info.project.name}.png`,fullPage:false});
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Release plan',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Archive Release plan',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Archive project',exact:true}).click();await expect(page.getByRole('status')).toContainText('Project archived');await expect(page.getByRole('heading',{name:'Release plan',exact:true})).toHaveCount(0);await page.screenshot({path:`docs/screenshots/projects-archived-${info.project.name}.png`,fullPage:true});
 await page.reload();await expect(page.getByRole('heading',{name:'Make room for your next idea.'})).toBeVisible();await expect(page.getByLabel('WORKSPACE',{exact:true}).locator('option:checked')).toHaveText('Delivery Studio');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('edit failure keeps input; concurrent archive and list errors recover',async({page})=>{
 await signup(page.request);const organization=await org(page.request,'Recovery Projects');const id=await project(page.request,organization);const base=`/api/organizations/${organization}/projects`;await page.goto('/');
 await page.getByRole('button',{name:'Edit Original project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Retained draft');
 await page.route('**'+base+'/'+id,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary service interruption. Try again.'})}));
 await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Temporary service');await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Retained draft');await page.unroute('**'+base+'/'+id);
 expect((await page.request.patch(base+'/'+id,{headers:{Origin:origin},data:{archived:true}})).status()).toBe(200);
 await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('archived');await expect(page.getByRole('heading',{name:'Original project',exact:true})).toHaveCount(0);
 await page.route('**'+base,route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Projects temporarily unavailable."}'}));await page.reload();await expect(page.getByRole('alert')).toContainText('temporarily unavailable');await page.unroute('**'+base);await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('heading',{name:'Make room for your next idea.'})).toBeVisible();
});
test('demotion and removal refresh permissions after rejected project edits',async({page,browser})=>{
 const ownerContext=await browser.newContext({baseURL:origin});try{
  await signup(ownerContext.request);const actor=await signup(page.request,'Project Member');const organization=await org(ownerContext.request,'Role Studio');await project(ownerContext.request,organization);
  const members=`/api/organizations/${organization}/members`;expect((await ownerContext.request.post(members,{headers:{Origin:origin},data:{email:actor.email,role:'member'}})).status()).toBe(201);
  await page.goto('/');await expect(page.getByRole('button',{name:'Rename organization',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit Original project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('No longer allowed');expect((await ownerContext.request.patch(members+'/'+actor.id,{headers:{Origin:origin},data:{role:'viewer'}})).status()).toBe(200);
  await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('You have viewer access.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Edit Original project',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Archive Original project',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'New project',exact:false})).toBeDisabled();
  expect((await ownerContext.request.patch(members+'/'+actor.id,{headers:{Origin:origin},data:{role:'member'}})).status()).toBe(200);await page.reload();await page.getByRole('button',{name:'Edit Original project',exact:true}).click();expect((await ownerContext.request.delete(members+'/'+actor.id,{headers:{Origin:origin},data:{}})).status()).toBe(200);await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('button',{name:'Create your first organization',exact:false})).toBeVisible();await expect(page.getByRole('heading',{name:'Original project',exact:true})).toHaveCount(0);
 }finally{await ownerContext.close();}
});
test('a cancelled late edit response cannot affect another workspace',async({page})=>{
 await signup(page.request);const north=await org(page.request,'Edit North'),south=await org(page.request,'Edit South');const id=await project(page.request,north);await project(page.request,south,'South-only project');await page.goto('/');await page.getByRole('button',{name:'Edit Original project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Late north name');
 let release!:()=>void,started!:()=>void;const gate=new Promise<void>(r=>release=r),requested=new Promise<void>(r=>started=r);let cancelled=false;
 page.on('requestfailed',r=>{if(r.url().endsWith('/'+id))cancelled=true;});
 await page.route(`**/api/organizations/${north}/projects/${id}`,async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});});
 try{
  await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await requested;
  // Force a selection change during the modal's pending request to exercise the unmount boundary.
  await page.getByLabel('WORKSPACE',{exact:true}).selectOption(south,{force:true});await expect(page.getByRole('heading',{name:'South-only project',exact:true})).toBeVisible();await expect.poll(()=>cancelled).toBe(true);release();await page.unrouteAll({behavior:'wait'});
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Late north name',exact:true})).toHaveCount(0);await expect(page.getByLabel('WORKSPACE',{exact:true})).toHaveValue(south);
 }finally{release();}
});
