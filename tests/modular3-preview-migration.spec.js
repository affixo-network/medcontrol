'use strict';
const {test,expect}=require('@playwright/test');
test('preview migration preserves original, rejects overwrite and wrong password, and survives offline restart',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});await navigator.serviceWorker.ready;});
 await page.reload();
 const outcome=await page.evaluate(async()=>{
  const original={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'migration-1',name:'Synthetic Test 01'}],intakeLogs:[{id:'event-1',action:'taken',actualAt:'2026-10-13T05:00:00Z'}],intakeCorrections:[{id:'correction-1',primaryLogId:'event-1',reason:'accident'}],archivedCourses:[{id:'archived-1',name:'Synthetic Archived'}],timeHistory:[{id:'time-1',action:'changed'}]};
  const key='affixo_medcontrol_standard_v3';
  localStorage.setItem(key,JSON.stringify(original));
  const before=localStorage.getItem(key);
  const result=await MedControlModular3PreviewMigration.migrate('Preview-Migration-Secret-2026');
  let duplicateRejected=false,wrongPasswordRejected=false;
  try{await MedControlModular3PreviewMigration.migrate('Preview-Migration-Secret-2026');}catch(e){duplicateRejected=true;}
  try{await MedControlOfflineStorageAdapter.load('Wrong-Password-2026');}catch(e){wrongPasswordRejected=true;}
  const migrated=await MedControlOfflineStorageAdapter.load('Preview-Migration-Secret-2026');
  return {result,duplicateRejected,wrongPasswordRejected,originalUnchanged:localStorage.getItem(key)===before,allFieldsPreserved:JSON.stringify(migrated)===before};
 });
 expect(outcome).toEqual({result:{medications:1,intakeLogs:1},duplicateRejected:true,wrongPasswordRejected:true,originalUnchanged:true,allFieldsPreserved:true});
 await context.setOffline(true);await page.reload();
 const recovered=await page.evaluate(async()=>{
  const state=await MedControlOfflineStorageAdapter.load('Preview-Migration-Secret-2026');
  return {medications:state.medications.length,intakeLogs:state.intakeLogs.length,corrections:state.intakeCorrections.length,archives:state.archivedCourses.length,timeHistory:state.timeHistory.length,originalPresent:!!localStorage.getItem('affixo_medcontrol_standard_v3')};
 });
 expect(recovered).toEqual({medications:1,intakeLogs:1,corrections:1,archives:1,timeHistory:1,originalPresent:true});
 await context.close();
});
