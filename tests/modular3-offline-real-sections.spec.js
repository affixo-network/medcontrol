'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
const pages=['input','action','dashboard','archive'];
const state={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[]};
test('all four real section interfaces render with browser network disabled, synthetic auth and local-only assets',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 await context.addInitScript(data=>{
  localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(data));
  localStorage.removeItem('sb-lewdbjjaohqxbirzhrbm-auth-token');
 },state);
 const served=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(name==='js/auth-guard.js'){
   const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-offline-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
  }
  if(name==='js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.medcontrolCloudSnapshot={validState:s=>!!s&&!!s.settings&&Array.isArray(s.medications)&&Array.isArray(s.intakeLogs),meaningfulState:s=>!!s&&(s.medications.length>0||s.intakeLogs.length>0),latest:async()=>({ok:true,snapshot:null}),restoreLatest:async()=>({ok:false,reason:"synthetic_test_only"})};'});
  const absolute=path.resolve(root,name);
  if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile())return route.abort();
  served.push(name);
  const ext=path.extname(absolute);
  const type=ext==='.js'?'application/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':'application/octet-stream';
  return route.fulfill({status:200,contentType:type,body:fs.readFileSync(absolute)});
 });
 await context.setOffline(true);
 for(const name of pages){
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/'+name+'.html');
  if(name==='archive'){
   await expect(page.getByRole('heading',{name:'MedControl — Архив'})).toBeVisible({timeout:20000});
   await expect(page.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible();
  }else{
   await expect(page.locator('body')).toContainText('MedControl',{timeout:20000});
   await expect(page.locator('body')).not.toContainText('Ошибка запуска MedControl');
  }
  expect(errors,name+' page errors').toEqual([]);
  const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')));
  expect(actual.medications).toEqual([]);
  expect(actual.intakeLogs).toEqual([]);
  await page.close();
 }
 expect(served).toContain('input.html');
 expect(served).toContain('archive.html');
 await context.close();
});
