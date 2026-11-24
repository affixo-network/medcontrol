'use strict';
const {test,expect}=require('@playwright/test');
// Multiple real encrypted reopen flows and full worker-cache acknowledgment.
test.setTimeout(120000);
const {BASE,openProtected}=require('./modular3-protected-test-fixture.cjs');
const pages=['input','action','dashboard','archive'];
test('unauthenticated user cannot access all four sections',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'});
 const external=[];
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==BASE){external.push(route.request().url());return route.abort();}return route.continue();});
 for(const section of pages){
  const page=await context.newPage();await page.goto(BASE+'/'+section+'.html');
  await expect(page).toHaveURL(BASE+'/modular3-protected.html');
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.locator('.topbar')).toHaveCount(0);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
  await page.close();
 }
 expect(external).toEqual([]);await context.close();
});
test('isolated authorized shell renders all four sections with synthetic protected data',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block',locale:'ru-RU'});
 const external=[];
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==BASE){external.push(route.request().url());return route.abort();}return route.continue();});
 for(const section of pages){
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openProtected(page,section);
  await expect(page.locator('.topbar')).toBeVisible();
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(true);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read().medications)).toEqual([]);
  expect(errors).toEqual([]);await page.close();
 }
 expect(external).toEqual([]);await context.close();
});
