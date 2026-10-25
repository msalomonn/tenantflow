import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';

test('sign up, organize projects, switch tenants, reload and sign in again',async({page},info)=>{
  const email=`morgan-${randomUUID()}@example.test`, password='Synthetic-browser-password-123!';
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Morgan Ellis');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByRole('button',{name:'Create your first organization'}).click();
  await page.getByLabel('Organization name',{exact:true}).fill('North Studio');
  await page.getByRole('dialog').getByRole('button',{name:'Create organization',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Projects.'})).toBeVisible();
  for(const name of ['Website refresh','Brand system','Product discovery']){
    await page.getByRole('button',{name:'New project',exact:false}).click();
    await page.getByLabel('Project name',{exact:true}).fill(name);
    await page.getByRole('dialog').getByRole('button',{name:'Create project',exact:true}).click();
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Create organization',exact:false}).click();
  await page.getByLabel('Organization name',{exact:true}).fill('South Lab');
  await page.getByRole('dialog').getByRole('button',{name:'Create organization',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Make room for your next idea.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Website refresh',exact:true})).toHaveCount(0);
  await page.getByLabel('WORKSPACE',{exact:true}).selectOption({label:'North Studio'});
  await expect(page.getByRole('heading',{name:'Website refresh',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Website refresh',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'Search projects'}).fill('Brand');
  await expect(page.getByRole('heading',{name:'Brand system',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Website refresh',exact:true})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'Search projects'}).fill('');
  await page.getByRole('heading',{name:'Projects.'}).click();
  await mkdir('docs/screenshots',{recursive:true});
  await page.screenshot({path:`docs/screenshots/workspace-${info.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Good to have you back.'})).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Website refresh',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('late project responses never replace the selected organization',async({page})=>{
  const origin='http://localhost:4310';
  const data={name:'Race Test',email:`race-${randomUUID()}@example.test`,password:'Synthetic-browser-password-123!'};
  let signup=await page.request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});
  if(signup.status()===429){
    // Respect the real sign-up limit across desktop/mobile scenarios; never disable it for tests.
    const seconds=Number(signup.headers()['retry-after']??10);
    expect(seconds).toBeLessThanOrEqual(10);
    await new Promise(resolve=>setTimeout(resolve,(seconds+0.2)*1000));
    signup=await page.request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data});
  }
  expect(signup.status()).toBe(200);
  const a=await (await page.request.post('/api/organizations',{headers:{Origin:origin},data:{name:'Race North'}})).json();
  const b=await (await page.request.post('/api/organizations',{headers:{Origin:origin},data:{name:'Race South'}})).json();
  await page.request.post(`/api/organizations/${a.organization.id}/projects`,{headers:{Origin:origin},data:{name:'North-only project'}});
  let release:()=>void=()=>{};
  const gate=new Promise<void>(r=>{release=r;});
  let started:()=>void=()=>{};
  const requested=new Promise<void>(r=>{started=r;});
  await page.route(`**/api/organizations/${a.organization.id}/projects`,async route=>{
    const response=await route.fetch();started();await gate;
    await route.fulfill({response}).catch(()=>{});
  });
  await page.goto('/');await requested;
  await page.getByLabel('WORKSPACE',{exact:true}).selectOption(b.organization.id);
  await expect(page.getByRole('heading',{name:'Make room for your next idea.'})).toBeVisible();
  release();
  await page.unrouteAll({behavior:'wait'});
  await expect(page.getByRole('heading',{name:'North-only project',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('WORKSPACE',{exact:true})).toHaveValue(b.organization.id);
});
