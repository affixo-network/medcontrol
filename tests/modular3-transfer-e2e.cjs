'use strict';
// Synthetic-only, cross-origin end-to-end test for the MedControl encrypted handoff.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = process.cwd();
const legacyRoot = path.join(ROOT, 'legacy');
const protectedRoot = path.join(ROOT, 'protected');
const ports = { legacy: 18761, protected: 18762 };
const TEST_PASSWORD = 'Synthetic-test-passphrase-2026!';
const original = {
 settings: {timezone:'Asia/Yerevan',interfaceLanguage:'ru'},
 medications:Array.from({length:7},(_,i)=>({
   id:'synthetic-course-'+(i+1),name:'SYNTHETIC_COURSE_'+(i+1),
   times:['12:30'],startDate:'2026-10-05',endDate:'2026-10-12',
   archivedCompleted:true,active:false,
   rowHistory:[{action:'course_completed',at:'2026-10-12T12:31:00+04:00'}]
 })),
 intakeLogs:[{id:'intake-1',medicationId:'synthetic-course-1',action:'taken',plannedAt:'2026-10-12T12:30:00+04:00',actualAt:'2026-10-12T12:31:00+04:00'}],
 intakeCorrections:[{id:'correction-1',medicationId:'synthetic-course-1',reason:'Случайность'}],
 archiveHistory:[{id:'archive-1',medicationId:'synthetic-course-1'}],
 archivedCourses:[{id:'synthetic-course-1'}],
 timeHistory:[{id:'change-1',medicationId:'synthetic-course-1'}]
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function server(root,port){
 return new Promise((resolve,reject)=>{
  const app=http.createServer((req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const relative=path.posix.normalize(pathname).replace(/^\/+/, '');
   const filename=path.resolve(root,relative);
   if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(filename,(err,data)=>{
    if(err){res.writeHead(404).end('Not found: '+relative);return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
   });
  });
  app.once('error',reject);app.listen(port,'127.0.0.1',()=>resolve(app));
 });
}
async function run(){
 let legacy,protectedServer,browser;
 try{
  legacy=await server(legacyRoot,ports.legacy);
  protectedServer=await server(protectedRoot,ports.protected);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow',timezoneId:'UTC'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+ports.legacy+'/transfer-to-modular3.html',{waitUntil:'load'});
  await page.evaluate(data=>localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(data)),original);
  await page.reload();
  await page.locator('#secret').fill(TEST_PASSWORD);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
  const bytes=fs.readFileSync(await download.path(),'utf8');
  assert.equal(bytes.includes('SYNTHETIC_COURSE_1'),false,'Medical names must not appear in transfer file');
  assert.equal(JSON.parse(bytes).format,'medcontrol-encrypted-transfer-v1');
  console.log('PASS 1: encrypted export without plaintext names');
  const protectedUrl='http://127.0.0.1:'+ports.protected+'/modular3-protected.html';
  await page.goto(protectedUrl,{waitUntil:'load'});
  // Reject plaintext files before a vault is created: no partial protected storage.
  await page.locator('#legacy-backup').setInputFiles({
   name:'plaintext-medical-history.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(original))
  });
  await page.locator('#password').fill(TEST_PASSWORD);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-backup').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Encrypted MedControl transfer file required'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_local_credential_v1')),null);
  console.log('PASS 1a: plaintext import refused without creating vault or credentials');
  await page.locator('#legacy-backup').setInputFiles({name:'medcontrol-encrypted-transfer.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await page.locator('#password').fill('Wrong-passphrase-123');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-backup').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Импорт не завершён'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1')),null);
  console.log('PASS 2: incorrect password rejected without writing vault');
  await page.locator('#password').fill(TEST_PASSWORD);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-backup').click();
  await page.locator('#workspace').waitFor({state:'visible',timeout:30000});
  const restored=await page.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  assert.deepEqual(restored,original);
  console.log('PASS 3: seven courses, intake, history and corrections restored exactly');

  // UI parity: all seven archived courses and old events must be accessible.
  await page.locator('[data-tab="archive"]').click();
  assert.equal(await page.locator('#screen article').count(),7,'All seven archived courses must appear in Archive');
  await page.getByRole('button',{name:'Принято',exact:true}).click();
  await page.getByLabel('Период истории').selectOption('all');
  const archiveOne=page.locator('#screen article').filter({hasText:'SYNTHETIC_COURSE_1'});
  await archiveOne.getByText('История событий (1)').waitFor({state:'visible'});
  assert.match(await archiveOne.innerText(),/Принято.*расчётное/);
  await page.getByRole('button',{name:'Свернуть'}).click();
  await page.locator('[data-tab="input"]').click();
  console.log('PASS 3b: seven archived courses visible, historical events selectable for entire period');




  const persistedEntries=await page.evaluate(()=>Object.fromEntries(
   Array.from({length:localStorage.length},(_,i)=>localStorage.key(i))
    .map(key=>[key,localStorage.getItem(key)])
  ));
  for(const [key,value] of Object.entries(persistedEntries)){
   assert.equal(value.includes('SYNTHETIC_COURSE_1'),false,
    'Unencrypted medical course leaked into protected localStorage key '+key);
   assert.equal(value.includes('correction-1'),false,
    'Unencrypted correction history leaked into protected localStorage key '+key);
  }
  assert.ok(persistedEntries.medcontrol_modular3_protected_state_v1,
   'Encrypted vault is missing after import');
  console.log('PASS 3a: no plaintext medication or correction in protected localStorage');

  await page.locator('#lock').click();
  await page.reload();
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read()),original);
  console.log('PASS 4: protected re-login retains all records');
  // Fail explicitly if the service worker cannot control the app before disconnecting.
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:30000});
  const offlineFiles=await page.evaluate(async()=>{
   const cache=await caches.open('medcontrol-static-modular3-v8');
   const paths=['/modular3-protected.html','/js/modular3-encrypted-vault.js',
    '/js/modular3-offline-credential.js','/js/modular3-protected-session.js',
    '/js/modular3-write-boundary.js','/js/modular3-protected-pages.js',
    '/js/modular3-copy-migration.js','/js/modular3-protected-workspace.js'];
   return Promise.all(paths.map(async path=>({path,present:!!(await cache.match(path))})));
  });
  assert.deepEqual(offlineFiles.filter(file=>!file.present),[],'Offline shell incomplete before disconnect');
  await context.setOffline(true);
  await page.locator('#lock').click();
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read()),original);
  console.log('PASS 5: offline reload and local-password unlock');
  await context.setOffline(false);
  const noSource=await context.newPage();
  await noSource.goto('http://127.0.0.1:'+ports.legacy+'/transfer-to-modular3.html');
  assert.deepEqual(await noSource.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3'))),original,'Complete original history must remain unchanged');
  console.log('PASS 6: source courses untouched');
  assert.deepEqual(errors,[],'Unexpected page script errors');
  console.log('PASS 7: no uncaught browser script errors');

  // Regression: a currently active course with an intake log must not appear in Archive.
  await page.evaluate(async()=>{
   await window.MedControlModular3ProtectedSession.transact(state=>{
    state.medications.push({
     id:'ongoing-regression',name:'ONGOING_REGRESSION_COURSE',
     active:true,cancelled:false,archivedCompleted:false,
     times:['12:30'],startDate:'2026-10-05',endDate:'2030-10-12'
    });
    state.intakeLogs.push({
     id:'ongoing-log',medicationId:'ongoing-regression',
     action:'taken',plannedAt:'2026-10-12T12:30:00+04:00',
     actualAt:'2026-10-12T12:31:00+04:00'
    });
   });
  });
  await page.locator('[data-tab="archive"]').click();
  assert.equal(await page.locator('#screen').innerText().then(x=>x.includes('ONGOING_REGRESSION_COURSE')),false,
   'An ongoing medication with prior intake must not appear in Archive');
  assert.equal(await page.locator('#screen').innerText().then(x=>x.includes('SYNTHETIC_COURSE_1')),true,
   'An archived medication must remain visible');
  console.log('PASS 8: Archive excludes ongoing courses even when they have intake history');
  // Midnight boundary: UTC browser with a Yerevan course at 00:15 and 00:45.
  await page.evaluate(async()=>{
   await window.MedControlModular3ProtectedSession.transact(st=>{
    st.medications.push({
     id:'midnight-archive',name:'MIDNIGHT_ARCHIVE_REGRESSION',
     active:false,archivedCompleted:true,cancelled:false,
     startDate:'2026-10-21',endDate:'2026-10-21',scheduleType:'daily',
     times:['00:15','00:45'],rowHistory:[]
    });
    st.intakeLogs.push({
     id:'midnight-taken',medicationId:'midnight-archive',action:'taken',
     plannedAt:'2026-10-20T20:15:00.000Z',actualAt:'2026-10-20T20:16:00.000Z'
    });
   });
  });
  await page.locator('[data-tab="archive"]').click();
  await page.getByRole('button',{name:'Не принято',exact:true}).click();
  await page.getByLabel('Период истории').selectOption('all');
  const midnight=page.locator('#screen article').filter({hasText:'MIDNIGHT_ARCHIVE_REGRESSION'});
  await midnight.waitFor({state:'visible'});
  assert.match(await midnight.innerText(),/20:45/,'Unconfirmed 00:45 Yerevan slot must map to 20:45 UTC on prior day');
  console.log('PASS 8a: Archive missed midnight slot respects MedControl timezone');
  await page.getByRole('button',{name:'Принято',exact:true}).click();
  await page.getByLabel('Период истории').selectOption('all');
  assert.match(await midnight.innerText(),/20:15/,'Taken 00:15 Yerevan slot must map to 20:15 UTC on prior day');
  console.log('PASS 8b: Archive taken midnight slot respects MedControl timezone');

  await page.locator('[data-tab="input"]').click();
  const inputForm=page.locator('#screen form').first();
  await inputForm.locator('[name="date"]').fill('2026-02-28');
  await inputForm.locator('[name="endDate"]').fill('2026-02-28');
  await inputForm.locator('[name="name"]').fill('INVALID_DATE_COURSE');
  await inputForm.locator('[name="first"]').fill('09:00');
  await inputForm.locator('[name="scheduleType"]').selectOption('explicit_dates');
  await inputForm.locator('[name="explicitDates"]').fill('2026-02-31');
  await inputForm.locator('button:not([type])').last().click();
  assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.some(x=>x.name==='INVALID_DATE_COURSE')),false);
  console.log('PASS 3c: nonexistent explicit calendar day rejected');
  await inputForm.locator('[name="name"]').fill('VALID_CALENDAR_DATE_COURSE');
  await inputForm.locator('[name="explicitDates"]').fill('2026-02-28');
  await inputForm.locator('button:not([type])').last().click();
  await page.waitForFunction(()=>window.MedControlModular3ProtectedSession.read().medications.some(x=>x.name==='VALID_CALENDAR_DATE_COURSE'));
  const validCourse=await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.find(x=>x.name==='VALID_CALENDAR_DATE_COURSE'));
  assert.deepEqual(validCourse.explicitDates,['2026-02-28']);
  console.log('PASS 3d: real explicit calendar day accepted and encrypted');

  // Editing an existing course: reject invalid day without changing its encrypted history.
  const editBefore=await page.evaluate(()=>{
   const state=window.MedControlModular3ProtectedSession.read();
   return {
    course:state.medications.find(x=>x.id==='ongoing-regression'),
    intake:state.intakeLogs.find(x=>x.id==='ongoing-log')
   };
  });
  const ongoing=page.locator('#screen article').filter({hasText:'ONGOING_REGRESSION_COURSE'});
  await ongoing.getByText('Изменить будущее расписание курса').click();
  const scheduleEdit=ongoing.locator('details').filter({hasText:'Изменить будущее расписание курса'}).locator('form');
  await scheduleEdit.locator('[name="scheduleType"]').selectOption('explicit_dates');
  await scheduleEdit.locator('[name="explicitDates"]').fill('2026-02-31');
  await scheduleEdit.getByRole('button',{name:'Сохранить расписание'}).click();
  const rejectedEdit=await page.evaluate(()=>{
   const state=window.MedControlModular3ProtectedSession.read();
   return {
    course:state.medications.find(x=>x.id==='ongoing-regression'),
    intake:state.intakeLogs.find(x=>x.id==='ongoing-log')
   };
  });
  assert.deepEqual(rejectedEdit,editBefore,'Invalid schedule edit must preserve course and intake history');
  console.log('PASS 3e: invalid date edit preserves complete existing course and intake');
  await scheduleEdit.locator('[name="explicitDates"]').fill('2026-10-25');
  page.once('dialog',dialog=>dialog.accept());
  await scheduleEdit.getByRole('button',{name:'Сохранить расписание'}).click();
  await page.waitForFunction(()=>{
   const c=window.MedControlModular3ProtectedSession.read().medications.find(x=>x.id==='ongoing-regression');
   return c.scheduleType==='explicit_dates'&&c.explicitDates?.includes('2026-10-25');
  });
  const savedEdit=await page.evaluate(()=>{
   const state=window.MedControlModular3ProtectedSession.read();
   return {course:state.medications.find(x=>x.id==='ongoing-regression'),intake:state.intakeLogs.find(x=>x.id==='ongoing-log')};
  });
  assert.deepEqual(savedEdit.intake,editBefore.intake,'Historical intake must not be overwritten by schedule edit');
  assert.equal(savedEdit.course.rowHistory?.at(-1).action,'schedule_changed');
  assert.deepEqual(savedEdit.course.explicitDates,['2026-10-25']);
  console.log('PASS 3f: valid schedule edit preserved historical intake and recorded schedule change');


  // New lifecycle regression: final intake, encrypted persistence, Archive undo.
  const finalIntake=await page.evaluate(async()=>{
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
   }).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
   const day=parts.year+'-'+parts.month+'-'+parts.day;
   const time=parts.hour+':'+parts.minute;
   const id='final-intake-regression';
   const plannedAt=new Date().toISOString();
   await window.MedControlModular3ProtectedPages.createCourse({
    id,name:'FINAL_INTAKE_REGRESSION',startDate:day,endDate:day,
    times:[time],scheduleType:'daily',active:true,rowHistory:[]
   });
   // A matching time outside the course dates must not write a medical event.
   let refused=false;
   try{
    await window.MedControlModular3ProtectedPages.recordIntake({
     id:'out-of-course-intake',medicationId:id,
     plannedAt:new Date(Date.now()+3*86400000).toISOString(),
     actualAt:new Date().toISOString(),action:'taken'
    });
   }catch(error){refused=String(error.message).includes('Intake outside course dates');}
   if(!refused)throw Error('Out-of-course intake was not rejected');
   if(window.MedControlModular3ProtectedSession.read().intakeLogs.some(x=>x.id==='out-of-course-intake'))
    throw Error('Rejected out-of-course intake was persisted');
   await window.MedControlModular3ProtectedPages.recordIntake({
    id:'final-intake-event',medicationId:id,plannedAt,
    actualAt:new Date().toISOString(),action:'taken'
   });
   const state=window.MedControlModular3ProtectedSession.read();
   return {
    archived:state.medications.find(x=>x.id===id).archivedCompleted,
    count:state.intakeLogs.filter(x=>x.medicationId===id).length
   };
  });
  assert.equal(finalIntake.archived,true,'Final intake must archive course in same encrypted write');
  assert.equal(finalIntake.count,1,'Intake must remain in history');
  console.log('PASS 9: final intake archives within protected transaction');
  await page.reload();
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.find(x=>x.id==='final-intake-regression').archivedCompleted),true);
  console.log('PASS 10: automatic Archive persists across restart');
  await page.locator('[data-tab="dashboard"]').click();
  const dashboardText=await page.locator('#screen').innerText();
  const dashboardDiagnostics=await page.evaluate(()=>{
   const st=window.MedControlModular3ProtectedSession.read();
   return {course:st.medications.find(x=>x.id==='final-intake-regression'),settings:st.settings,localNow:new Date().toString(),timezoneNow:new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yerevan',dateStyle:'full',timeStyle:'long'}).format(new Date())};
  });
  assert.equal(dashboardText.includes('FINAL_INTAKE_REGRESSION'),true,
   'Final intake missing on Dashboard: '+JSON.stringify({dashboardText,dashboardDiagnostics}));
  console.log('PASS 10a: auto-archived final intake remains on today dashboard');
  const tzValidation=await page.evaluate(()=>{
   const st=window.MedControlModular3ProtectedSession.read();
   const event=st.intakeLogs.find(x=>x.id==='final-intake-event');
   const seen=new Intl.DateTimeFormat('en-GB',{timeZone:st.settings.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(event.plannedAt));
   return {zone:st.settings.timezone,courseTime:st.medications.find(x=>x.id==='final-intake-regression').times[0],seen,browserZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  });
  assert.equal(tzValidation.browserZone,'UTC');
  assert.equal(tzValidation.seen,tzValidation.courseTime);
  console.log('PASS 10b: Dashboard honors Asia/Yerevan when browser timezone is UTC');


  await page.evaluate(()=>{window.__medcontrolProtectedArchiveOutcome='taken';});
  await page.locator('[data-tab="archive"]').click();
  const archivedRow=page.locator('article').filter({hasText:'FINAL_INTAKE_REGRESSION'});
  await archivedRow.waitFor({state:'visible'});
  page.once('dialog',dialog=>dialog.accept());
  await archivedRow.getByRole('button',{name:'Отменить «Принято» (случайность)'}).click();
  await page.waitForFunction(()=>{
   const state=window.MedControlModular3ProtectedSession.read();
   return state.medications.find(x=>x.id==='final-intake-regression').archivedCompleted===false;
  });
  const undone=await page.evaluate(()=>{
   const state=window.MedControlModular3ProtectedSession.read();
   return {
    course:state.medications.find(x=>x.id==='final-intake-regression'),
    logs:state.intakeLogs.filter(x=>x.medicationId==='final-intake-regression')
   };
  });
  assert.equal(undone.course.active,true);
  assert.deepEqual(undone.logs.map(x=>x.action),['taken','cancel_taken']);
  await page.reload();
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.find(x=>x.id==='final-intake-regression').active),true);
  console.log('PASS 11: archived accidental intake undo restores active course and history across restart');


 }finally{
  if(browser)await browser.close();
  if(legacy)await new Promise(r=>legacy.close(r));
  if(protectedServer)await new Promise(r=>protectedServer.close(r));
 }
}
run().catch(error=>{console.error('FAIL protected transfer E2E:',error);process.exitCode=1;});
