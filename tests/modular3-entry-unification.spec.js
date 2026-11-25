'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765';
const PASS='SYNTHETIC-Unified-Entry-2026';
test('device language is not read until password confirmation succeeds',async({page})=>{
 await page.addInitScript(()=>{
  window.__deviceLanguageReads=0;
  Object.defineProperty(navigator,'languages',{configurable:true,get(){window.__deviceLanguageReads++;return ['fil-PH'];}});
  Object.defineProperty(navigator,'language',{configurable:true,get(){window.__deviceLanguageReads++;return 'fil-PH';}});
 });
 await page.goto(BASE+'/modular3-protected.html');
 await expect(page.locator('#enroll')).toBeEnabled();
 await expect(page.locator('#confirm-password-label')).toBeHidden();
 expect(await page.evaluate(()=>window.__deviceLanguageReads)).toBe(0);
 await page.locator('#password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#confirm-password')).toBeVisible();
 expect(await page.evaluate(()=>window.__deviceLanguageReads)).toBe(0);
 await page.locator('#confirm-password').fill(PASS+'-mismatch');await page.locator('#enroll').click();
 expect(await page.evaluate(()=>window.__deviceLanguageReads)).toBe(0);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isUnlocked())).toBe(false);
 await page.locator('#confirm-password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#entry-language-step')).toBeVisible();
 await expect(page.locator('#password').locator('..')).toBeHidden();
 await expect(page.locator('#confirm-password-label')).toBeHidden();
 await expect(page.locator('#legacy-backup').locator('..')).toBeHidden();
 await expect(page.locator('#entry-language')).toHaveValue('fil');
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
});
test('migration restores a confirmed language but still requires explicit entry',async({page})=>{
 // Keep the migration fixture on its intended day; course lifecycle is tested separately.
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
 await page.goto(BASE+'/modular3-protected.html');
 await expect(page.locator('#commit-migration')).toBeEnabled();
 const state={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',languageChoiceConfirmed:true,languageConfirmationVersion:1},medications:[{id:'SYNTHETIC-MIGRATION',name:'SYNTHETIC MIGRATION ONLY',times:['09:00'],active:false,timeStatuses:{'09:00':true},timeStatusHistory:[],startDate:'2026-11-24',endDate:'2026-11-24'}],intakeLogs:[]};
 const raw=JSON.stringify(state);
 await page.evaluate(raw=>localStorage.setItem('affixo_medcontrol_standard_v3',raw),raw);
 await page.locator('#password').fill(PASS);page.once('dialog',d=>d.accept());await page.locator('#commit-migration').click();
 await expect(page.locator('#unlock')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 await page.locator('#unlock').click();await expect(page.locator('.topbar')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('affixo_medcontrol_standard_v3'))).toBe(raw);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(state);
});
