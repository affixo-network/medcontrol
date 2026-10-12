'use strict';
const {test,expect}=require('@playwright/test');
test('real local MedControl assets and synthetic records survive Chromium offline reload',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await page.evaluate(async()=>{
  const reg=await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  await reg.update();
 });
 await page.addScriptTag({url:'/js/storage.js'});
 await page.addScriptTag({url:'/js/utils.js'});
 await page.addScriptTag({url:'/js/temporal-change-guard.js'});
 await page.addScriptTag({url:'/js/schedule.js'});
 await page.addScriptTag({url:'/js/intake.js'});
 await page.evaluate(()=>{
  const state=getState();
  state.medications.push({id:'OFFLINE-SYNTHETIC',name:'Synthetic offline only',active:true,startDate:'2026-10-13',endDate:'2026-10-13',times:['09:00'],scheduleType:'daily'});
  if(!saveState(state))throw Error('local save failed');
  const planned=getScheduledDateTime('2026-10-13','09:00');
  if(!addOrReplaceLog('OFFLINE-SYNTHETIC',planned,'taken',new Date().toISOString()))throw Error('offline intake failed');
 });
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('#offline-proof')).toContainText('Offline test fixture');
 await page.addScriptTag({url:'/js/storage.js'});
 await page.addScriptTag({url:'/js/utils.js'});
 await page.addScriptTag({url:'/js/temporal-change-guard.js'});
 await page.addScriptTag({url:'/js/schedule.js'});
 await page.addScriptTag({url:'/js/intake.js'});
 const result=await page.evaluate(()=>{
  const state=getState();
  const planned=getScheduledDateTime('2026-10-13','09:00');
  return {medications:state.medications.length,logs:state.intakeLogs.length,action:getLogForSchedule('OFFLINE-SYNTHETIC',planned)?.action};
 });
 expect(result).toEqual({medications:1,logs:1,action:'taken'});
 await context.close();
});
