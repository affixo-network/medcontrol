'use strict';
const {test,expect}=require('@playwright/test');
const {setup,languages}=require('./functional-p1-fixture.cjs');
const {create,button}=require('./functional-p1-course-helpers.cjs');
for(const {code}of languages)test('P1 all cancelled courses can start a verified new local cycle '+code,async({page},info)=>{
 const h=await setup(page,code),id=await create(page,h,'SYNTHETIC-CANCELLED-CYCLE-'+code);
 await button(page,'openEditMedication',id).click();h.answers.push(true,true,true);await page.locator('[data-medication-cancel]').click();
 await expect.poll(async()=> (await h.medical()).medications[0].cancelled).toBe(true);
 await h.navigate('archive');await button(page,'showArchiveMedicationHistory',id).click();await expect(page.locator('#archiveHistoryDialog')).toBeVisible();await h.surface('cancelled-only-archive');await page.locator('#archiveHistoryDialog button[onclick*=".close()"]').click();
 const before=await h.medical();expect(before.medications[0].rowHistory.some(x=>x.action==='cancelled')).toBe(true);await h.navigate('input');expect(await h.medical()).toEqual(before);
 const reset=page.locator('button[onclick="manualMedControlCycleReset()"]');await expect(reset).toBeVisible();await h.surface('cancelled-cycle-ready');
 const credential=await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_local_credential_v1'));
 await reset.click();expect(await h.medical()).toEqual(before);
 h.answers.push(true);await reset.click();await expect.poll(async()=> (await h.medical()).medications.length).toBe(0);
 for(const records of Object.values(await h.medical()))expect(records).toEqual([]);expect(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_local_credential_v1'))).toBe(credential);
 await create(page,h,'SYNTHETIC-AFTER-CANCEL-'+code);expect((await h.medical()).medications).toHaveLength(1);await h.finish(info);
});
