'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const guard=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
test('real input and archive screens preserve completed course and history across page navigation',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:8765')return route.abort();
  if(url.pathname==='/js/auth-guard.js'){
   const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
   return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
  }
  if(url.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* synthetic only */'});
  return route.continue();
 });
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-10-12T15:00:00.000Z')});
 await page.goto('http://127.0.0.1:8765/input.html');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 await page.evaluate(()=>{
  const date=currentLocalDate();
  const state=getState();
  const med={id:'SYNTHETIC-REAL-UI-ARCHIVE',name:'Synthetic Real UI Archive',active:true,cancelled:false,scheduleType:'daily',startDate:date,endDate:date,times:['18:45'],rowHistory:[{action:'created',at:new Date().toISOString(),snapshot:{times:['18:45']}}],manufacturer:'Test',contentValue:'500',contentUnit:'мг',intakeQuantity:'1',intakeUnit:'капсула'};
  state.medications.push(med);
  if(!saveState(state))throw Error('synthetic save failed');
  if(!addOrReplaceLog(med.id,getScheduledDateTime(date,'18:45'),'taken',nowISO()))throw Error('synthetic intake failed');
  window.renderInputPage();
 });
 await expect.poll(()=>page.evaluate(()=>getState().medications[0].courseCompleted)).toBe(true);
 await page.clock.setFixedTime(new Date('2026-10-20T15:00:00.000Z'));
 await page.reload();
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 await expect.poll(()=>page.evaluate(()=>getState().medications[0].archivedCompleted)).toBe(true);
 await page.goto('http://127.0.0.1:8765/archive.html');
 await expect(page.getByRole('heading',{name:'MedControl — Архив'})).toBeVisible({timeout:20000});
 const saved=await page.evaluate(()=>getState());
 expect(saved.medications[0].archivedCompleted).toBe(true);
 expect(saved.intakeLogs).toHaveLength(1);
 expect(saved.intakeLogs[0].action).toBe('taken');
 await context.close();
});
