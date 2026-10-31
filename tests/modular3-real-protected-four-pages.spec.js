'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765';
const PASS='Synthetic-Four-Sections-2026';
const SOURCE='affixo_medcontrol_standard_v3';
const DEST='medcontrol_modular3_protected_state_v1';
const sample={
 settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',infoDismissed:true},
 medications:[{id:'synthetic-four',name:'Synthetic Four Sections',times:['09:00'],startDate:'2026-10-14',endDate:'2026-10-16'}],
 intakeLogs:[],intakeCorrections:[],archiveHistory:[],timeHistory:[]
};
const languages = require('../locales/manifest.json').map(entry => entry.code);
for (const language of languages) {
test('[' + language + '] real protected four-page shell survives an offline restart without exposing plaintext',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.addInitScript(({key,data,language})=>{
  if(!localStorage.getItem('medcontrol_modular3_local_credential_v1')&&!localStorage.getItem('medcontrol_modular3_protected_state_v1'))
   localStorage.setItem(key,JSON.stringify({...data,settings:{...data.settings,interfaceLanguage:language}}));
 },{key:SOURCE,data:sample,language});
 await page.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await page.locator('#password').fill(PASS);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#commit-migration').click();
 await expect(page.locator('#workspace')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),DEST)).not.toContain('Synthetic Four Sections');
 await page.close();
 for(const section of ['input','action','dashboard','archive']){
  const p=await context.newPage();
  p.on('dialog',dialog=>dialog.accept(PASS));
  await p.goto(BASE+'/'+section+'.html');
  await p.locator('#localLogin #password').fill(PASS);
  await p.locator('#localLogin #unlock').click();
  await expect(p.locator('#localLogin')).toHaveCount(0,{timeout:20000});
  await expect(p.locator('body')).not.toContainText('Ошибка запуска MedControl',{timeout:20000});
  await expect.poll(()=>p.evaluate(()=>{try{return Boolean(window.MedControlModular3ProtectedSession?.read?.()?.medications?.some(m=>m.id==='synthetic-four'));}catch{return false;}}),{timeout:20000}).toBe(true);
  await p.close();
 }
 // Require a positive acknowledgement from the real service worker before going offline.
 const readiness=await context.newPage();
 readiness.on('dialog',dialog=>dialog.accept(PASS));
 await readiness.goto(BASE+'/input.html');
 await readiness.locator('#localLogin #password').fill(PASS);
 await readiness.locator('#localLogin #unlock').click();
 await expect(readiness.locator('#localLogin')).toHaveCount(0,{timeout:20000});
 await expect.poll(()=>readiness.evaluate(()=>window.medcontrolOfflineShellReady),{timeout:45000}).toBe(true);
 await readiness.close();
 await context.setOffline(true);
 for(const section of ['input','action','dashboard','archive']){
  const p=await context.newPage();
  p.on('dialog',dialog=>dialog.accept(PASS));
  await p.goto(BASE+'/'+section+'.html');
  await p.locator('#localLogin #password').fill(PASS);
  await p.locator('#localLogin #unlock').click();
  await expect(p.locator('#localLogin')).toHaveCount(0,{timeout:20000});
  await expect(p.locator('body')).not.toContainText('Ошибка запуска MedControl',{timeout:20000});
  await expect.poll(async()=>p.evaluate(()=>{try{return !!window.MedControlModular3ProtectedSession.read().medications.find(m=>m.id==='synthetic-four');}catch(e){return false;}}),{timeout:20000}).toBe(true);
  const result=await p.evaluate(({dest,source})=>({state:window.MedControlModular3ProtectedSession.read(),cipher:localStorage.getItem(dest),plaintext:localStorage.getItem(source)}),{dest:DEST,source:SOURCE});
  expect(result.state?.medications?.some(m=>m.id==='synthetic-four')).toBe(true);
  expect(result.cipher).not.toContain('Synthetic Four Sections');
  await p.close();
 }
 await context.close();
});

}
