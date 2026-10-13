'use strict';
const {test,expect}=require('@playwright/test');
test('integrated rehearsal: encrypted migration of synthetic existing MedControl data, offline restart and four sections',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});await navigator.serviceWorker.ready;});
 await page.reload();
 const migrated=await page.evaluate(async()=>{
  const original={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'SYNTH-MIGRATE',name:'Synthetic Migration Medicine',active:true,scheduleType:'daily',startDate:'2026-10-13',endDate:'2026-10-13',times:['09:00']}],intakeLogs:[{medicationId:'SYNTH-MIGRATE',action:'taken',actualAt:'2026-10-13T05:00:00Z'}]};
  const key='affixo_medcontrol_standard_v3',secret='Synthetic-Migration-Password-2026';
  localStorage.setItem(key,JSON.stringify(original));
  const before=localStorage.getItem(key);
  await MedControlOfflineStorageAdapter.save(JSON.parse(before),secret);
  const copy=await MedControlOfflineStorageAdapter.load(secret);
  if(JSON.stringify(copy)!==before)throw Error('Migration roundtrip mismatch');
  if(localStorage.getItem(key)!==before)throw Error('Original MedControl state changed');
  return {medications:copy.medications.length,intakeLogs:copy.intakeLogs.length,sourcePreserved:true};
 });
 expect(migrated).toEqual({medications:1,intakeLogs:1,sourcePreserved:true});
 await context.setOffline(true);await page.reload();
 await page.locator('#passphrase').fill('Synthetic-Migration-Password-2026');
 await page.getByRole('button',{name:'Unlock offline'}).click();
 await expect(page.locator('#sections')).toBeVisible();
 for(const name of ['Ввод','Приём препаратов','Табло','Архив']){
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('#content h2')).toHaveText(name);
 }
 const preserved=await page.evaluate(()=>{
  const state=MedControlOfflineEncryptedBridge.read();
  return {medications:state.medications.length,intakeLogs:state.intakeLogs.length,sourceStillPresent:!!localStorage.getItem('affixo_medcontrol_standard_v3')};
 });
 expect(preserved).toEqual({medications:1,intakeLogs:1,sourceStillPresent:true});
 await context.close();
});
