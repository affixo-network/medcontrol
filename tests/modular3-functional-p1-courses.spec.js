'use strict';
const {test,expect}=require('@playwright/test');
const {setup,languages}=require('./functional-p1-fixture.cjs');
const {create,button}=require('./functional-p1-course-helpers.cjs');
for(const {code}of languages)test('P1 create schedules, edit, passive, cancel, four sections '+code,async({page},info)=>{
 const h=await setup(page,code);const {t,surface,medical,navigate}=h;
 const daily=await create(page,h,'SYNTHETIC-DAILY-'+code,'daily','2026-11-24','2026-11-30',['13','15']);
 const week=await create(page,h,'SYNTHETIC-WEEK-'+code,'weekdays','2026-11-24','2026-11-26');
 const dates=await create(page,h,'SYNTHETIC-DATES-'+code,'explicit_dates','2026-11-24','2026-11-26');
 const initial=await medical();expect(initial.medications).toHaveLength(3);await surface('three-created');
 await button(page,'openEditMedication',daily).click();await expect(page.locator('#editDialog')).toBeVisible();await surface('edit-form');
 await page.locator('#edit_name').fill('SYNTHETIC-EDITED-'+code);await page.locator('#edit_details').fill('Synthetic changed details');await page.locator('#edit_intakeQuantity').fill('2');
 await page.locator("#edit_timesList button[onclick=\"removeStructuredTime('edit_','13:00')\"]").click();await page.locator('#edit_timeHour').selectOption('14');await page.locator('#edit_timeMinute').selectOption('00');await page.locator("#editDialog button[onclick*=\"addStructuredTime('edit_')\"]").click();
 await page.locator('#editDialog button[onclick="saveMedicationEdit(\''+daily+'\')"]').click();await expect(page.locator('#editDialog')).toBeHidden();
 let m=(await medical()).medications.find(m=>m.id===daily);expect(m.name).toBe('SYNTHETIC-EDITED-'+code);expect(m.times).toEqual(['14:00','15:00']);expect(m.intakeQuantity).toBe('2');expect(m.rowHistory.some(e=>e.action==='edited')).toBe(true);
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00.500Z'));
 await button(page,'openEditMedication',daily).click();await page.locator("#edit_timesList button[onclick=\"removeStructuredTime('edit_','15:00')\"]").click();await page.locator('#editDialog button[onclick^="saveMedicationEdit("]').click();await expect(page.locator('#editDialog')).toBeHidden();expect((await medical()).medications.find(m=>m.id===daily).times).toEqual(['14:00']);
 const deleted=page.locator('tr').filter({has:page.locator('button[onclick="showRowHistory(\''+daily+'\')"]')}).filter({hasText:'15:00'});await expect.soft(deleted.locator('td').nth(3)).toHaveText(t('Удалено'));
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:01Z'));
 await button(page,'toggleMedicationMode',daily).click();await expect.poll(async()=> (await medical()).medications.find(m=>m.id===daily).active).toBe(false);await surface('passive');
 const passive=await medical();await navigate('action');expect(await page.locator('button[onclick^="markTaken(\''+daily+'\'"]').count()).toBe(0);expect(await medical()).toEqual(passive);
 await navigate('input');await page.clock.setFixedTime(new Date('2026-11-24T08:00:02Z'));await button(page,'toggleMedicationMode',daily).click();await expect.poll(async()=> (await medical()).medications.find(m=>m.id===daily).active).toBe(true);await surface('reactivated');
 const removed=page.locator('tr').filter({has:page.locator('button[onclick="showRowHistory(\''+daily+'\')"]')}).filter({hasText:'13:00'});await expect.soft(removed.locator('td').nth(3)).toHaveText(t('Заменено')+' → 14:00');
 await page.locator('tr').filter({has:button(page,'openEditMedication',daily)}).locator('button[onclick="showRowHistory(\''+daily+'\')"]').click();await expect(page.locator('#rowHistoryDialog')).toBeVisible();await surface('edited-mode-history');await expect(page.locator('#rowHistoryDialog h2')).toContainText('SYNTHETIC-EDITED-'+code);
 const event=page.locator('#rowHistoryContent tbody tr').filter({hasText:'Synthetic changed details'}).locator('td').nth(1);await expect.soft(event).toHaveText(t('Время ⟦0⟧ заменено').replace('⟦0⟧','1')+'; '+t('Количество приёма')+' '+t('заменено')+'; '+t('Детали')+' '+t('заменены')); const historyRows=await page.locator('#rowHistoryContent tbody tr').allTextContents();
 for(const period of ['today','7','30','all']){await page.locator('#generalHistoryPeriod').selectOption(period);expect(await page.locator('#rowHistoryContent tbody tr').allTextContents()).toEqual(historyRows);await surface('course-history-'+period);}
 await page.locator('#rowHistoryDialog button[onclick*=".close()"]').click();
 const before=await medical();for(const s of ['action','dashboard','archive','input']){await navigate(s);expect(await medical()).toEqual(before);}
 await button(page,'openEditMedication',week).click();await expect(page.locator('#editDialog')).toBeVisible();
 const snapshot=await medical();h.dialogs.length=0;await page.locator('[data-medication-cancel]').click();await expect.poll(()=>h.dialogs.length).toBe(1);expect(await medical()).toEqual(snapshot);
 await button(page,'openEditMedication',week).click();
 h.dialogs.length=0;h.answers.push(true,true,true);await page.locator('[data-medication-cancel]').click();await expect.poll(async()=> (await medical()).medications.find(m=>m.id===week).cancelled).toBe(true);expect(h.dialogs).toHaveLength(3);await surface('cancelled-course');
 await navigate('archive');const row=page.locator('tr').filter({has:page.locator('button[onclick="showArchiveMedicationHistory(\''+week+'\')"]')});await expect(row).toContainText('SYNTHETIC-WEEK-'+code);await row.locator('button').click();await expect(page.locator('#archiveHistoryDialog')).toBeVisible();await surface('cancelled-course-archive-history');
 expect((await medical()).medications.find(m=>m.id===dates).explicitDates).toEqual(['2026-11-24','2026-11-26']);
 await h.finish(info);
});
module.exports={create,button};
