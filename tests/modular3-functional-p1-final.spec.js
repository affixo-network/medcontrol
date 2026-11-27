'use strict';
const {test,expect}=require('@playwright/test');
const {setup,languages,BASE,PASS}=require('./functional-p1-fixture.cjs');
const {create,button}=require('./functional-p1-course-helpers.cjs');
test('P1 preserved encrypted import backup blocks local-only reset',async({page},info)=>{
 const h=await setup(page,'en');const id=await create(page,h,'SYNTHETIC-PRESERVED-COPY','daily','2026-11-24','2026-11-24');
 await h.navigate('action');await page.locator('button[onclick^="markTaken(\''+id+'\'"]').first().click();await page.locator('#finalIntakeConfirm').click();await expect(page.locator('#finalIntakeDialog')).toHaveCount(0);await h.navigate('input');
 const backupKey='medcontrol_modular3_preserved_before_import_v1/synthetic-p1';
 const backup=await page.evaluate(key=>{const value=JSON.stringify({format:'medcontrol-protected-preserved-v1',encrypted:JSON.parse(localStorage.getItem('medcontrol_modular3_protected_state_v1')),credential:JSON.parse(localStorage.getItem('medcontrol_modular3_local_credential_v1'))});localStorage.setItem(key,value);return value;},backupKey);
 const before=await h.medical(),raw=await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
 h.answers.push(true);await page.locator('button[onclick="manualMedControlCycleReset()"]').click();await expect.poll(()=>h.dialogs.at(-1)?.type).toBe('alert');
 expect(await h.medical()).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'))).toBe(raw);expect(await page.evaluate(key=>localStorage.getItem(key),backupKey)).toBe(backup);await h.finish(info);
});
test('P1 unknown local origin never bypasses missing cloud inventory',async({page},info)=>{
 const h=await setup(page,'en');const id=await create(page,h,'SYNTHETIC-UNKNOWN-ORIGIN','daily','2026-11-24','2026-11-24');
 await h.navigate('action');await page.locator('button[onclick^="markTaken(\''+id+'\'"]').first().click();await page.locator('#finalIntakeConfirm').click();await expect(page.locator('#finalIntakeDialog')).toHaveCount(0);await h.navigate('input');
 // Model an older/imported vault whose origin was never certified locally.
 await page.evaluate(async()=>{await MedControlModular3ProtectedSession.transact(s=>{delete s.settings.localCycleOrigin;});});
 const before=await h.medical(),raw=await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
 h.answers.push(true);await page.locator('button[onclick="manualMedControlCycleReset()"]').click();await expect.poll(()=>h.dialogs.at(-1)?.type).toBe('alert');
 expect(await h.medical()).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'))).toBe(raw);await h.finish(info);
});
for(const {code}of languages)test('P1 final intake cancel, extend, failed save, retry and new cycle '+code,async({page},info)=>{
 const h=await setup(page,code);const id=await create(page,h,'SYNTHETIC-FINAL-'+code,'daily','2026-11-24','2026-11-24');
 await h.navigate('action');const before=await h.medical();
 const take=()=>page.locator('button[onclick^="markTaken(\''+id+'\'"]').first().click();
 await take();await expect(page.locator('#finalIntakeDialog')).toBeVisible();await h.surface('final-intake');await page.locator('#finalIntakeCancel').click();expect(await h.medical()).toEqual(before);
 await take();await page.locator('#finalIntakeChangeDates').click();await expect(page.locator('#editDialog')).toBeVisible();await h.surface('extend-course');await page.locator('#edit_endDate').fill('2026-11-25');await page.locator('#editDialog button[onclick^="saveMedicationEdit("]').click();await expect(page.locator('#editDialog')).toBeHidden();expect((await h.medical()).intakeLogs).toEqual([]);
 await h.navigate('action');await take();await expect.poll(async()=> (await h.medical()).intakeLogs.length).toBe(1);
 await page.clock.setFixedTime(new Date('2026-11-25T08:00:00Z'));await h.navigate('input');await h.navigate('action');await take();await expect(page.locator('#finalIntakeDialog')).toBeVisible();
 const unchanged=await h.medical();const raw=await page.evaluate(()=>[localStorage.getItem('medcontrol_modular3_protected_state_v1'),localStorage.getItem('medcontrol_modular3_local_credential_v1')]);
 await page.evaluate(()=>{window.__p1NativeStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')throw Error('SYNTHETIC-P1-WRITE');return window.__p1NativeStorage.call(this,k,v);};});
 await page.locator('#finalIntakeConfirm').click();await expect(page.locator('#finalIntakeError')).not.toBeEmpty();await expect(page.locator('#finalIntakeDialog')).toBeVisible();
 expect(await h.medical()).toEqual(unchanged);expect(await page.evaluate(()=>[localStorage.getItem('medcontrol_modular3_protected_state_v1'),localStorage.getItem('medcontrol_modular3_local_credential_v1')])).toEqual(raw);
 const error=await page.locator('#finalIntakeError').innerText();expect.soft(error).toContain(h.t('Приём не сохранён. Повторите действие.'));if(code!=='ru')expect.soft(error).not.toContain('Запись не подтверждена');await h.surface('final-save-failure');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__p1NativeStorage;});await page.locator('#finalIntakeConfirm').click();await expect(page.locator('#finalIntakeDialog')).toHaveCount(0);await expect.poll(async()=> (await h.medical()).medications[0].archivedCompleted).toBe(true);expect((await h.medical()).intakeLogs).toHaveLength(2);
 await h.navigate('archive');await page.locator('button[onclick="showArchiveMedicationHistory(\''+id+'\')"]').click();await expect(page.locator('#archiveHistoryDialog')).toBeVisible();await h.surface('completed-history');await page.locator('#archiveHistoryDialog button[onclick*=".close()"]').click();
 await h.navigate('input');
 // Repeating a course creates a new card while the archived card and facts stay intact.
 const prior=await h.medical();await page.clock.setFixedTime(new Date('2026-11-25T08:00:01Z'));const repeated=await create(page,h,'SYNTHETIC-FINAL-'+code,'daily','2026-11-26','2026-11-27');expect(repeated).not.toBe(id);
 expect((await h.medical()).medications.find(m=>m.id===id)).toEqual(prior.medications.find(m=>m.id===id));expect((await h.medical()).intakeLogs).toEqual(prior.intakeLogs);
 await button(page,'openEditMedication',repeated).click();h.answers.push(true,true,true);await page.locator('[data-medication-cancel]').click();await expect.poll(async()=> (await h.medical()).medications.find(m=>m.id===repeated).cancelled).toBe(true);
 await expect(page.locator('button[onclick="manualMedControlCycleReset()"]')).toBeVisible();const all=await h.medical();
 await page.locator('button[onclick="manualMedControlCycleReset()"]').click();expect(await h.medical()).toEqual(all);
 // A synthetic persisted cloud binding must preserve the original inventory guard.
 const binding='sb-synthetic-p1-auth-token';await page.evaluate(key=>localStorage.setItem(key,'synthetic-test-only'),binding);
 h.answers.push(true);await page.locator('button[onclick="manualMedControlCycleReset()"]').click();
 await expect.poll(()=>h.dialogs.at(-1)?.type).toBe('alert');expect(await h.medical()).toEqual(all);expect(await page.evaluate(key=>localStorage.getItem(key),binding)).toBe('synthetic-test-only');
 await page.evaluate(key=>localStorage.removeItem(key),binding);
 h.answers.push(true);await page.locator('button[onclick="manualMedControlCycleReset()"]').click();await expect.poll(async()=> (await h.medical()).medications.length).toBe(0);
 for(const records of Object.values(await h.medical()))expect(records).toEqual([]);
 expect(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_local_credential_v1'))).toBe(raw[1]);await h.surface('new-cycle-empty');
 await create(page,h,'SYNTHETIC-NEW-CYCLE-'+code,'daily','2026-11-25','2026-11-26');expect((await h.medical()).medications).toHaveLength(1);
 await page.locator('[data-medcontrol-logout]').click();await expect(page.locator('#password')).toBeVisible();await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');await expect(page.locator('html')).toHaveAttribute('lang',code);await expect(page.locator('body')).toContainText('SYNTHETIC-NEW-CYCLE-'+code);
 await h.finish(info);
});
