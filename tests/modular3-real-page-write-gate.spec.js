'use strict';
const {test,expect}=require('@playwright/test');
test('legacy write gate rejects plaintext save until encrypted checkpoint is verified',async({page})=>{
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.addScriptTag({url:'/tests/modular3-real-page-write-gate.js'});
 const result=await page.evaluate(async()=>{
  const secret='Write-Gate-Synthetic-2026';
  const state={settings:{interfaceLanguage:'ru'},medications:[{id:'synthetic',name:'Synthetic'}],intakeLogs:[]};
  await medcontrolOfflineProofAuth.enroll(secret);
  await MedControlOfflineEncryptedBridge.initialize(state,secret);
  MedControlModular3RealModuleBridge.activate();
  MedControlModular3WriteThroughPreview.start();
  let refused=false;
  try{localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(state));}catch(e){refused=true;}
  const next=structuredClone(state);
  next.intakeLogs.push({id:'synthetic-intake',action:'taken'});
  await MedControlModular3WriteThroughPreview.checkpoint(next);
  localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(next));
  const preview=JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3'));
  MedControlModular3WriteThroughPreview.stop();
  return {refused,previewLogs:preview.intakeLogs.length,raw:localStorage.getItem('affixo_medcontrol_standard_v3'),encrypted:!!localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1')};
 });
 expect(result).toEqual({refused:true,previewLogs:1,raw:null,encrypted:true});
});
