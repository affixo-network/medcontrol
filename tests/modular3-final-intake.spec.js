'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765',PASS='Synthetic-Final-Intake-Password-2026';
const KEY='medcontrol_modular3_protected_state_v1';
const med={id:'offline-final',order:8,name:'SYNTHETIC FINAL COURSE',manufacturer:'Synthetic',contentValue:'1',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'Synthetic offline test',active:true,scheduleType:'daily',times:['13:00'],timeStatuses:{'13:00':true},timeStatusHistory:[],startDate:'2026-10-24',endDate:'2026-10-24',rowHistory:[{action:'created',at:'2026-10-24T08:00:00Z',snapshot:{active:true,times:['13:00']}}]};
const existing={id:'prior-archive',order:1,name:'SYNTHETIC PRIOR ARCHIVE',active:false,courseCompleted:true,archivedCompleted:true,times:['12:30'],startDate:'2026-10-01',endDate:'2026-10-12',rowHistory:[{action:'created',at:'2026-10-01T01:00:00Z'},{action:'course_completed',at:'2026-10-12T08:30:00Z'}]};
test.use({timezoneId:'Asia/Yerevan'});
async function open(page,override={},section='action'){
 await page.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
 page.on('dialog',d=>d.accept());
 await page.clock.setFixedTime(new Date('2026-10-24T08:58:00Z'));
 await page.goto(BASE+'/modular3-protected.html');
 await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 await page.evaluate(async({PASS,med,existing,override})=>{
  await MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',country:'Armenia',infoDismissed:true},medications:[existing,{...med,...override}],intakeLogs:[{id:'prior-log',medicationId:existing.id,plannedAt:'2026-10-12T08:30:00Z',actualAt:'2026-10-12T08:30:03Z',action:'taken'}],intakeCorrections:[],archiveHistory:[{id:'preserved-archive-event'}],archivedCourses:[],unknownMetadata:{preserve:true}},PASS);
 },{PASS,med,existing,override});
 await page.goto(BASE+'/'+section+'.html');await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
 await expect(page.locator('.nav')).toBeVisible({timeout:15000});
}
async function current(page){return page.evaluate(()=>getState());}
async function clickFinal(page){await page.locator('button[onclick^="markTaken(\'offline-final\'"]').last().click();await expect(page.locator('#finalIntakeDialog')).toBeVisible();}
test('last-dose hint precedes all writes and cancel preserves the complete encrypted state',async({page})=>{
 await open(page);const before=await current(page),raw=await page.evaluate(KEY=>localStorage.getItem(KEY),KEY);
 await clickFinal(page);
 await expect(page.locator('#finalIntakeDialog')).toContainText('Чтобы повторить препарат, измените даты курса');
 expect(await current(page)).toEqual(before);expect(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY)).toBe(raw);
 await page.locator('#finalIntakeCancel').click();await expect(page.locator('#finalIntakeDialog')).toBeHidden();
 expect(await current(page)).toEqual(before);expect(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY)).toBe(raw);
});
test('confirmed final dose waits for encryption then archives in the same write with full history',async({page,context})=>{
 await open(page);const before=await current(page);
 await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true);await context.setOffline(true);
 await clickFinal(page);
 await page.clock.setFixedTime(new Date('2026-10-24T09:00:07Z'));
 await page.evaluate(()=>{
  const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);let release;const gate=new Promise(r=>release=r);window.releaseFinalEncryption=release;
  crypto.subtle.encrypt=async(...args)=>{await gate;return encrypt(...args);};
  const native=Storage.prototype.setItem;window.finalWrites=[];
  Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')window.finalWrites.push(v);return native.call(this,k,v);};
 });
 await page.locator('#finalIntakeConfirm').click();
 await expect(page.locator('#finalIntakeDialog')).toBeVisible();await expect(page.locator('#finalIntakeConfirm')).toBeDisabled();
 expect(await current(page)).toEqual(before);
 await page.evaluate(()=>window.releaseFinalEncryption());
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
 const after=await current(page),course=after.medications.find(x=>x.id===med.id),log=after.intakeLogs.find(x=>x.medicationId===med.id);
 expect(course).toMatchObject({active:false,courseCompleted:true,archivedCompleted:true,archivedAt:'2026-10-24T09:00:07.000Z'});
 expect(log).toMatchObject({action:'taken',plannedAt:'2026-10-24T09:00:00.000Z',actualAt:'2026-10-24T09:00:07.000Z'});
 expect(course.rowHistory).toContainEqual(expect.objectContaining({action:'course_completed',at:log.actualAt}));
 expect(after.medications[0]).toEqual(before.medications[0]);expect(after.archiveHistory).toEqual(before.archiveHistory);expect(after.unknownMetadata).toEqual(before.unknownMetadata);
 const snapshots=await page.evaluate(async PASS=>Promise.all(window.finalWrites.map(v=>MedControlModular3EncryptedVault.open(JSON.parse(v),PASS))),PASS);
 expect(snapshots.length).toBeGreaterThan(0);
 for(const snapshot of snapshots.filter(s=>s.intakeLogs.some(x=>x.medicationId==='offline-final')))expect(snapshot.medications.find(x=>x.id==='offline-final').archivedCompleted).toBe(true);
 await page.locator('.nav a[href="archive.html"]').click();await expect(page.locator('body')).toContainText(med.name);
 await page.evaluate(()=>showArchiveMedicationHistory('offline-final'));await expect(page.locator('#archiveHistoryContent')).toContainText('Курс завершён');
 await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true);
 await context.setOffline(true);await page.reload();await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
 await expect(page.locator('body')).toContainText(med.name,{timeout:15000});
 const restored=await current(page);expect(restored.intakeLogs).toEqual(after.intakeLogs);expect(restored.medications.find(x=>x.id===med.id).archivedCompleted).toBe(true);
});
test('write failure keeps the final-dose dialog open and permits a verified retry',async({page})=>{
 await open(page);const before=await current(page),raw=await page.evaluate(KEY=>localStorage.getItem(KEY),KEY);await clickFinal(page);
 await page.evaluate(()=>{window.nativeFinalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')throw Error('Synthetic final write failure');return window.nativeFinalSet.call(this,k,v);};});
 await page.locator('#finalIntakeConfirm').click();await expect(page.locator('#finalIntakeError')).not.toBeEmpty();
 await expect(page.locator('#finalIntakeDialog')).toBeVisible();expect(await current(page)).toEqual(before);expect(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY)).toBe(raw);
 await page.evaluate(()=>{Storage.prototype.setItem=window.nativeFinalSet;});await page.locator('#finalIntakeConfirm').click();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
});
test('changing dates uses the existing editor and records no intake',async({page})=>{
 await open(page);const logs=(await current(page)).intakeLogs;await clickFinal(page);await page.locator('#finalIntakeChangeDates').click();
 await expect(page.locator('#editDialog')).toBeVisible();await expect(page.locator('#edit_endDate')).toHaveValue('2026-10-24');
 await page.locator('#edit_endDate').fill('2026-10-25');
 await page.locator('#editDialog button[onclick^="saveMedicationEdit("]').click();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').endDate==='2026-10-25');
 expect((await current(page)).intakeLogs).toEqual(logs);
 expect((await current(page)).medications.find(x=>x.id===med.id).archivedCompleted).not.toBe(true);
});
test('nonfinal intake has no completion prompt and leaves the course active',async({page})=>{
 await open(page,{times:['13:00','14:00'],timeStatuses:{'13:00':true,'14:00':true}});
 await page.locator('button[onclick^="markTaken(\'offline-final\'"]').first().click();await page.waitForFunction(()=>getState().intakeLogs.length===2);
 await expect(page.locator('#finalIntakeDialog')).toHaveCount(0);expect((await current(page)).medications.find(x=>x.id===med.id).archivedCompleted).not.toBe(true);
});
test('Archive allows history and reset only, with no repeat or correction actions',async({page})=>{
 await open(page);await clickFinal(page);await page.locator('#finalIntakeConfirm').click();await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
 await page.locator('.nav a[href="archive.html"]').click();const before=await current(page),raw=await page.evaluate(KEY=>localStorage.getItem(KEY),KEY);
 await expect(page.locator('[data-repeat-archived], [data-correct-archived]')).toHaveCount(0);
 const actions=await page.locator('#archiveHistoryContent button, #archiveIntakeHistory button, #archiveMedicationHistory button, [onclick^="showArchive"], [onclick^="setArchiveIntake"], [onclick^="collapseArchiveIntake"], [onclick^="manualMedControlCycleReset"]')
  .evaluateAll(nodes=>nodes.map(node=>node.getAttribute('onclick')||''));
 expect(actions.filter(action=>!/^(showArchive|setArchiveIntake|collapseArchiveIntakeHistory|manualMedControlCycleReset)/.test(action)), 'Unexpected archive button handlers').toEqual([]);
 await page.locator('button[onclick="showArchiveMedicationHistory(\'offline-final\')"]').click();
 await expect(page.locator('#archiveHistoryContent')).toContainText('Курс завершён');
 expect(await current(page)).toEqual(before);expect(await page.evaluate(KEY=>localStorage.getItem(KEY),KEY)).toBe(raw);
});
test('an archived course cannot populate the repeat form through its handler',async({page})=>{
 await open(page);await clickFinal(page);await page.locator('#finalIntakeConfirm').click();await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
 await page.locator('.nav a[href="input.html"]').click();
 const before=await current(page),name=await page.locator('#create_name').inputValue();
 await page.evaluate(()=>repeatCompletedCourse('offline-final'));
 expect(await current(page)).toEqual(before);await expect(page.locator('#create_name')).toHaveValue(name);
 expect(await page.evaluate(()=>window.__repeatCompletedCourseSourceId||null)).toBeNull();
});
test('weekday course archives after its actual last scheduled weekday even if end date is Sunday',async({page})=>{
 await open(page,{scheduleType:'weekdays',weekdays:['Sat'],endDate:'2026-10-25'});await clickFinal(page);await page.locator('#finalIntakeConfirm').click();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
});
test('a disabled later time is excluded when finding the final intake',async({page})=>{
 await open(page,{times:['13:00','14:00'],timeStatuses:{'13:00':true,'14:00':false},timeStatusHistory:[{at:'2026-10-24T08:00:00Z',time:'14:00',active:false}]});await clickFinal(page);await page.locator('#finalIntakeConfirm').click();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
});

test('Escape and duplicate final clicks create no duplicate facts',async({page})=>{
 await open(page);const before=await current(page);await clickFinal(page);await page.keyboard.press('Escape');
 expect(await current(page)).toEqual(before);await clickFinal(page);
 await page.locator('#finalIntakeConfirm').dblclick();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
 expect((await current(page)).intakeLogs.filter(x=>x.medicationId===med.id)).toHaveLength(1);
});
test('explicit-date schedule uses the final selected date',async({page})=>{
 await open(page,{scheduleType:'explicit_dates',explicitDates:['2026-10-23','2026-10-24'],startDate:'',endDate:''});
 await clickFinal(page);await page.locator('#finalIntakeConfirm').click();
 await page.waitForFunction(()=>getState().medications.find(x=>x.id==='offline-final').archivedCompleted===true);
});
