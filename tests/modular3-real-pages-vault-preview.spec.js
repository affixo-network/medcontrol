'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
const scripts=['tests/modular3-offline-vault.js','tests/modular3-offline-storage-adapter.js'];
test('four real pages consume a decrypted synthetic vault snapshot only inside isolated browser context',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 const sample={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[{id:'preview-synthetic',name:'Synthetic Vault Preview',active:false,times:['09:00']}],intakeLogs:[]};
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 const encrypted=await page.evaluate(async({sample})=>await MedControlOfflineVault.seal(sample,'Real-Sections-Preview-2026'),{sample});
 await page.close();
 const decrypted=await (async()=>{
  const verify=await context.newPage();
  await verify.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
  const result=await verify.evaluate(async({encrypted})=>{
   const original=await MedControlOfflineVault.open(encrypted,'Real-Sections-Preview-2026');
   return JSON.stringify(original);
  },{encrypted});
  await verify.close();
  return result;
 })();
 await context.addInitScript(({decrypted})=>{
  // Browser init scripts run in frames without guaranteed secure-context Web Crypto.
  // The synthetic preview is decrypted on localhost before offline navigation.
  localStorage.setItem('affixo_medcontrol_standard_v3',decrypted);
  localStorage.removeItem('sb-lewdbjjaohqxbirzhrbm-auth-token');
 },{decrypted});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(name==='js/auth-guard.js'){
   const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-offline-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
  }
  if(name==='js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* test only */'});
  const file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  const ext=path.extname(file);
  return route.fulfill({status:200,contentType:ext==='.js'?'application/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
 });
 await context.setOffline(true);
 for(const section of ['input','action','dashboard','archive']){
  const p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8765/'+section+'.html');
  await expect(p.locator('body')).toContainText('MedControl',{timeout:20000});
  await expect(p.locator('body')).not.toContainText('Ошибка запуска MedControl');
  const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')));
  expect(state.medications.some(m=>m.id==='preview-synthetic')).toBeTruthy();
  expect(errors,section+' runtime errors').toEqual([]);
  await p.close();
 }
 await context.close();
});
