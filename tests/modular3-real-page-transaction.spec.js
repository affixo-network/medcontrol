'use strict';
const {test,expect}=require('@playwright/test');
test('real getState/saveState transaction coordinates intake and cancellation with encrypted checkpoints',async({page})=>{
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.addScriptTag({url:'/tests/modular3-real-page-write-gate.js'});
 await page.addScriptTag({url:'/js/storage.js'});
 await page.addScriptTag({url:'/tests/modular3-real-page-transaction.js'});
 const result=await page.evaluate(async()=>{
  const secret='Real-Transaction-Synthetic-2026';
  const initial={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'synthetic',name:'Synthetic'}],intakeLogs:[]};
  await medcontrolOfflineProofAuth.enroll(secret);
  await MedControlOfflineEncryptedBridge.initialize(initial,secret);
  MedControlModular3RealModuleBridge.activate();
  MedControlModular3WriteThroughPreview.start();
  await Promise.all([
   MedControlModular3RealPageTransaction.transact(s=>s.intakeLogs.push({id:'take',action:'taken'})),
   MedControlModular3RealPageTransaction.transact(s=>s.intakeLogs.push({id:'cancel',action:'cancelled'}))
  ]);
  const state=getState(),vault=MedControlModular3RealModuleBridge.read();
  MedControlModular3WriteThroughPreview.stop();
  return {events:state.intakeLogs.map(x=>x.id),same:JSON.stringify(state)===JSON.stringify(vault),legacy:localStorage.getItem('affixo_medcontrol_standard_v3')};
 });
 expect(result).toEqual({events:['take','cancel'],same:true,legacy:null});
});
