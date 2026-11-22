'use strict';
const {test,expect}=require('@playwright/test');
// Full online/offline four-section journeys require more than the default 45s.
test.setTimeout(180000);
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
 await expect(page.locator('#entry-language-step')).toBeVisible();
 await expect(page.locator('#workspace')).toBeHidden();
 await page.locator('#entry-language').selectOption(language);
 await page.locator('#confirm-entry-language').click();
 await page.locator('#unlock').click();
 await expect(page.locator('#workspace')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),DEST)).not.toContain('Synthetic Four Sections');
 // The canonical Modular-3 workspace owns all four sections; medical pages
 // redirect to this entry rather than presenting a second local-login form.
 for(const section of ['input','action','dashboard','archive']){
  await page.locator('[data-tab="'+section+'"]').click();
  await expect(page.locator('#workspace')).toBeVisible();
  expect(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.id==='synthetic-four'))).toBe(true);
 }
 // Verify the real medical-page guard redirects instead of waiting for a removed form.
 const guarded=await context.newPage();
 await guarded.goto(BASE+'/input.html');
 await expect(guarded).toHaveURL(/\/modular3-protected\.html/);
 await guarded.close();
 // Offline restart uses the same canonical entry and four section tabs.
 await page.close();
 await context.setOffline(true);
 const offline=await context.newPage();
 await offline.goto(BASE+'/modular3-protected.html');
 await offline.locator('#password').fill(PASS);
 await offline.locator('#unlock').click();
 await expect(offline.locator('#workspace')).toBeVisible();
 for(const section of ['input','action','dashboard','archive']){
  await offline.locator('[data-tab="'+section+'"]').click();
  expect(await offline.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.id==='synthetic-four'))).toBe(true);
 }
 expect(await offline.evaluate(key=>localStorage.getItem(key),DEST)).not.toContain('Synthetic Four Sections');
 await offline.close();
 await context.close();
});

}

test('real protected input persists a new encrypted course across offline restart',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',serviceWorkers:'allow'});
 const seed=await context.newPage();
 await seed.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await seed.evaluate(key=>localStorage.removeItem(key),SOURCE);
 await seed.evaluate(async()=>{
  const initial={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],timeHistory:[]};
  await window.MedControlModular3ProtectedSession.initialize(initial,'Offline-Create-Verify-2026');
 });
 await seed.close();
 const online=await context.newPage();
 await online.goto(BASE+'/input.html');
 await online.locator('#localLogin #password').fill('Offline-Create-Verify-2026');
 await online.locator('#localLogin #unlock').click();
 await expect(online.locator('#localLogin')).toHaveCount(0);
 await expect.poll(()=>online.evaluate(()=>window.medcontrolOfflineShellReady),{timeout:45000}).toBe(true);
 await online.close();
 await context.setOffline(true);
 const offline=await context.newPage();
 await offline.goto(BASE+'/input.html');
 await offline.locator('#localLogin #password').fill('Offline-Create-Verify-2026');
 await offline.locator('#localLogin #unlock').click();
 await expect(offline.locator('#localLogin')).toHaveCount(0);
 const id='OFFLINE-CREATED-COURSE';
 await offline.evaluate(async id=>{
  await window.MedControlModular3ProtectedSession.transact(state=>{
   state.medications.push({id,name:'Offline created course',active:true,scheduleType:'daily',startDate:'2026-11-10',endDate:'2026-11-12',times:['09:00'],manufacturer:'Synthetic',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'Synthetic test course'});
  });
 },id);
 const ciphertext=await offline.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
 expect(ciphertext).not.toContain('Offline created course');
 await offline.close();
 for(const section of ['input','action','dashboard','archive']){
  const reopened=await context.newPage();
  await reopened.goto(BASE+'/'+section+'.html');
  await reopened.locator('#localLogin #password').fill('Offline-Create-Verify-2026');
  await reopened.locator('#localLogin #unlock').click();
  await expect(reopened.locator('#localLogin')).toHaveCount(0);
  await expect.poll(()=>reopened.evaluate(id=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.id===id),id)).toBe(true);
  await reopened.close();
 }
 await context.close();
});
