'use strict';
const {test,expect}=require('@playwright/test');
test('Modular-3 real-path encrypted vault and offline credential survive restart and reject wrong passphrase',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 await page.addScriptTag({url:'/js/modular3-encrypted-vault.js'});
 await page.addScriptTag({url:'/js/modular3-offline-credential.js'});
 const initial={settings:{timezone:'Asia/Yerevan'},medications:[{id:'synthetic-med-1',name:'Synthetic'}],intakeLogs:[{id:'synthetic-log-1',action:'taken',actualAt:'2026-10-13T09:31:00+04:00'}]};
 const first=await page.evaluate(async state=>{
  const secret='synthetic-passphrase-for-testing-only';
  await MedControlModular3OfflineCredential.enroll(secret);
  const sealed=await MedControlModular3EncryptedVault.seal(state,secret);
  localStorage.setItem('modular3_test_vault',JSON.stringify(sealed));
  MedControlModular3OfflineCredential.lock();
  return {sealed,plaintextPresent:localStorage.getItem('modular3_test_vault').includes('Synthetic'),unlocked:MedControlModular3OfflineCredential.isUnlocked()};
 },initial);
 expect(first.plaintextPresent).toBe(false);
 expect(first.unlocked).toBe(false);
 expect(first.sealed.cipher).toBe('AES-256-GCM');
 await page.reload();
 await page.addScriptTag({url:'/js/modular3-encrypted-vault.js'});
 await page.addScriptTag({url:'/js/modular3-offline-credential.js'});
 const result=await page.evaluate(async()=>{
  const record=JSON.parse(localStorage.getItem('modular3_test_vault'));
  const wrong=await MedControlModular3OfflineCredential.unlock('invalid-password-for-test');
  let wrongVault=false;
  try{await MedControlModular3EncryptedVault.open(record,'invalid-password-for-test');}catch(_){wrongVault=true;}
  const good=await MedControlModular3OfflineCredential.unlock('synthetic-passphrase-for-testing-only');
  const restored=await MedControlModular3EncryptedVault.open(record,'synthetic-passphrase-for-testing-only');
  return {wrong,wrongVault,good,restored};
 });
 expect(result.wrong).toBe(false);
 expect(result.wrongVault).toBe(true);
 expect(result.good).toBe(true);
 expect(result.restored).toEqual(initial);
 await context.close();
});
