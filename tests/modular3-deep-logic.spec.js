'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const guard=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
test('real intake, cancellation, completion, seven-day archive, persistence - synthetic only',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan',serviceWorkers:'block'});
 const page=await context.newPage();
 const blocked=[];
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='http://127.0.0.1:8765'){blocked.push(url.origin);return route.abort();}
   if(url.pathname==='/js/auth-guard.js'){
     const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-e2e-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
     return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
   }
   if(url.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.medcontrolCloudSnapshot={validState:s=>!!s&&!!s.settings&&Array.isArray(s.medications)&&Array.isArray(s.intakeLogs),meaningfulState:s=>!!s&&(s.medications.length>0||s.intakeLogs.length>0),latest:async()=>({ok:true,snapshot:null}),restoreLatest:async()=>({ok:false,reason:"synthetic_test_only"})};'});
   return route.continue();
 });
 await page.clock.install({time:new Date('2026-10-12T15:00:00.000Z')});
 await page.goto('http://127.0.0.1:8765/input.html');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const outcome=await page.evaluate(()=>{
   const date=currentLocalDate();
   const med={id:'SYNTHETIC-E2E-COURSE',name:'Synthetic E2E Only',active:true,cancelled:false,scheduleType:'daily',startDate:date,endDate:date,times:['09:00','18:45'],rowHistory:[{action:'created',at:new Date().toISOString(),snapshot:{times:['09:00','18:45']}}],manufacturer:'Test',contentValue:'500',contentUnit:'мг',intakeQuantity:'1',intakeUnit:'капсула'};
   const state=getState();state.medications.push(med);if(!saveState(state))throw Error('saveState failed');
   const first=getScheduledDateTime(date,'09:00');
   const last=getScheduledDateTime(date,'18:45');
   if(!addOrReplaceLog(med.id,first,'taken',nowISO()))throw Error('first intake write failed');
   if(!addOrReplaceLog(med.id,first,'cancelled',nowISO()))throw Error('cancel write failed');
   if(!addOrReplaceLog(med.id,last,'taken',nowISO()))throw Error('last intake write failed');
   const before=getState();
   if(before.intakeLogs.length!==2)throw Error('intake logs not isolated by slot');
   if(getLogForSchedule(med.id,first)?.action!=='cancelled')throw Error('cancellation not recorded');
   if(getLogForSchedule(med.id,last)?.action!=='taken')throw Error('last intake not recorded');
   if(!window.isCompletedMedicationCourse(before.medications[0]))throw Error('completion predicate false');
   window.renderInputPage();
   const after=getState();const item=after.medications[0];
   if(!item.courseCompleted||item.active||item.archivedCompleted)throw Error('premature archive or incomplete course');
   return {id:item.id,first,last,completedAt:item.rowHistory.find(x=>x.action==='course_completed')?.at,logs:after.intakeLogs.length};
 });
 expect(outcome.logs).toBe(2);
 await page.reload();
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 let snapshot=await page.evaluate(()=>getState());
 expect(snapshot.medications[0].courseCompleted).toBe(true);
 expect(snapshot.medications[0].archivedCompleted).not.toBe(true);
 expect(snapshot.intakeLogs).toHaveLength(2);
 await page.clock.setFixedTime(new Date('2026-10-20T15:00:00.000Z'));
 await page.reload();
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 snapshot=await page.evaluate(()=>getState());
 expect(snapshot.medications[0].archivedCompleted).toBe(true);
 expect(snapshot.intakeLogs).toHaveLength(2);
 expect(snapshot.intakeLogs.find(x=>x.plannedAt===outcome.first).action).toBe('cancelled');
 expect(snapshot.intakeLogs.find(x=>x.plannedAt===outcome.last).action).toBe('taken');
 expect(snapshot.medications[0].rowHistory.some(x=>x.action==='course_completed')).toBe(true);
 expect(blocked).toEqual([]);
 await context.close();
});
