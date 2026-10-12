'use strict';
const {test,expect}=require('@playwright/test');
test('encrypted offline vault protects synthetic intake history across offline reload and rejects tampering',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 });
 await page.addScriptTag({url:'/tests/modular3-offline-vault.js'});
 const original={medications:[{id:'SYNTHETIC',name:'Synthetic only'}],intakeLogs:[{medicationId:'SYNTHETIC',action:'taken',actual:'2026-10-13T09:00:00.000Z'}]};
 const secret='Synthetic-Vault-Secret-2026';
 const sealed=await page.evaluate(async({original,secret})=>{
  const sealed=await MedControlOfflineVault.seal(original,secret);
  localStorage.setItem('medcontrol_offline_test_vault',JSON.stringify(sealed));
  return sealed;
 },{original,secret});
 expect(JSON.stringify(sealed)).not.toContain('Synthetic only');
 expect(JSON.stringify(sealed)).not.toContain('2026-10-13T09:00:00');
 await context.setOffline(true);
 await page.reload();
 await page.addScriptTag({url:'/tests/modular3-offline-vault.js'});
 const actual=await page.evaluate(async secret=>MedControlOfflineVault.open(JSON.parse(localStorage.getItem('medcontrol_offline_test_vault')),secret),secret);
 expect(actual).toEqual(original);
 const invalid=await page.evaluate(async()=>{
  const record=JSON.parse(localStorage.getItem('medcontrol_offline_test_vault'));
  const wrong=await MedControlOfflineVault.open(record,'incorrect-passphrase-2026').then(()=>false,()=>true);
  const bytes=Uint8Array.from(atob(record.ciphertext),x=>x.charCodeAt(0));bytes[0]^=1;
  record.ciphertext=btoa(String.fromCharCode(...bytes));
  const tampered=await MedControlOfflineVault.open(record,'Synthetic-Vault-Secret-2026').then(()=>false,()=>true);
  return {wrong,tampered};
 });
 expect(invalid).toEqual({wrong:true,tampered:true});
 await context.close();
});
