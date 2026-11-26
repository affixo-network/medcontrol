'use strict';
const {test,expect}=require('@playwright/test');
// Full online/offline four-section journeys require more than the default 45s.
test.setTimeout(180000);
const BASE=process.env.MEDCONTROL_TEST_ORIGIN||'http://127.0.0.1:8765';
const PASS='Synthetic-Four-Sections-2026';
const SOURCE='affixo_medcontrol_standard_v3';
const DEST='medcontrol_modular3_protected_state_v1';
const sample={
 settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',infoDismissed:true},
 medications:[{id:'synthetic-four',name:'Synthetic Four Sections',times:['09:00'],startDate:'2026-10-14',endDate:'2026-10-16'}],
 intakeLogs:[],intakeCorrections:[],archiveHistory:[],timeHistory:[]
};
// Offline assertions start only after the application shell is actually ready.
async function verifiedOfflineShell(page){
 const paths=['/modular3-protected.html','/js/modular3-entry-languages.js','/js/modular3-protected-workspace.js','/js/modular3-protected-session.js'];
 await expect.poll(()=>page.evaluate(async paths=>{
  window.__offlineShellProbe={phase:'registration'};
  const reg=await navigator.serviceWorker.getRegistration('/');
  window.__offlineShellProbe={phase:'cache-open',active:reg?.active?.state||null,controller:navigator.serviceWorker.controller?.state||null};
  const cache=await caches.open(window.MedControlEntryLanguages.cacheName);
  window.__offlineShellProbe.phase='cache-match';
  const assets=await Promise.all(paths.map(path=>cache.match(path)));
  window.__offlineShellProbe.phase='complete';
  return {active:reg?.active?.state||null,controller:navigator.serviceWorker.controller?.state||null,missing:paths.filter((path,index)=>!assets[index]?.ok)};
 },paths),{timeout:45000}).toEqual({active:'activated',controller:'activated',missing:[]});
}
const languages = require('../locales/manifest.json').map(entry => entry.code);
for (const language of languages) {
test('[' + language + '] real protected four-page shell survives an offline restart without exposing plaintext',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',serviceWorkers:'allow'});
 const startupDiagnostics={failedRequests:[],httpErrors:[],consoleErrors:[]};
 context.on('requestfailed',request=>startupDiagnostics.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 context.on('response',response=>{if(response.status()>=400)startupDiagnostics.httpErrors.push({url:response.url(),status:response.status()});});
 context.on('console',message=>{if(message.type()==='error')startupDiagnostics.consoleErrors.push(message.text());});
 const page=await context.newPage();
 await page.addInitScript(({key,data,language})=>{
  if(!localStorage.getItem('medcontrol_modular3_local_credential_v1')&&!localStorage.getItem('medcontrol_modular3_protected_state_v1'))
   localStorage.setItem(key,JSON.stringify({...data,settings:{...data.settings,interfaceLanguage:language}}));
 },{key:SOURCE,data:sample,language});
 await page.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await page.locator('#password').fill(PASS);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#commit-migration').click();
 await expect(page.locator('#entry-language-step')).toBeVisible({timeout:20000});
 await expect(page.locator('#workspace')).toBeHidden();
 await expect(page.locator('#entry-language option[value="'+language+'"]')).toHaveCount(1,{timeout:10000});
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
 try{await verifiedOfflineShell(page);}catch(error){startupDiagnostics.stage='before-guard';startupDiagnostics.probe=await page.evaluate(()=>window.__offlineShellProbe);console.log('OFFLINE_SHELL_DIAGNOSTICS '+language+' '+JSON.stringify(startupDiagnostics));throw error;}
 // Verify the real medical-page guard redirects instead of waiting for a removed form.
 const guarded=await context.newPage();
 await guarded.goto(BASE+'/input.html');
 await expect(guarded).toHaveURL(/\/modular3-protected\.html/);
 await guarded.close();
 // Offline restart uses the same canonical entry and four section tabs.
 try{await verifiedOfflineShell(page);}catch(error){startupDiagnostics.stage='before-offline';startupDiagnostics.probe=await page.evaluate(()=>window.__offlineShellProbe);console.log('OFFLINE_SHELL_DIAGNOSTICS '+language+' '+JSON.stringify(startupDiagnostics));throw error;}
 await page.close();
 await context.setOffline(true);
 const offline=await context.newPage();
 await offline.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await offline.locator('#password').fill(PASS);
 await offline.locator('#unlock').click();
 await expect(offline.locator('#workspace')).toBeVisible({timeout:20000});
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
 const pass='Offline-Create-Verify-2026';
 const seed=await context.newPage();
 await seed.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await seed.evaluate(async password=>{
  const initial={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],timeHistory:[]};
  await window.MedControlModular3ProtectedSession.initialize(initial,password);
 },pass);
 await seed.locator('#password').fill(pass);
 await seed.locator('#unlock').click();
 await expect(seed.locator('#entry-language-step')).toBeVisible();
 await seed.locator('#entry-language').selectOption('ru');
 await seed.locator('#confirm-entry-language').click();
 await seed.locator('#unlock').click();
 await expect(seed.locator('#workspace')).toBeVisible();
 // Warm the service-worker shell before disconnecting the network.
 await expect.poll(()=>seed.evaluate(async()=>{
  const reg=await navigator.serviceWorker.ready;
  return Boolean(reg.active&&navigator.serviceWorker.controller);
 }),{timeout:45000}).toBe(true);
 await seed.close();
 await context.setOffline(true);
 const offline=await context.newPage();
 await offline.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await offline.locator('#password').fill(pass);
 await offline.locator('#unlock').click();
 await expect(offline.locator('#workspace')).toBeVisible({timeout:20000});
 const id='OFFLINE-CREATED-COURSE';
 await offline.evaluate(async id=>{
  await window.MedControlModular3ProtectedSession.transact(state=>{
   state.medications.push({id,name:'Offline created course',active:true,scheduleType:'daily',startDate:'2026-11-10',endDate:'2026-11-12',times:['09:00'],manufacturer:'Synthetic',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'Synthetic test course'});
  });
 },id);
 expect(await offline.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'))).not.toContain('Offline created course');
 await offline.close();
 const reopened=await context.newPage();
 await reopened.goto(BASE+'/modular3-protected.html?rehearsal=1');
 await reopened.locator('#password').fill(pass);
 await reopened.locator('#unlock').click();
 await expect(reopened.locator('#workspace')).toBeVisible({timeout:20000});
 for(const section of ['input','action','dashboard','archive']){
  await reopened.locator('[data-tab="'+section+'"]').click();
  expect(await reopened.evaluate(id=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.id===id),id)).toBe(true);
 }
 await context.close();
});
