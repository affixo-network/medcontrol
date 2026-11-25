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
for(const section of ['action','dashboard'])test(section+' localizes the authored empty table placeholder',async({page})=>{
 await login(page);
 await page.locator('.topbar a[href="'+section+'.html"]').click();
 await expect(page.locator('.topbar .nav a.active')).toHaveAttribute('href',section+'.html');
 await expect(page.locator('.wrap td[colspan]').first()).toHaveText('No entries');
 expect(await page.evaluate(()=>getState().medications)).toEqual([]);
});
test('archive localizes all metadata captions and preserves their values',async({page})=>{
 await login(page);await page.locator('.topbar a[href="archive.html"]').click();
 await expect(page.locator('h1')).toHaveText('MedControl — Archive');
 await expect(page.locator('#topCurrentDate').locator('..')).toContainText('Current date:');
 await expect(page.locator('#topCurrentTime').locator('..')).toContainText('Current time:');
 await expect(page.locator('.topbar .meta .pill').filter({hasText:'Asia/Yerevan'})).toContainText('Time zone:');
 await expect(page.locator('#topCurrentDate')).not.toBeEmpty();
});
test('UI localization preserves patient text that matches UI labels and encrypted medical arrays',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
 await login(page);
 await createCourse(page,'Нет записей');
 const initial=await page.evaluate(()=>getState());
 await expect(page.locator('td').filter({hasText:/^Нет записей$/}).first()).toBeVisible();
 for(const section of ['action','dashboard','archive','input']){
  await page.locator('.topbar a[href="'+section+'.html"]').click();
 await expect(page.locator('.topbar .nav a.active')).toHaveAttribute('href',section+'.html');
  const actual=await page.evaluate(()=>getState());
  for(const key of ['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses','timeHistory'])expect(actual[key]).toEqual(initial[key]);
 }
});

async function state(page){return page.evaluate(()=>getState());}
async function createCourse(page, name) {
  for (const [field, value] of Object.entries({name,manufacturer:'Synthetic Factory',contentValue:'1'})) {
    await page.locator('#create_' + field).fill(value);
  }
  await page.locator('#create_contentUnit').selectOption('mg');
  await page.locator('#create_intakeQuantity').fill('1');
  await page.locator('#create_intakeUnit').selectOption('tablet');
  await page.locator('#create_details').fill('Текущая дата:');
  await page.locator('#create_scheduleType').selectOption('daily');
  for (const hour of ['13', '14']) {
    await page.locator('#create_timeHour').selectOption(hour);
    await page.locator('#create_timeMinute').selectOption('00');
    // The existing sequence controller replaces inline handlers with delegated
    // data attributes after rendering. Click the real controller-owned button.
    await page.locator('button[data-med-sequence-action="add-time"]').click();
  }
  await page.locator('#create_startDate').fill('2026-11-24');
  await page.locator('#create_endDate').fill('2026-11-24');
  await page.locator('#createMedicationButton').click();
  await expect(page.locator('#medicationConfirmDialog')).toBeVisible();
  await page.locator('#medicationConfirmDialog button[onclick="proceedMedicationCreateConfirmation()"] ').click();
  await expect(page.locator('#medicationSaveDialog')).toBeVisible();
  await page.locator('#medicationSaveDialog button[onclick="confirmMedicationCreate()"] ').click();
  await expect.poll(async () => (await state(page)).medications.filter(item => item.name === name).length).toBe(1);
  const course = (await state(page)).medications.find(item => item.name === name);
  expect(course.times).toEqual(['13:00','14:00']);
  return course.id;
}
