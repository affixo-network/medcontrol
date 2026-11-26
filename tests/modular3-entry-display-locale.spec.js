'use strict';
const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block'});
const BASE=process.env.MEDCONTROL_TEST_ORIGIN||'http://127.0.0.1:8765',PASS='Synthetic-Display-Locale-2026';
const HINT='medcontrol_modular3_entry_display_locale_v1',DATA='medcontrol_modular3_protected_state_v1',CRED='medcontrol_modular3_local_credential_v1';
async function fixture(page,remember=true){
 await page.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort());
 await page.goto(BASE+'/modular3-protected.html');await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 await page.evaluate(async({PASS,remember})=>{
  await MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:'fil',languageChoiceConfirmed:true,languageConfirmationVersion:1,infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]},PASS);
  if(remember)await MedControlEntryLanguages.restore(MedControlModular3ProtectedSession);
  await MedControlModular3ProtectedSession.lock();
 },{PASS,remember});
 return page.evaluate(({DATA,CRED})=>({cipher:localStorage.getItem(DATA),credential:localStorage.getItem(CRED)}),{DATA,CRED});
}
async function pair(page){return page.evaluate(({DATA,CRED})=>({cipher:localStorage.getItem(DATA),credential:localStorage.getItem(CRED)}),{DATA,CRED});}
test('returning page uses Filipino before password without changing encrypted pair',async({page})=>{
 const raw=await fixture(page);await page.addInitScript(()=>{window.__lockedCachePuts=0;const original=Cache.prototype.put;Cache.prototype.put=function(...args){window.__lockedCachePuts++;return original.apply(this,args);};});await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('lang','fil');expect(await page.evaluate(()=>window.__lockedCachePuts)).toBe(0);expect(await pair(page)).toEqual(raw);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 await expect(page.locator('html')).not.toHaveAttribute('data-entry-locale-pending','');
});
test('missing legacy hint is learned after successful password; medical pair stays byte-identical',async({page})=>{
 const raw=await fixture(page,false);await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 expect(await page.evaluate(HINT=>localStorage.getItem(HINT),HINT)).toBe(null);
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');
 await page.waitForFunction(()=>typeof getState==='function');expect(await page.evaluate(()=>getState().settings.interfaceLanguage)).toBe('fil');expect(await pair(page)).toEqual(raw);
 await page.goto(BASE+'/modular3-protected.html');await expect(page.locator('#unlock')).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('lang','fil');
});
for(const corrupt of ['malformed','stale','unsupported','other-valid-language'])test('untrusted '+corrupt+' hint cannot authorize or change protected data',async({page})=>{
 const raw=await fixture(page);await page.evaluate(({HINT,corrupt})=>{const h=JSON.parse(localStorage.getItem(HINT));if(corrupt==='malformed')localStorage.setItem(HINT,'{bad');else{if(corrupt==='stale')h.salt='0'.repeat(32);else h.code=corrupt==='other-valid-language'?'en':'../en';localStorage.setItem(HINT,JSON.stringify(h));}},{HINT,corrupt});
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();expect(await pair(page)).toEqual(raw);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');await expect(page.locator('html')).toHaveAttribute('lang','fil');expect(await pair(page)).toEqual(raw);
});
test('unavailable hinted catalog exposes neutral entry and cannot bypass locked state',async({page})=>{
 const raw=await fixture(page);await page.evaluate(async()=>{const cache=await caches.open(MedControlEntryLanguages.cacheName);await cache.delete('/locales/catalogs/fil.json');});await page.route('**/locales/catalogs/fil.json',r=>r.fulfill({status:503,body:'synthetic unavailable'}));
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
 await expect(page.locator('h1')).toHaveText('MedControl');expect(await pair(page)).toEqual(raw);
 await page.locator('#password').fill('Wrong-Synthetic-Password');await page.locator('#unlock').click();await expect(page.locator('#message')).toHaveText('MedControl');expect(await pair(page)).toEqual(raw);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
});

test('missing bootstrap policy and retry retain neutral returning failure without changing pair',async({page})=>{
 const raw=await fixture(page);await page.route('**/js/modular3-entry-languages.js*',r=>r.fulfill({status:503,body:'synthetic unavailable'}));
 await page.reload();await expect(page.locator('#retry-entry')).toBeVisible();
 await expect(page.locator('#unlock')).toBeDisabled();await expect(page.locator('h1')).toHaveText('MedControl');
 await expect(page.locator('#message')).toHaveText('MedControl');expect(await pair(page)).toEqual(raw);
});

test('interrupted public locale journal stays neutral until protected password restores the authoritative locale',async({page})=>{
 const raw=await fixture(page);await page.evaluate(HINT=>{const h=JSON.parse(localStorage.getItem(HINT));localStorage.setItem(HINT,JSON.stringify({version:1,pending:true,salt:h.salt}));},HINT);
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();await expect(page.locator('h1')).toHaveText('MedControl');await expect(page.locator('html')).toHaveAttribute('lang','und');expect(await pair(page)).toEqual(raw);
 await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');await expect(page.locator('html')).toHaveAttribute('lang','fil');expect(await pair(page)).toEqual(raw);
 expect(await page.evaluate(()=>MedControlEntryLanguages.displayPending())).toBe(false);
});

test('locked display uses validated cached locale when catalog network is unavailable',async({page})=>{
 const raw=await fixture(page);let network=0;await page.route('**/locales/catalogs/fil.json',r=>{network++;return r.fulfill({status:503,body:'synthetic unavailable'});});
 await page.reload();await expect(page.locator('#unlock')).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('lang','fil');expect(network).toBe(0);expect(await pair(page)).toEqual(raw);expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
});
