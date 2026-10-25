'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const guard=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
test('real UI: click Taken, cancel accidental press, preserve audit on reload',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',locale:'ru-RU'});
 const page=await context.newPage();
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  if(url.pathname==='/js/auth-guard.js'){
   const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-ui'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
  }
  if(url.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.medcontrolCloudSnapshot={validState:s=>!!s&&!!s.settings&&Array.isArray(s.medications)&&Array.isArray(s.intakeLogs),meaningfulState:s=>!!s&&(s.medications.length>0||s.intakeLogs.length>0),latest:async()=>({ok:true,snapshot:null}),restoreLatest:async()=>({ok:false,reason:"synthetic_test_only"})};'});
  return route.continue();
 });
 await page.clock.install({time:new Date('2026-10-13T08:00:00.000Z')});
 await page.goto('http://127.0.0.1:8765/action.html');
 await expect(page.getByRole('heading',{name:/Приём препаратов/})).toBeVisible();
 await page.evaluate(()=>{
  const state=getState();const date=currentLocalDate();
  state.medications.push({id:'UI-ONLY-FAKE',order:1,name:'Synthetic UI Test',dose:'1 капсула',active:true,cancelled:false,scheduleType:'daily',startDate:date,endDate:date,times:['09:00','18:45'],rowHistory:[{action:'created',at:nowISO(),snapshot:{times:['09:00','18:45']}}],manufacturer:'Synthetic',contentValue:'500',contentUnit:'мг',intakeQuantity:'1',intakeUnit:'капсула'});
  if(!saveState(state))throw Error('save failed');
  mount('action');
 });
 const row=page.locator('tr').filter({hasText:'Synthetic UI Test'}).first();
 await expect(row).toBeVisible();
 await row.getByRole('button',{name:/Принято/}).first().click();
 let state=await page.evaluate(()=>getState());
 expect(state.intakeLogs).toHaveLength(1);
 expect(state.intakeLogs[0].action).toBe('taken');
 const takenAt=state.intakeLogs[0].actualAt;
 await page.locator('tr').filter({hasText:'Synthetic UI Test'}).first().getByRole('button',{name:/Исправить/}).click();
 await expect(page.locator('#correctionDialog')).toBeVisible();
 await page.locator('#correction_reason').selectOption('accident');
 page.once('dialog',d=>d.accept());
 await page.locator('#correction_apply').click();
 state=await page.evaluate(()=>getState());
 expect(state.intakeLogs).toHaveLength(1);
 expect(state.intakeLogs[0].actualAt).toBe(takenAt);
 expect(state.intakeCorrections).toHaveLength(1);
 expect(state.intakeCorrections[0].after.action).toBe('reset');
 await page.reload();
 await expect(page.getByRole('heading',{name:/Приём препаратов/})).toBeVisible();
 state=await page.evaluate(()=>getState());
 expect(state.intakeLogs[0].actualAt).toBe(takenAt);
 expect(state.intakeCorrections[0].reason).toBe('accident');
 await context.close();
});
