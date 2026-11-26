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
 await page.evaluate(async({initial,PASS})=>{await MedControlModular3ProtectedSession.initialize(initial,PASS);await MedControlModular3ProtectedSession.lock();},{initial,PASS});
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
 await expect(page).toHaveURL(BASE+'/input.html');
}

async function hint(page,action){
 const waiting=page.waitForEvent('dialog');
 const trigger=action();const dialog=await waiting;
 const result={type:dialog.type(),message:dialog.message()};await dialog.accept();await trigger;return result;
}
test('visible focus validation localizes medication amount hint and preserves medical records',async({page})=>{
 await login(page);await expect(page.locator('#create_name')).toBeVisible();
 await page.locator('#create_name').fill('TEST-ONLY-001');
 await page.locator('#create_manufacturer').fill('Synthetic Test');
 const before=await page.evaluate(()=>getState());
 const result=await hint(page,()=>page.locator('#create_contentUnit').focus());
 expect(result).toEqual({type:'alert',message:'Hint\n\nEnter the medication content amount.'});
 await expect(page.locator('#medicationConfirmDialog')).not.toBeVisible();
 const after=await page.evaluate(()=>getState());
 for(const key of ['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses','timeHistory'])expect(after[key]).toEqual(before[key]);
 await expect(page.locator('#create_name')).toHaveValue('TEST-ONLY-001');
});

async function fillConfirmation(page,custom=false){
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
 await login(page);
 for(const [field,value] of Object.entries({name:'Доза',manufacturer:'Статус',contentValue:'1'}))await page.locator('#create_'+field).fill(value);
 await page.locator('#create_contentUnit').selectOption(custom?'other':'mg');
 if(custom)await page.locator('#create_contentUnitOther').fill('мг');
 await page.locator('#create_intakeQuantity').fill('1');
 await page.locator('#create_intakeUnit').selectOption(custom?'other':'tablet');
 if(custom)await page.locator('#create_intakeUnitOther').fill('таблетка');
 await page.locator('#create_details').fill('Производитель');
 await page.locator('#create_timeHour').selectOption('13');await page.locator('#create_timeMinute').selectOption('00');
 await page.locator('button[data-med-sequence-action="add-time"]').click();
 await page.locator('#create_startDate').fill('2026-11-24');await page.locator('#create_endDate').fill('2026-11-25');
 await page.locator('#createMedicationButton').click();await expect(page.locator('#medicationConfirmDialog')).toBeVisible();
}
for(const custom of [false,true])test('confirmation localizes authored labels and preserves patient/custom values '+custom,async({page})=>{
 await fillConfirmation(page,custom);
 const rows=page.locator('#medicationConfirmContent table tr');
 for(const [index,label] of [[1,'Manufacturer'],[2,'Amount of substance contained'],[3,'Dose']])await expect.soft(rows.nth(index).locator('td').first()).toHaveText(label);
 await expect.soft(rows.nth(2).locator('td').last()).toHaveText(custom?'1 мг':'1 mg');
 await expect.soft(rows.nth(3).locator('td').last()).toHaveText(custom?'1 таблетка':'1 tablet');
 await expect.soft(page.locator('#medicationConfirmContent [data-confirm-status] td').first()).toHaveText('Status');
 await expect.soft(page.locator('#medicationConfirmContent [data-confirm-status] td').last()).toHaveText('Active');
 for(const [index,value] of [[0,'Доза'],[1,'Статус'],[4,'Производитель']])await expect(rows.nth(index).locator('td').last()).toHaveText(value);
 expect((await page.evaluate(()=>getState())).medications).toEqual([]);
 await page.locator('#medicationConfirmDialog button[onclick="cancelMedicationCreate()"] ').click();
 await expect(page.locator('#create_name')).toHaveValue('Доза');await expect(page.locator('#create_details')).toHaveValue('Производитель');
});

test('required-field focus sequence localizes all hardcoded field hints without creating a medication',async({page})=>{
 await login(page);
 async function check(target,body){
  const result=await hint(page,()=>page.locator(target).focus());
  expect(result).toEqual({type:'alert',message:'Hint\n\n'+body});
  await page.waitForFunction(()=>!medicationSequenceGuardActive);
  expect((await page.evaluate(()=>getState())).medications).toEqual([]);
 }
 await page.locator('#create_name').fill('SYNTHETIC HINTS ONLY');
 await check('#create_contentUnit','Enter the medication content amount.');
 await page.locator('#create_contentValue').fill('1');
 await check('#create_intakeQuantity','Select a content unit.');
 await page.locator('#create_contentUnit').selectOption('other');
 await check('#create_intakeQuantity','Specify a different content unit.');
 await page.locator('#create_contentUnitOther').fill('мг');
 await check('#create_intakeUnit','Enter the intake quantity.');
 await page.locator('#create_intakeQuantity').fill('1');
 await check('#create_details','Select an intake unit.');
 await page.locator('#create_intakeUnit').selectOption('other');
 await check('#create_details','Specify another intake unit.');
 await page.locator('#create_intakeUnitOther').fill('таблетка');
 await page.locator('#create_details').fill('SYNTHETIC ONLY');
 await page.locator('#create_timeHour').selectOption('13');await page.locator('#create_timeMinute').selectOption('00');
 await page.locator('button[data-med-sequence-action="add-time"]').click();
 await page.locator('#create_startDate').fill('');
 await check('#create_endDate','Start date is required.');
 await page.locator('#create_startDate').fill('2026-11-26');
 const result=await hint(page,()=>page.locator('#createMedicationButton').click());
 expect(result).toEqual({type:'alert',message:'Hint\n\nEnd date is required.'});
 expect((await page.evaluate(()=>getState())).medications).toEqual([]);
 await expect(page.locator('#create_contentUnitOther')).toHaveValue('мг');
 await expect(page.locator('#create_intakeUnitOther')).toHaveValue('таблетка');
});

test('weekday boundary native hints localize templates and date-list conjunction while retaining dates',async({page})=>{
 await fillConfirmation(page);
 await page.locator('#medicationConfirmDialog button[onclick="cancelMedicationCreate()"] ').click();
 await page.locator('#create_scheduleType').selectOption('weekdays');
 await page.locator('input[data-prefix="create_"][data-weekday="Mon"]').check();
 const start=await hint(page,()=>page.locator('#create_startDate').fill('2026-11-24'));
 expect(start.message).toBe('Hint\n\nThe selected start date does not match the days of the week in the schedule. Nearest valid start date: 11/30/2026.');
 const end=await hint(page,()=>page.locator('#create_endDate').fill('2026-11-25'));
 expect(end.message).toBe('Hint\n\nThe selected end date does not match the days of the week in the schedule. Nearest valid dates: 11/23/2026 or 11/30/2026.');
 await expect(page.locator('#create_startDate')).toHaveValue('2026-11-24');
 await expect(page.locator('#create_endDate')).toHaveValue('2026-11-25');
 expect((await page.evaluate(()=>getState())).medications).toEqual([]);
});
