'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('encrypted real storage transactions survive offline page restart without plaintext persistence',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.addScriptTag({url:'/tests/modular3-real-page-write-gate.js'});
 await page.addScriptTag({url:'/js/storage.js'});
 await page.addScriptTag({url:'/tests/modular3-real-page-transaction.js'});
 const secret='Restart-Real-Transaction-2026';
 await page.evaluate(async secret=>{
  const initial={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'synthetic-restart',name:'Synthetic restart'}],intakeLogs:[]};
  await medcontrolOfflineProofAuth.enroll(secret);
  await MedControlOfflineEncryptedBridge.initialize(initial,secret);
  MedControlModular3RealModuleBridge.activate();
  MedControlModular3WriteThroughPreview.start();
  await MedControlModular3RealPageTransaction.transact(s=>s.intakeLogs.push({id:'taken',action:'taken',actualAt:'2026-10-13T09:00:00Z'}));
  await MedControlModular3RealPageTransaction.transact(s=>s.intakeLogs.push({id:'cancel',action:'cancelled',actualAt:'2026-10-13T09:01:00Z'}));
  MedControlModular3WriteThroughPreview.stop();
  await MedControlModular3RealModuleBridge.close();
  MedControlOfflineEncryptedBridge.lock();
  medcontrolOfflineProofAuth.lock();
 },secret);
 await page.close();
 await context.setOffline(true);
 const restarted=await context.newPage();
 await restarted.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  const name=decodeURIComponent(url.pathname).split('/').filter(Boolean).join('/');
  const file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  const ext=path.extname(file);
  return route.fulfill({status:200,contentType:ext==='.js'?'application/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':'application/octet-stream',body:fs.readFileSync(file)});
 });
 await restarted.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 const result=await restarted.evaluate(async secret=>{
  let wrongRejected=false;
  try{await MedControlOfflineEncryptedBridge.unlock('Definitely-Wrong-Password-2026');}catch(_){wrongRejected=true;}
  const valid=await medcontrolOfflineProofAuth.unlock(secret);
  await MedControlOfflineEncryptedBridge.unlock(secret);
  const state=MedControlOfflineEncryptedBridge.read();
  return {wrongRejected,valid,events:state.intakeLogs.map(x=>x.id),legacy:localStorage.getItem('affixo_medcontrol_standard_v3'),cipher:localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1')};
 },secret);
 expect(result.wrongRejected).toBe(true);
 expect(result.valid).toBe(true);
 expect(result.events).toEqual(['taken','cancel']);
 expect(result.legacy).toBeNull();
 expect(result.cipher).not.toContain('synthetic-restart');
 await context.close();
});
