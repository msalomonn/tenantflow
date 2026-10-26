import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const origin='http://localhost:4310';
const password='Synthetic-member-browser-123!';
async function signup(request:APIRequestContext,name:string){
 const email=`members-ui-${randomUUID()}@example.test`;
 let r=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data:{name,email,password}});
 if(r.status()===429){
  const seconds=Number(r.headers()['retry-after']??10);expect(seconds).toBeLessThanOrEqual(10);
  await new Promise(resolve=>setTimeout(resolve,(seconds+0.2)*1000));
  r=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data:{name,email,password}});
 }
 expect(r.status()).toBe(200);return {email,id:(await r.json()).user.id};
}
async function org(request:APIRequestContext,name:string){
 const r=await request.post('/api/organizations',{headers:{Origin:origin},data:{name}});expect(r.status()).toBe(201);return (await r.json()).organization.id as string;
}

test('owner manages an existing member; last owner is protected and roles refresh',async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const memberContext=await browser.newContext({baseURL:origin});
 try{
  const teammate=await signup(memberContext.request,'Sam Rivera');
  const owner=await signup(page.request,'Alex Owner');
  await org(page.request,'People Studio');
  await page.goto('/');await page.getByRole('button',{name:'Members',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Members.'})).toBeVisible();
  const ownRow=page.getByRole('listitem',{name:owner.email,exact:true});
  await ownRow.getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Remove member',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('last owner');
  await expect(ownRow).toBeVisible();
  await page.getByLabel('Registered email',{exact:true}).fill(teammate.email);
  await page.getByLabel('New member role',{exact:true}).selectOption('viewer');
  await page.getByRole('button',{name:'Add member',exact:true}).click();
  const row=page.getByRole('listitem',{name:teammate.email,exact:true});
  await expect(row).toBeVisible();
  await expect(row.getByRole('combobox')).toHaveValue('viewer');
  const memberPage=await memberContext.newPage();await memberPage.goto('/');
  await expect(memberPage.getByRole('button',{name:'New project',exact:false})).toBeDisabled();
  await memberPage.getByRole('button',{name:'Members',exact:false}).click();
  await expect(memberPage.getByRole('status')).toContainText('Only organization owners');
  await row.getByRole('combobox').selectOption('member');
  await row.getByRole('button',{name:'Save role',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Role updated.');
  await memberPage.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(memberPage.getByRole('status')).toContainText('Your role is member');
  await memberPage.getByRole('button',{name:'Projects',exact:false}).click();
  await expect(memberPage.getByRole('button',{name:'New project',exact:false})).toBeEnabled();
  await mkdir('docs/screenshots',{recursive:true});
  await page.screenshot({path:`docs/screenshots/members-${info.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await row.getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Remove member',exact:true}).click();
  await expect(row).toHaveCount(0);
  await memberPage.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(memberPage.getByRole('button',{name:'Create your first organization'})).toBeVisible();
  expect(errors).toEqual([]);
 }finally{await memberContext.close();}
});

test('late member list cannot appear in another selected organization',async({page,browser})=>{
 const owner=await signup(page.request,'Race Owner');
 const north=await org(page.request,'Members North');const south=await org(page.request,'Members South');
 const extraContext=await browser.newContext({baseURL:origin});
 const northOnly=await signup(extraContext.request,'North-only member');await extraContext.close();
 const add=await page.request.post(`/api/organizations/${north}/members`,{headers:{Origin:origin},data:{email:northOnly.email,role:'viewer'}});expect(add.status()).toBe(201);
 let release:()=>void=()=>{},started:()=>void=()=>{};
 const gate=new Promise<void>(r=>{release=r;});const requested=new Promise<void>(r=>{started=r;});
 await page.route(`**/api/organizations/${north}/members`,async route=>{
  const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});
 });
 await page.goto('/');await page.getByRole('button',{name:'Members',exact:false}).click();await requested;
 await page.getByLabel('WORKSPACE',{exact:true}).selectOption(south);
 await expect(page.getByText('Manage access to Members South.',{exact:true})).toBeVisible();
 await expect(page.getByRole('listitem',{name:owner.email,exact:true})).toBeVisible();
 release();await page.unrouteAll({behavior:'wait'});
 await expect(page.getByLabel('WORKSPACE',{exact:true})).toHaveValue(south);
 await expect(page.getByRole('listitem')).toHaveCount(1);
 await expect(page.getByRole('listitem',{name:northOnly.email,exact:true})).toHaveCount(0);
});
