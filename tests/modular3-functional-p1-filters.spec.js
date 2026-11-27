'use strict';
const {test,expect}=require('@playwright/test');
const {setup,languages}=require('./functional-p1-fixture.cjs');
const {create,button}=require('./functional-p1-course-helpers.cjs');
const takenDates=['2026-10-20','2026-11-14','2026-11-19','2026-11-23'];
const allPastDates=[];for(let d=new Date('2026-10-20T12:00:00Z');d<new Date('2026-11-24T12:00:00Z');d.setUTCDate(d.getUTCDate()+1))allPastDates.push(d.toISOString().slice(0,10));
for(const {code}of languages)test('P1 actual taken/missed period filters before and after archive '+code,async({page},info)=>{
 const h=await setup(page,code);await page.clock.setFixedTime(new Date('2026-10-20T08:00:00Z'));
 const id=await create(page,h,'SYNTHETIC-FILTER-'+code,'daily','2026-10-20','2026-11-30');
 for(const date of takenDates){await page.clock.setFixedTime(new Date(date+'T08:00:00Z'));await h.navigate('action');await page.locator('button[onclick^="markTaken(\''+id+'\'"]').first().click();await expect.poll(async()=> (await h.medical()).intakeLogs.length).toBe(takenDates.indexOf(date)+1);}
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
 async function filters(prefix){
  const before=await h.medical();
  for(const status of ['taken','missed']){
   await page.locator('#'+prefix+(status==='taken'?'Taken':'Missed')+'Filter').click();
   for(const period of ['yesterday','7','30','all']){
    await page.locator('#'+prefix+'IntakePeriod').selectOption(period);
    const cutoff=period==='7'?'2026-11-18':period==='30'?'2026-10-26':period==='yesterday'?'2026-11-23':null;
    const expected=(status==='taken'?takenDates:allPastDates.filter(d=>!takenDates.includes(d))).filter(d=>!cutoff||d>=cutoff).slice().sort().reverse();
    const rows=page.locator('#'+prefix+'IntakeHistoryContent tbody tr');await expect(rows).toHaveCount(expected.length);
    const formatted=await page.evaluate(ds=>ds.map(d=>formatDate(d)),expected);
    expect(await rows.locator('td:nth-child(3)').allTextContents()).toEqual(formatted);
    await h.surface(prefix+'-'+status+'-'+period);expect(await h.medical()).toEqual(before);
   }
  }
  await page.locator('#'+prefix+'CollapseFilter').click();await expect(page.locator('#'+prefix+'IntakeHistoryContent')).toBeEmpty();
 }
 await h.navigate('action');await filters('action');
 await h.navigate('dashboard');const before=await h.medical();await page.locator('button[onclick^="showIntakeHistory("]').first().click();await expect(page.locator('#intakeHistoryDialog')).toBeVisible();await h.surface('dashboard-history');expect(await h.medical()).toEqual(before);await page.locator('#intakeHistoryDialog button[onclick*=".close()"]').click();
 await h.navigate('input');await button(page,'openEditMedication',id).click();h.answers.push(true,true,true);await page.locator('[data-medication-cancel]').click();await expect.poll(async()=> (await h.medical()).medications[0].cancelled).toBe(true);
 await h.navigate('archive');await filters('archive');
 await button(page,'showArchiveMedicationHistory',id).click();await expect(page.locator('#archiveHistoryDialog')).toBeVisible();await h.surface('archive-full-history');expect((await h.medical()).intakeLogs).toHaveLength(4);
 const journal=page.locator('#archiveHistoryContent tbody tr');const baseline=await journal.allTextContents(),dates=await journal.locator('td:first-child').allTextContents();
 const known=await page.evaluate(ds=>ds.map(day=>({day,label:formatDate(day)})),[...allPastDates,'2026-11-24']);
 const recordDates=dates.map(text=>known.find(x=>text.startsWith(x.label))?.day);expect(recordDates.every(Boolean)).toBe(true);
 for(const period of ['today','7','30','all']){
  const cutoff=period==='today'?'2026-11-24':period==='7'?'2026-11-18':period==='30'?'2026-10-26':null;
  await page.locator('#archiveCourseHistoryPeriod').selectOption(period);
  expect(await journal.allTextContents()).toEqual(baseline.filter((_,i)=>!cutoff||recordDates[i]>=cutoff));await h.surface('archive-modal-period-'+period);
 }

 await h.finish(info);
});
