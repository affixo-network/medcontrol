'use strict';
const {test,expect}=require('@playwright/test');
// Multiple real encrypted reopen flows and full worker-cache acknowledgment.
test.setTimeout(120000);
const {BASE,openProtected,warmOffline}=require('./modular3-protected-test-fixture.cjs');
test('four real pages consume a decrypted synthetic vault snapshot only inside isolated browser context',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 const external=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==BASE){external.push(route.request().url());return route.abort();}return route.continue();});
 const sample={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[{id:'preview-synthetic',name:'Synthetic Vault Preview',active:false,times:['09:00']}],intakeLogs:[]};
 const page=await context.newPage();
 await page.goto(BASE+'/tests/modular3-offline-access.html');
 const encrypted=await page.evaluate(async({sample})=>await MedControlOfflineVault.seal(sample,'Real-Sections-Preview-2026'),{sample});
 await page.close();
 const decrypted=await (async()=>{
  const verify=await context.newPage();
  await verify.goto(BASE+'/tests/modular3-offline-access.html');
  const result=await verify.evaluate(async({encrypted})=>{
   const original=await MedControlOfflineVault.open(encrypted,'Real-Sections-Preview-2026');
   return JSON.stringify(original);
  },{encrypted});
  await verify.close();
  return result;
 })();
 const seed=await context.newPage();
 await openProtected(seed,'input',JSON.parse(decrypted));
 await warmOffline(seed);await seed.close();
 await context.setOffline(true);
 for(const section of ['input','action','dashboard','archive']){
  const p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await openProtected(p,section);
  await expect(p.locator('body')).toContainText('MedControl',{timeout:20000});
  await expect(p.locator('body')).not.toContainText('Ошибка запуска MedControl');
  const state=await p.evaluate(()=>MedControlModular3ProtectedSession.read());
  expect(state.medications.some(m=>m.id==='preview-synthetic')).toBeTruthy();
  expect(errors,section+' runtime errors').toEqual([]);
  await p.close();
 }
 expect(external).toEqual([]);await context.close();
});
