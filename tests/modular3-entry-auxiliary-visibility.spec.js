'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765';
const DATA='medcontrol_modular3_protected_state_v1';
const CRED='medcontrol_modular3_local_credential_v1';
const PASS='Synthetic-Auxiliary-Visibility-2026';
const STATE={settings:{timezone:'Asia/Yerevan'},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]};
test.use({locale:'en-US'});
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
 await page.goto(BASE+'/modular3-protected.html');
 await expect(page.locator('#enroll')).toBeEnabled();
});
async function pair(page){return page.evaluate(({DATA,CRED})=>({cipher:localStorage.getItem(DATA),credential:localStorage.getItem(CRED)}),{DATA,CRED});}
async function pendingLanguage(page){
 await expect(page.locator('#entry-language-step')).toBeVisible();
 await expect(page.locator('#entry-language')).toHaveValue('en');
 await expect(page.locator('#existing-import')).toBeHidden();
 await expect(page.locator('#password')).toBeHidden();
 await expect(page.locator('#confirm-password')).toBeHidden();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
}
test('returning unconfirmed vault hides transfer password only after successful unlock without writes',async({page})=>{
 await page.locator('#password').fill(PASS);await page.locator('#enroll').click();
 await page.locator('#confirm-password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#entry-language-step')).toBeVisible();
 const before=await pair(page);
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 await expect(page.locator('#existing-import')).toBeVisible();
 await page.locator('#password').fill('Incorrect-Synthetic-Password');await page.locator('#unlock').click();
 await expect(page.locator('#message')).toContainText('Неверный пароль.');
 await expect(page.locator('#existing-import')).toBeVisible();expect(await pair(page)).toEqual(before);
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
 await pendingLanguage(page);expect(await pair(page)).toEqual(before);
});
test('migration with confirmed language hides transfer form before explicit Enter and preserves source',async({page})=>{
 const state={...STATE,settings:{...STATE.settings,interfaceLanguage:'en',languageChoiceConfirmed:true,languageConfirmationVersion:1}};
 const source=JSON.stringify(state);
 await page.evaluate(source=>localStorage.setItem('affixo_medcontrol_standard_v3',source),source);
 await page.locator('#password').fill(PASS);page.once('dialog',d=>d.accept());await page.locator('#commit-migration').click();
 await expect(page.locator('#unlock')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#existing-import')).toBeHidden();
 await expect(page.locator('#entry-language-step')).toBeHidden();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 expect(await page.evaluate(()=>localStorage.getItem('affixo_medcontrol_standard_v3'))).toBe(source);
 await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(state);
});
test('visible recovery of interrupted initialization hides transfer form and preserves ciphertext',async({page})=>{
 await page.evaluate(async({STATE,PASS,DATA})=>localStorage.setItem(DATA,JSON.stringify(await MedControlModular3EncryptedVault.seal(STATE,PASS))),{STATE,PASS,DATA});
 await page.reload();await expect(page.locator('#recover')).toBeEnabled();const before=await pair(page);
 expect(before.credential).toBeNull();await expect(page.locator('#existing-import')).toBeVisible();
 await page.locator('#password').fill(PASS);page.once('dialog',d=>d.accept());await page.locator('#recover').click();
 await pendingLanguage(page);const after=await pair(page);
 expect(after.cipher).toBe(before.cipher);expect(after.credential).not.toBeNull();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(STATE);
});
test('failed file password restores the transfer form and retry preserves a downloadable old vault',async({page})=>{
 await page.locator('#password').fill(PASS);await page.locator('#enroll').click();
 await page.locator('#confirm-password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#entry-language-step')).toBeVisible();
 const old=await page.evaluate(()=>MedControlModular3ProtectedSession.read());
 const filePass='Synthetic-Transfer-File-2026';
 const incoming={...STATE,medications:[{id:'synthetic-only',name:'SYNTHETIC IMPORT ONLY',times:['09:00'],active:false,startDate:'2099-01-01',endDate:'2099-01-01'}]};
 const raw=await page.evaluate(async({incoming,filePass})=>JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(incoming,filePass)}),{incoming,filePass});
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();const before=await pair(page);
 await page.locator('#password').fill(PASS);await page.locator('#transfer-password').fill('Incorrect-Synthetic-File-Password');
 await page.locator('#legacy-backup').setInputFiles({name:'synthetic-only.json',mimeType:'application/json',buffer:Buffer.from(raw)});
 await page.locator('#import-backup').click();await expect(page.locator('#message')).toContainText('Импорт не завершён:');
 await expect(page.locator('#existing-import')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isUnlocked())).toBe(false);expect(await pair(page)).toEqual(before);
 await page.locator('#transfer-password').fill(filePass);page.once('dialog',d=>d.accept());await page.locator('#import-backup').click();
 await pendingLanguage(page);await expect(page.locator('#preserved-backups')).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-preserved-backup').click()]);
 const backup=require('node:fs').readFileSync(await download.path(),'utf8');
 expect(JSON.parse(backup).encrypted).toEqual(JSON.parse(before.cipher));
 expect(await page.evaluate(async({backup,PASS})=>MedControlModular3EncryptedVault.open(JSON.parse(backup).encrypted,PASS),{backup,PASS})).toEqual(old);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(incoming);
});
