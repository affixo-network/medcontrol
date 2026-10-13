'use strict';
const {test,expect}=require('@playwright/test');
test('opt-in encrypted bridge blocks unauthorized access and preserves production storage',async({page})=>{
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 const result=await page.evaluate(async()=>{
  const sourceKey='affixo_medcontrol_standard_v3';
  const state={settings:{interfaceLanguage:'ru'},medications:[{id:'synthetic-1',name:'Synthetic only'}],intakeLogs:[]};
  localStorage.setItem(sourceKey,JSON.stringify(state));
  const before=localStorage.getItem(sourceKey);
  let refused=false;
  try{MedControlModular3RealModuleBridge.activate();}catch(e){refused=true;}
  await MedControlOfflineEncryptedBridge.initialize(state,'Bridge-Synthetic-Secret-2026');
  await medcontrolOfflineProofAuth.enroll('Bridge-Synthetic-Secret-2026');
  MedControlModular3RealModuleBridge.activate();
  await MedControlModular3RealModuleBridge.update(s=>s.intakeLogs.push({id:'synthetic-log',action:'taken'}));
  const read=MedControlModular3RealModuleBridge.read();
  const encrypted=localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1');
  await MedControlModular3RealModuleBridge.close();
  medcontrolOfflineProofAuth.lock();
  let lockedRejected=false;
  try{MedControlModular3RealModuleBridge.read();}catch(e){lockedRejected=true;}
  return {refused,logs:read.intakeLogs.length,originalUnchanged:localStorage.getItem(sourceKey)===before,ciphertextHasName:encrypted.includes('Synthetic only'),lockedRejected};
 });
 expect(result).toEqual({refused:true,logs:1,originalUnchanged:true,ciphertextHasName:false,lockedRejected:true});
});
