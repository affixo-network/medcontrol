'use strict';
const {test,expect}=require('@playwright/test');
test('real MedControl storage state encrypted and recovered offline without touching live storage key',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 });
 for(const src of ['/js/storage.js','/tests/modular3-offline-vault.js','/tests/modular3-offline-storage-adapter.js'])await page.addScriptTag({url:src});
 const expected=await page.evaluate(async()=>{
  const state=getState();
  state.medications.push({id:'SYNTHETIC-ADAPTER',name:'Confidential synthetic medicine',times:['09:00']});
  state.intakeLogs.push({medicationId:'SYNTHETIC-ADAPTER',action:'taken',scheduledAt:'2026-10-13T05:00:00.000Z'});
  await MedControlOfflineStorageAdapter.save(state,'Adapter-Test-Secret-2026');
  const raw=localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1');
  if(raw.includes('Confidential synthetic medicine')||raw.includes('SYNTHETIC-ADAPTER'))throw Error('Plaintext leaked');
  if(JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')).medications.length!==0)throw Error('Production storage key changed');
  return state;
 });
 await context.setOffline(true);await page.reload();
 for(const src of ['/js/storage.js','/tests/modular3-offline-vault.js','/tests/modular3-offline-storage-adapter.js'])await page.addScriptTag({url:src});
 const result=await page.evaluate(async()=>{
  const restored=await MedControlOfflineStorageAdapter.load('Adapter-Test-Secret-2026');
  const invalid=await MedControlOfflineStorageAdapter.load('Invalid-Test-Secret-2026').then(()=>false,()=>true);
  return {restored,invalid};
 });
 expect(result.restored).toEqual(expected);
 expect(result.invalid).toBe(true);
 await context.close();
});
