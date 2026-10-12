'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname,'..');
const guardSource = fs.readFileSync(path.join(ROOT,'js/auth-guard.js'),'utf8');
const loaderSource = fs.readFileSync(path.join(ROOT,'js/modular3-script-loader.js'),'utf8');
const pages=['input','action','dashboard','archive'];

test('unauthenticated user cannot access all four sections', async ({browser}) => {
  const context=await browser.newContext();
  for(const pageName of pages){
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:8765/'+pageName+'.html');
    await expect(page).toHaveURL(/auth-login\.html\?/,{timeout:15000});
    await page.close();
  }
  await context.close();
});

test('isolated authorized shell renders all four sections with mock-only data', async ({browser}) => {
  const context=await browser.newContext();
  const session={access_token:'mock-only-token',refresh_token:'mock-only-refresh',user:{id:'synthetic-e2e-user'},expires_at:Math.floor(Date.now()/1000)+3600};
  await context.addInitScript(({session})=>{
    localStorage.setItem('sb-lewdbjjaohqxbirzhrbm-auth-token',JSON.stringify(session));
    window.__medcontrolE2E=true;
  },{session});
  for(const pageName of pages){
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const req=route.request();
      const url=new URL(req.url());
      if(url.origin!=='http://127.0.0.1:8765')return route.abort();
      if(url.pathname==='/js/auth-guard.js') {
        const mockGuard=guardSource.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:JSON.parse(localStorage.getItem('sb-lewdbjjaohqxbirzhrbm-auth-token'))},error:null})}})})");
        return route.fulfill({status:200,contentType:'application/javascript',body:mockGuard});
      }
      if(url.pathname==='/js/modular3-script-loader.js')return route.fulfill({status:200,contentType:'application/javascript',body:loaderSource});
      if(url.pathname.startsWith('/js/')||url.pathname==='/core.js'){
        const name=url.pathname.split('/').pop();
        if(name==='navigation.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.mount=function(p){document.getElementById("app").textContent="E2E MOUNT "+p};window.fixPreviewNavigation=function(){};'});
        if(name==='archive-page.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.renderArchivePage=function(){document.getElementById("app").textContent="E2E ARCHIVE"};'});
        return route.fulfill({status:200,contentType:'application/javascript',body:'/* mocked app module: no production data access */'});
      }
      return route.continue();
    });
    await page.goto('http://127.0.0.1:8765/'+pageName+'.html');
    if(pageName==='archive')await expect(page.locator('#app')).toHaveText('MedControl');
    else await expect(page.locator('#app')).toHaveText('E2E MOUNT '+pageName);
    expect(errors).toEqual([]);
    await page.close();
  }
  await context.close();
});
