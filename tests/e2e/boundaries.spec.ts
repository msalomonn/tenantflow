import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const origin='http://localhost:4310',password='Synthetic-hardening-browser-123!';
async function setup(request:APIRequestContext,name='Session project'){
 const email=`hardening-ui-${randomUUID()}@example.test`;const data={name:'Casey Boundary',email,password};
 let signup=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});
 if(signup.status()===429){const seconds=Number(signup.headers()['retry-after']??10);expect(seconds).toBeLessThanOrEqual(10);await new Promise(r=>setTimeout(r,(seconds+.2)*1000));signup=await request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});}
 expect(signup.status()).toBe(200);
 const org=await request.post('/api/organizations',{headers:{Origin:origin},data:{name:'Boundary Studio'}});expect(org.status()).toBe(201);const organization=(await org.json()).organization.id;
 const result=await request.post(`/api/organizations/${organization}/projects`,{headers:{Origin:origin},data:{name}});expect(result.status()).toBe(201);
 return {email,organization,project:(await result.json()).project.id as string};
}
test('wrong password and a revoked session never retain the project workspace',async({page},info)=>{
 const {email}=await setup(page.request);await page.goto('/');await expect(page.getByRole('heading',{name:'Session project',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill('Incorrect-synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:'Session project',exact:true})).toHaveCount(0);
 await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Edit Session project',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Expired draft');
 // Revoke the real session through the server while the rendered form stays open.
 expect((await page.request.post('/api/auth/sign-out',{headers:{Origin:origin},data:{}})).status()).toBe(200);
 await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('heading',{name:'Good to have you back.'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Session project',exact:true})).toHaveCount(0);await expect(page.getByLabel('WORKSPACE',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`docs/screenshots/hardening-session-${info.project.name}.png`,fullPage:true});
});
test('project names stay inert and invalid drafts are rejected before mutation',async({page},info)=>{
 const name='<img src=x onerror="window.__tfInjected=true">';const {organization,project}=await setup(page.request,name);await page.goto('/');await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();expect(await page.locator('.project-card img').count()).toBe(0);expect(await page.evaluate(()=>Object.hasOwn(window,'__tfInjected'))).toBe(false);
 let writes=0;page.on('request',r=>{if(r.method()==='PATCH'&&r.url().endsWith(`/api/organizations/${organization}/projects/${project}`))writes++;});
 await page.getByRole('button',{name:'Edit '+name,exact:true}).click();
 for(const draft of ['   ','x'.repeat(121)]){await page.getByLabel('Project name',{exact:true}).fill(draft);await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('alert')).toContainText('1 and 120');expect(writes).toBe(0);}
 await page.screenshot({path:`docs/screenshots/hardening-validation-${info.project.name}.png`,fullPage:false});
 await page.getByLabel('Project name',{exact:true}).fill('Validated title');await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('heading',{name:'Validated title',exact:true})).toBeVisible();expect(writes).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
