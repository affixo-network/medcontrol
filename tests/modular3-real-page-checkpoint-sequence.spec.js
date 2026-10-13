'use strict';
const {test,expect}=require('@playwright/test');
test('checkpointed legacy state stays aligned with encrypted vault across consecutive synthetic intake changes',async({page})=>{
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.addScriptTag({url:'/tests/modular3-real-page-write-gate.js'});
 const result=await page.evaluate(async()=>{
  const secret='Sequential-Real-Page-Gate-2026';
  const initial={settings:{interfaceLanguage:'ru'},medications:[{id:'synthetic-med',name:'Synthetic'}],intakeLogs:[]};
  await medcontrolOfflineProofAuth.enroll(secret);
  await MedControlOfflineEncryptedBridge.initialize(initial,secret);
  MedControlModular3RealModuleBridge.activate();
  MedControlModular3WriteThroughPreview.start();
  for(let i=0;i<5;i++){
   const next=structuredClone(MedControlModular3RealModuleBridge.read());
   next.intakeLogs.push({id:'event-'+i,action:i%2?'cancelled':'taken'});
   await MedControlModular3WriteThroughPreview.checkpoint(next);
   localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(next));
  }
  const view=JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3'));
  const vault=MedControlModular3RealModuleBridge.read();
  MedControlModular3WriteThroughPreview.stop();
  const legacy=localStorage.getItem('affixo_medcontrol_standard_v3');
  return {viewEvents:view.intakeLogs.length,vaultEvents:vault.intakeLogs.length,matching:JSON.stringify(view)===JSON.stringify(vault),legacy,encrypted:localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1').includes('event-0')};
 });
 expect(result).toEqual({viewEvents:5,vaultEvents:5,matching:true,legacy:null,encrypted:false});
});
