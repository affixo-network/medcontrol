'use strict';
const {test,expect}=require('@playwright/test');
test('encrypted offline checkpoint interruption keeps last committed state and rejects unsafe lock',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 const outcome=await page.evaluate(async()=>{
  const bridge=MedControlOfflineEncryptedBridge,secret='Synthetic-Interrupted-Checkpoint-2026';
  const key='medcontrol_modular3_test_encrypted_state_v1';
  await bridge.initialize({settings:{timezone:'Asia/Yerevan'},medications:[{id:'SYNTH-ORIGINAL'}],intakeLogs:[{id:'SYNTH-TAKEN',action:'taken'}]},secret);
  const previous=localStorage.getItem(key);
  const updated=bridge.read();updated.intakeLogs.push({id:'SYNTH-CANCEL',action:'cancelled'});bridge.write(updated);
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic disk full','QuotaExceededError');return set.call(this,k,v);};
  let failed=false,lockRefused=false;
  try{await bridge.checkpoint();}catch(_){failed=true;}
  try{bridge.lock();}catch(_){lockRefused=true;}
  Storage.prototype.setItem=set;
  const priorStillPresent=localStorage.getItem(key)===previous;
  const dirty=bridge.isDirty();
  await bridge.checkpoint();
  const persisted=localStorage.getItem(key)!==previous;
  bridge.lock();
  return {failed,lockRefused,priorStillPresent,dirty,persisted,plaintext:localStorage.getItem('affixo_medcontrol_standard_v3')};
 });
 expect(outcome).toEqual({failed:true,lockRefused:true,priorStillPresent:true,dirty:true,persisted:true,plaintext:null});
 await page.reload();
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 const recovered=await page.evaluate(async()=>{
  await MedControlOfflineEncryptedBridge.unlock('Synthetic-Interrupted-Checkpoint-2026');
  const state=MedControlOfflineEncryptedBridge.read();
  return {meds:state.medications.length,logs:state.intakeLogs.map(x=>x.action)};
 });
 expect(recovered).toEqual({meds:1,logs:['taken','cancelled']});
 await context.close();
});
test('interrupted encrypted save followed by browser restart recovers prior committed snapshot, not uncommitted changes',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 const result=await page.evaluate(async()=>{
  const bridge=MedControlOfflineEncryptedBridge,secret='Synthetic-Crash-Recovery-2026',key='medcontrol_modular3_test_encrypted_state_v1';
  await bridge.initialize({settings:{timezone:'Asia/Yerevan'},medications:[{id:'SYNTH-PERSISTED'}],intakeLogs:[{id:'SYNTH-PERSISTED-TAKEN',action:'taken'}]},secret);
  const before=localStorage.getItem(key);
  const next=bridge.read();next.intakeLogs.push({id:'SYNTH-UNCOMMITTED',action:'cancelled'});bridge.write(next);
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===key)throw Error('Synthetic interrupted disk write');return set.call(this,k,v);};
  let failed=false;
  try{await bridge.checkpoint();}catch(_){failed=true;}
  Storage.prototype.setItem=set;
  return {failed,priorPreserved:localStorage.getItem(key)===before,dirty:bridge.isDirty()};
 });
 expect(result).toEqual({failed:true,priorPreserved:true,dirty:true});
 await page.reload();
 for(const name of ['modular3-offline-vault.js','modular3-offline-storage-adapter.js','modular3-offline-encrypted-bridge.js'])await page.addScriptTag({url:'/tests/'+name});
 const after=await page.evaluate(async()=>{
  await MedControlOfflineEncryptedBridge.unlock('Synthetic-Crash-Recovery-2026');
  const state=MedControlOfflineEncryptedBridge.read();
  return {meds:state.medications.length,logs:state.intakeLogs.map(x=>x.action)};
 });
 expect(after).toEqual({meds:1,logs:['taken']});
 await context.close();
});
