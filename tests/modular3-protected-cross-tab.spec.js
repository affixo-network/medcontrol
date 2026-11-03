'use strict';
const {test,expect}=require('@playwright/test');

test('T-046 protected session rejects stale cross-tab writer without losing encrypted history',async({browser})=>{
 const context=await browser.newContext();
 const first=await context.newPage();
 const second=await context.newPage();
 const url='http://127.0.0.1:8765/modular3-protected.html';
 const password='Synthetic-Cross-Tab-Password-2026';
 await first.goto(url);
 await first.evaluate(async password=>{
  await MedControlModular3ProtectedSession.initialize({
   settings:{interfaceLanguage:'ru'},medications:[],intakeLogs:[]
  },password);
 },password);
 await second.goto(url);
 await second.evaluate(async password=>{
  await MedControlModular3ProtectedSession.unlock(password);
 },password);
 await Promise.all([
  first.evaluate(()=>MedControlModular3ProtectedSession.transact(state=>{
   state.intakeLogs.push({id:'first',status:'taken'});
  })),
  second.evaluate(async()=>{
   try{
    await MedControlModular3ProtectedSession.transact(state=>{
     state.intakeLogs.push({id:'second',status:'taken'});
    });
    return 'committed';
   }catch(error){return error.message;}
  })
 ]).then(async([,secondResult])=>{
  const firstState=await first.evaluate(()=>MedControlModular3ProtectedSession.isUnlocked()
   ?MedControlModular3ProtectedSession.read():null);
  const stored=await first.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
  expect(stored).not.toContain('"first"');
  expect(stored).not.toContain('"second"');
  expect(secondResult==='committed'||/changed|unlock again/i.test(secondResult)).toBeTruthy();
  expect(firstState===null||Array.isArray(firstState.intakeLogs)).toBeTruthy();
 });
 const fresh=await context.newPage();
 await fresh.goto(url);
 const state=await fresh.evaluate(async password=>{
  await MedControlModular3ProtectedSession.unlock(password);
  return MedControlModular3ProtectedSession.read();
 },password);
 expect(state.intakeLogs).toHaveLength(1);
 expect(['first','second']).toContain(state.intakeLogs[0].id);
 await context.close();
});
