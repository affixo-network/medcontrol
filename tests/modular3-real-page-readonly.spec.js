'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
test('all four real MedControl pages read synthetic preview and cannot overwrite original storage',async({browser})=>{
 test.setTimeout(120000);
 const context=await browser.newContext({timezoneId:'Asia/Yerevan'});
 const synthetic={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[{id:'synthetic-readonly',name:'Synthetic Preview',active:false,times:['09:00']}],intakeLogs:[]};
 await context.addInitScript(({synthetic})=>{
  const source='affixo_medcontrol_standard_v3';
  const original=Storage.prototype.getItem;
  const saved=localStorage.getItem(source);
  if(saved!==null)throw Error('Unexpected existing user state');
  window.__previewSynthetic=synthetic;
 },{synthetic});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  if(name==='js/auth-guard.js'){
   const mock=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-preview'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mock});
  }
  if(name==='js/storage.js'||name.startsWith('js/storage.js?')){
   const storage=fs.readFileSync(path.join(root,'js/storage.js'),'utf8');
   const adapter=fs.readFileSync(path.join(root,'tests/modular3-real-page-readonly-adapter.js'),'utf8');
   return route.fulfill({status:200,contentType:'application/javascript',body:storage+'\n'+adapter+'\nMedControlModular3RealPageReadOnly.start(window.__previewSynthetic,()=>window.__previewAuthorized!==false);'});
  }
  if(name==='js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* preview cloud disabled */'});
  const file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  const ext=path.extname(file);
  return route.fulfill({status:200,contentType:ext==='.js'?'application/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
 });
 await context.setOffline(true);
 for(const section of ['input','action','dashboard','archive']){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/'+section+'.html');
  await expect(page.locator('body')).toContainText('MedControl',{timeout:20000});
  await page.waitForFunction(()=>typeof window.MedControlModular3RealPageReadOnly==='object'&&window.MedControlModular3RealPageReadOnly.status().active===true,{timeout:20000});
  const state=await page.evaluate(()=>({
   diagnostic:(()=>{try{getState();return 'ok';}catch(e){return {message:e.message,cause:e.cause?.message,authorization:window.__previewAuthorized,adapter:MedControlModular3RealPageReadOnly.status()};}})(),
   view:(()=>{try{return getState().medications.some(m=>m.id==='synthetic-readonly');}catch(_){return false;}})(),
   save:(()=>{try{return saveState({settings:{},medications:[],intakeLogs:[]},{silent:true,skipCloudSnapshot:true});}catch(_){return false;}})(),
   status:MedControlModular3RealPageReadOnly.status()
  }));
  expect(state.diagnostic,section+' storage read diagnosis').toBe('ok');
  expect(state.view,section+' synthetic data').toBe(true);
  expect(state.save,section+' plaintext write rejected').toBe(false);
  expect(state.status.blockedWrites,section+' blocked writes').toBeGreaterThan(0);
  expect(errors,section+' startup runtime errors').toEqual([]);
  const denied=await page.evaluate(()=>{
   window.__previewAuthorized=false;
   try{getState();return false;}catch(_){return true;}
  });
  expect(denied,section+' locked read rejected').toBe(true);
  const lockedWrite=await page.evaluate(()=>saveState({settings:{},medications:[],intakeLogs:[]},{silent:true,skipCloudSnapshot:true}));
  expect(lockedWrite,section+' locked write rejected').toBe(false);
  const unlockedAgain=await page.evaluate(()=>{
   window.__previewAuthorized=true;
   return getState().medications.some(m=>m.id==='synthetic-readonly');
  });
  expect(unlockedAgain,section+' read restored after authorization').toBe(true);
  const raw=await page.evaluate(()=>{
   MedControlModular3RealPageReadOnly.stop();
   return localStorage.getItem('affixo_medcontrol_standard_v3');
  });
  expect(raw,section+' actual persisted storage').toBeNull();
  expect(errors.every(message=>message.includes('MedControl не может прочитать хранилище браузера.')),section+' only expected locked-read errors').toBe(true);
  await page.close();
 }
 await context.close();
});
