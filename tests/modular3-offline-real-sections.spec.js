'use strict';
const {test,expect}=require('@playwright/test');
// Multiple real encrypted reopen flows and full worker-cache acknowledgment.
test.setTimeout(120000);
const {BASE,openProtected,warmOffline}=require('./modular3-protected-test-fixture.cjs');
const pages=['input','action','dashboard','archive'];
const state={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[]};
test('all four real section interfaces render with browser network disabled, synthetic auth and local-only assets',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan',serviceWorkers:'allow'});
 const external=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==BASE){external.push(route.request().url());return route.abort();}return route.continue();});
 const seed=await context.newPage();await openProtected(seed,'input',state);await warmOffline(seed);await seed.close();
 await context.setOffline(true);
 for(const name of pages){
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openProtected(page,name);
  if(name==='archive'){
   await expect(page.getByRole('heading',{name:'MedControl — Архив'})).toBeVisible({timeout:20000});
   await expect(page.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible();
  }else{
   await expect(page.locator('body')).toContainText('MedControl',{timeout:20000});
   await expect(page.locator('body')).not.toContainText('Ошибка запуска MedControl');
  }
  expect(errors,name+' page errors').toEqual([]);
  const actual=await page.evaluate(()=>MedControlModular3ProtectedSession.read());
  expect(actual.medications).toEqual([]);expect(actual.intakeLogs).toEqual([]);
  await page.close();
 }
 expect(external).toEqual([]);await context.close();
});
