'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765';
const PASS='Synthetic-Empty-UI-2026';
const empty={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'en',languageChoiceConfirmed:true,languageConfirmationVersion:1,infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]};
test.use({locale:'en-US',timezoneId:'Asia/Yerevan'});
async function login(page,initial=empty){
 await page.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
 await page.goto(BASE+'/modular3-protected.html');
 await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 // Encrypted synthetic fixture only; login and section navigation use visible UI.
 await page.evaluate(async({initial,PASS})=>{await MedControlModular3ProtectedSession.initialize(initial,PASS);localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify({synthetic:true,settings:{timezone:'Asia/Yerevan'},medications:[],intakeLogs:[]}));localStorage.setItem('affixo_medcontrol_standard_v3_pre_reset_backup',JSON.stringify({reason:'synthetic_readonly_backup',state:{keep:[0,false,null]}}));await MedControlModular3ProtectedSession.lock();},{initial,PASS});
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
 await expect(page).toHaveURL(BASE+'/input.html');
 await page.waitForFunction(()=>typeof window.getState==='function');
 await expect(page.locator('h1')).toHaveText('MedControl — Input');
}


const source=require('../locales/source-ru.json');
const english=require('../locales/catalogs/en.json').messages;
const ui=text=>english[Object.keys(source).find(id=>source[id].source===text)];
const DATA='medcontrol_modular3_protected_state_v1',CRED='medcontrol_modular3_local_credential_v1';
function fixture(custom){
 const initial=structuredClone(empty),at='2026-11-24T08:00:00.000Z',last='2026-11-24T08:00:02.000Z',plannedAt='2026-11-24T09:00:00.000Z';
 const snapshot={name:'Создано',manufacturer:'Статус',details:'Случайное нажатие',contentValue:'1',contentUnit:custom?'other':'mg',contentUnitOther:custom?'мг':'',intakeQuantity:'1',intakeUnit:custom?'other':'tablet',intakeUnitOther:custom?'таблетка':'',scheduleType:'daily',times:['13:00'],startDate:'2026-11-24',endDate:'2026-11-24',active:true,weekdays:[],explicitDates:[]};
 const med={...snapshot,id:'synthetic-history-only',order:1,dose:'SYNTHETIC ONLY',active:false,courseCompleted:true,archivedCompleted:true,archivedAt:last,timeStatuses:{'13:00':true},timeStatusHistory:[],rowHistory:[{at,action:'created',snapshot:structuredClone(snapshot),changes:structuredClone(snapshot),extraHistory:{keep:[0,false,null]}},{at:last,action:'course_completed',extraHistory:{keep:'preserve'}}]};
 if(!custom)med.rowHistory.splice(1,0,
 {at:'2026-11-24T08:00:00.100Z',action:'edited',changes:{contentUnit:'other',contentUnitOther:'мг',intakeUnit:'other',intakeUnitOther:'таблетка'}},
 {at:'2026-11-24T08:00:00.200Z',action:'edited',changes:{contentUnit:'mg',contentUnitOther:'',intakeUnit:'tablet',intakeUnitOther:''}});
 initial.medications=[med];initial.intakeLogs=[{id:'first',medicationId:med.id,plannedAt,actualAt:at,action:'taken'},{id:'retake',medicationId:med.id,plannedAt,actualAt:last,action:'taken'}];
 initial.intakeCorrections=[{id:'correction',medicationId:med.id,plannedAt,correctedAt:'2026-11-24T08:00:01.000Z',reason:'accident',before:structuredClone(initial.intakeLogs[0]),after:{action:'reset'},extraHistory:{keep:[0,false,null]}}];
 initial.extraMigrationMetadata={keep:[0,false,null,'Случайное нажатие']};return initial;
}
async function storage(page){return page.evaluate(({DATA,CRED})=>({cipher:localStorage.getItem(DATA),credential:localStorage.getItem(CRED),source:localStorage.getItem('affixo_medcontrol_standard_v3'),backup:localStorage.getItem('affixo_medcontrol_standard_v3_pre_reset_backup')}),{DATA,CRED});}
for(const custom of [false,true])test('history localizes typed metadata, preserves source/backups and custom patient values '+custom,async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-24T08:04:00Z'));
 await login(page,fixture(custom));
 await page.locator('.topbar a[href="archive.html"]').click();await expect(page.locator('h1')).toHaveText('MedControl — Archive');
 const before=await page.evaluate(()=>getState()),raw=await storage(page);
 await page.locator('button[onclick="showArchiveMedicationHistory(\'synthetic-history-only\')"]').click();
 await expect(page.locator('#archiveHistoryDialog')).toBeVisible();
 await expect(page.locator('#archiveHistoryTitle')).toHaveText(ui('История курса «⟦0⟧»').replace('⟦0⟧','Создано'));
 const rows=page.locator('#archiveHistoryContent tbody tr'),created=rows.filter({has:page.getByText(ui('Создано'),{exact:true})}).first();
 await expect(created.locator('td').nth(2)).toHaveText('Статус');
 await expect(created.locator('td').nth(3)).toHaveText(custom?'1 мг':'1 '+ui('мг'));
 await expect(created.locator('td').nth(4)).toHaveText(custom?'1 таблетка':'1 '+ui('таблетка'));
 await expect(created.locator('td').nth(5)).toHaveText(ui('Каждый день'));
 await expect(created.locator('td').nth(8)).toHaveText('Случайное нажатие');
 if(!custom){
  const edits=rows.filter({has:page.getByText(ui('Изменено'),{exact:true})});
  await expect(edits).toHaveCount(2);
  await expect(edits.nth(0).locator('td').nth(3)).toHaveText('1 мг');
  await expect(edits.nth(0).locator('td').nth(4)).toHaveText('1 таблетка');
  await expect(edits.nth(1).locator('td').nth(3)).toHaveText('1 '+ui('мг'));
  await expect(edits.nth(1).locator('td').nth(4)).toHaveText('1 '+ui('таблетка'));
 }
 const planned=rows.filter({has:page.getByText(ui('Расчётный приём'),{exact:true})});
 await expect(planned.locator('td').nth(8)).toContainText(ui('Случайное нажатие'));
 for(const period of ['today','7','30','all'])await page.locator('#archiveCourseHistoryPeriod').selectOption(period);
 expect(await storage(page)).toEqual(raw);
 expect(await page.evaluate(()=>getState())).toEqual(before);
});

