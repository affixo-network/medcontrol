'use strict';
const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
const BASE='http://127.0.0.1:8765';const PASS='SYNTHETIC-Fault-Password-2026';const KEY='medcontrol_modular3_protected_state_v1';
async function create(page){
 await page.goto(BASE+'/modular3-protected.html');await expect(page.locator('#enroll')).toBeEnabled();
 await page.locator('#password').fill(PASS);await page.locator('#confirm-password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#entry-language-step')).toBeVisible();
 await expect(page.locator('#confirm-entry-language')).toBeEnabled();
}
test('failed catalog load cannot change encrypted settings or presentation',async({page})=>{
 await create(page);const before=await page.evaluate(key=>localStorage.getItem(key),KEY);const lang=await page.locator('html').getAttribute('lang');
 await page.route('**/locales/catalogs/fr.json',route=>route.fulfill({status:503,body:'SYNTHETIC unavailable'}));
 await page.locator('#entry-language').selectOption('fr');
 await expect(page.locator('#entry-language-hint')).not.toBeEmpty();await expect(page.locator('#confirm-entry-language')).toBeDisabled();
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(before);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 await expect(page.locator('html')).toHaveAttribute('lang',lang);
});
test('failed encrypted language write preserves the existing accessible vault',async({page})=>{
 await create(page);await page.locator('#entry-language').selectOption('fil');await expect(page.locator('#confirm-entry-language')).toBeEnabled();
 const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
 await page.evaluate(key=>{const native=Storage.prototype.setItem;window.__restoreWrite=()=>Storage.prototype.setItem=native;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('SYNTHETIC write failure');return native.call(this,k,v);};},KEY);
 await page.locator('#confirm-entry-language').click();await expect(page.locator('#confirm-entry-language')).toBeEnabled();
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(before);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 await page.evaluate(()=>window.__restoreWrite());await page.locator('#confirm-entry-language').click();await expect(page.locator('#entry-language-step')).toBeHidden();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read().settings.interfaceLanguage)).toBe('fil');expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
});
test('a pending confirmation cannot persist a selector value whose catalog was not prepared',async({page})=>{
 await create(page);await page.locator('#entry-language').selectOption('fr');await expect(page.locator('#confirm-entry-language')).toBeEnabled();
 let release;const held=new Promise(resolve=>release=resolve);let heldRequest=false;
 await page.route('**/locales/catalogs/fr.json',async route=>{heldRequest=true;await held;await route.continue();});
 await page.locator('#confirm-entry-language').click();await expect.poll(()=>heldRequest).toBe(true);await expect(page.locator('#entry-language')).toBeDisabled();
 await page.locator('#entry-language').evaluate(select=>{select.value='ar';select.dispatchEvent(new Event('change',{bubbles:true}));});
 release();await expect(page.locator('#entry-language-step')).toBeHidden();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read().settings.interfaceLanguage)).toBe('fr');await expect(page.locator('html')).toHaveAttribute('lang','fr');expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
});
test('every direct medical URL without a vault uses the canonical entry',async({browser})=>{
 const context=await browser.newContext();try{for(const name of ['input','action','dashboard','archive']){const page=await context.newPage();await page.goto(BASE+'/'+name+'.html');await expect(page).toHaveURL(BASE+'/modular3-protected.html');await expect(page.locator('#password')).toBeVisible();expect(await page.locator('.topbar').count()).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'))).toBeNull();await page.close();}}finally{await context.close();}
});
