'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
test('real sections restart offline and preserve synthetic intake history, encrypted vault rejects wrong password',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',locale:'ru-RU'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  const name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(name==='js/auth-guard.js'){
   const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-restart-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
  }
  if(name==='js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.medcontrolCloudSnapshot={validState:s=>!!s&&!!s.settings&&Array.isArray(s.medications)&&Array.isArray(s.intakeLogs),meaningfulState:s=>!!s&&(s.medications.length>0||s.intakeLogs.length>0),latest:async()=>({ok:true,snapshot:null}),restoreLatest:async()=>({ok:false,reason:"synthetic_test_only"})};'});
  const absolute=path.resolve(root,name);
  if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile())return route.abort();
  const ext=path.extname(absolute);
  return route.fulfill({status:200,contentType:ext==='.js'?'application/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':'application/octet-stream',body:fs.readFileSync(absolute)});
 });
 await context.setOffline(true);
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/input.html');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const original=await page.evaluate(()=>{
  const state=getState();
  state.medications.push({id:'OFFLINE-RESTART-SYNTHETIC',name:'Synthetic restart medicine',active:true,times:['09:00'],scheduleType:'daily',startDate:'2026-10-13',endDate:'2026-10-14'});
  state.intakeLogs.push({medicationId:'OFFLINE-RESTART-SYNTHETIC',scheduledAt:'2026-10-13T05:00:00.000Z',action:'taken',createdAt:'2026-10-13T05:05:00.000Z'});
  if(!saveState(state))throw Error('Unable to save test history');
  return getState();
 });
 await page.addScriptTag({url:'/tests/modular3-offline-vault.js'});
 await page.addScriptTag({url:'/tests/modular3-offline-storage-adapter.js'});
 await page.evaluate(async()=>MedControlOfflineStorageAdapter.save(getState(),'Synthetic-Restart-Passphrase-2026'));
 await page.close();
 for(const name of ['input','action','dashboard','archive']){
  const reopened=await context.newPage();
  await reopened.goto('http://127.0.0.1:8765/'+name+'.html');
  if(name==='input')await expect(reopened.locator('#create_name')).toBeVisible({timeout:20000});
  else if(name==='archive')await expect(reopened.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible({timeout:20000});
  else await expect(reopened.locator('body')).toContainText('MedControl',{timeout:20000});
  const actual=await reopened.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')));
  expect(actual.medications.find(m=>m.id==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
  expect(actual.intakeLogs.find(l=>l.medicationId==='OFFLINE-RESTART-SYNTHETIC'&&l.action==='taken')).toBeTruthy();
  await reopened.close();
 }
 const reopened=await context.newPage();
 await reopened.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await reopened.addScriptTag({url:'/tests/modular3-offline-vault.js'});
 await reopened.addScriptTag({url:'/tests/modular3-offline-storage-adapter.js'});
 const result=await reopened.evaluate(async()=>{
  const restored=await MedControlOfflineStorageAdapter.load('Synthetic-Restart-Passphrase-2026');
  const wrongRejected=await MedControlOfflineStorageAdapter.load('Synthetic-Wrong-Passphrase-2026').then(()=>false,()=>true);
  const raw=localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1');
  return {restored,wrongRejected,raw};
 });
 expect(result.restored.medications.find(m=>m.id==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
 expect(result.restored.intakeLogs.find(l=>l.medicationId==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
 expect(result.wrongRejected).toBe(true);
 expect(result.raw).not.toContain('Synthetic restart medicine');
 expect(result.raw).not.toContain('OFFLINE-RESTART-SYNTHETIC');
 await context.close();
});
