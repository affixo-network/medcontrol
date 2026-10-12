'use strict';
const {test,expect}=require('@playwright/test');
test('isolated encrypted bridge checkpoints synthetic intake history and refuses unsafe lock',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 });
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 await page.evaluate(async()=>{
  const bridge=MedControlOfflineEncryptedBridge;
  await bridge.initialize({settings:{timezone:'Asia/Yerevan'},medications:[],intakeLogs:[]},'Synthetic-Bridge-Password-2026');
  const state=bridge.read();
  state.medications.push({id:'SYNTHETIC-BRIDGE',name:'Secret medication'});
  state.intakeLogs.push({medicationId:'SYNTHETIC-BRIDGE',action:'taken',createdAt:'2026-10-13T05:00:00Z'});
  bridge.write(state);
  let refused=false;try{bridge.lock();}catch(_){refused=true;}
  if(!refused)throw Error('Unsafe lock allowed');
  await bridge.checkpoint();bridge.lock();
  if(localStorage.getItem('affixo_medcontrol_standard_v3'))throw Error('Plaintext production storage modified');
 });
 await context.setOffline(true);await page.reload();
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 const result=await page.evaluate(async()=>{
  const bridge=MedControlOfflineEncryptedBridge;
  let denied=false;try{await bridge.unlock('Wrong-Bridge-Password-2026');}catch(_){denied=true;}
  await bridge.unlock('Synthetic-Bridge-Password-2026');
  const state=bridge.read();
  const raw=localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1');
  return {denied,state,raw};
 });
 expect(result.denied).toBe(true);
 expect(result.state.intakeLogs).toHaveLength(1);
 expect(result.state.medications[0].id).toBe('SYNTHETIC-BRIDGE');
 expect(result.raw).not.toContain('Secret medication');
 expect(result.raw).not.toContain('SYNTHETIC-BRIDGE');
 await context.close();
});

