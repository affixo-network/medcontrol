const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765',PASS='Synthetic-Help-Failure-2026';
test('missing shared help blocks entry and preserves the existing protected pair',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'});
 const keys=['medcontrol_modular3_protected_state_v1','medcontrol_modular3_local_credential_v1'];
 const stored=page=>page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),keys);
 try{
  const page=await context.newPage();await page.goto(BASE+'/modular3-protected.html');await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
  await page.evaluate(async PASS=>{await MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan'},medications:[],intakeLogs:[]},PASS);await MedControlEntryLanguages.confirm(MedControlModular3ProtectedSession,'en');await MedControlModular3ProtectedSession.lock();},PASS);
  const before=await stored(page);expect(before.every(Boolean)).toBe(true);
  await context.route('**/js/modular3-action-help.js*',route=>route.abort());await page.reload();
  await expect.poll(()=>page.evaluate(()=>window.medcontrolProtectedEntryReady)).toBe(false);
  await expect(page.locator('#unlock')).toBeDisabled();await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#retry-entry')).toBeVisible();
  expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 }finally{await context.close();}
});
