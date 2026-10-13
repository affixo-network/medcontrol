'use strict';
const {test,expect}=require('@playwright/test');
test('encrypted bridge serializes concurrent synthetic intake events and survives offline reload',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});await navigator.serviceWorker.ready;});
 await page.reload();
 const result=await page.evaluate(async()=>{
  const secret='Concurrent-Encrypted-Bridge-2026';
  const initial={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'synthetic',name:'Synthetic'}],intakeLogs:[]};
  await medcontrolOfflineProofAuth.enroll(secret);
  await MedControlOfflineEncryptedBridge.initialize(initial,secret);
  MedControlModular3RealModuleBridge.activate();
  await Promise.all(Array.from({length:8},(_,i)=>MedControlModular3RealModuleBridge.update(s=>s.intakeLogs.push({id:'event-'+i,action:'taken'}))));
  const state=MedControlModular3RealModuleBridge.read();
  await MedControlModular3RealModuleBridge.close();
  MedControlOfflineEncryptedBridge.lock();
  medcontrolOfflineProofAuth.lock();
  return {logs:state.intakeLogs.length,distinct:new Set(state.intakeLogs.map(x=>x.id)).size,plaintextExposed:localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1').includes('event-0')};
 });
 expect(result).toEqual({logs:8,distinct:8,plaintextExposed:false});
 await context.setOffline(true);
 await page.reload();
 const restored=await page.evaluate(async()=>{
  const secret='Concurrent-Encrypted-Bridge-2026';
  const valid=await medcontrolOfflineProofAuth.unlock(secret);
  await MedControlOfflineEncryptedBridge.unlock(secret);
  MedControlModular3RealModuleBridge.activate();
  return {valid,logs:MedControlModular3RealModuleBridge.read().intakeLogs.length};
 });
 expect(restored).toEqual({valid:true,logs:8});
 await context.close();
});