test('Input history distinguishes custom and predefined unit edits within one displayed minute',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-24T08:04:00Z'));
 const initial=fixture(false),med=initial.medications[0];
 med.active=true;med.courseCompleted=false;med.archivedCompleted=false;delete med.archivedAt;
 med.endDate='2026-11-27';med.rowHistory[0].snapshot.endDate=med.endDate;med.rowHistory[0].changes.endDate=med.endDate;
 med.rowHistory[1].changes.contentUnitOther='мг [custom]';med.rowHistory[1].changes.intakeUnitOther='таблетка [custom]';
 med.rowHistory=med.rowHistory.filter(entry=>entry.action!=='course_completed');
 await login(page,initial);
 const before=await page.evaluate(()=>getState()),raw=await storage(page);
 await page.locator('button[onclick="showRowHistory(\'synthetic-history-only\')"]').click();
 await expect(page.locator('#rowHistoryDialog')).toBeVisible();
 const rows=page.locator('#rowHistoryContent tbody tr');await expect(rows).toHaveCount(3);
 await expect(rows.nth(0).locator('td').nth(4)).toHaveText(ui('мг'));
 await expect(rows.nth(0).locator('td').nth(6)).toHaveText(ui('таблетка'));
 await expect(rows.nth(1).locator('td').nth(4)).toHaveText('мг [custom]');
 await expect(rows.nth(1).locator('td').nth(6)).toHaveText('таблетка [custom]');
 await expect(rows.nth(2).locator('td').nth(4)).toHaveText(ui('мг'));
 await expect(rows.nth(2).locator('td').nth(6)).toHaveText(ui('таблетка'));
 for(const index of [1,2])await expect(rows.nth(index).locator('td').nth(1)).not.toContainText(/[А-Яа-яЁё]/);
 expect(await storage(page)).toEqual(raw);expect(await page.evaluate(()=>getState())).toEqual(before);
});
