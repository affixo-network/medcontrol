'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const guard=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
test('real UI: 120 synthetic courses, 240 slot events, archive after seven days and reload without loss',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://127.0.0.1:8765')return route.abort();
  if(u.pathname==='/js/auth-guard.js')return route.fulfill({status:200,contentType:'application/javascript',body:guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-load'},access_token:'fake',refresh_token:'fake'}},error:null})}})})")});
  if(u.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* synthetic only */'});
  return route.continue();
 });
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-10-12T15:00:00Z')});
 await page.goto('http://127.0.0.1:8765/input.html');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const baseline=await page.evaluate(()=>{
  const state=getState(),date=currentLocalDate(),at=nowISO();
  for(let i=0;i<120;i++){
   const id='SYNTH-LOAD-'+i;
   state.medications.push({id,name:'Synthetic Load '+i,active:true,cancelled:false,scheduleType:'daily',startDate:date,endDate:date,times:['09:00','18:45'],rowHistory:[{action:'created',at,snapshot:{times:['09:00','18:45']}}],manufacturer:'Test',contentValue:'500',contentUnit:'мг',intakeQuantity:'1',intakeUnit:'капсула'});
  }
  if(!saveState(state))throw Error('initial save failed');
  for(let i=0;i<120;i++){
   const id='SYNTH-LOAD-'+i;
   if(!addOrReplaceLog(id,getScheduledDateTime(date,'09:00'),'cancelled',at))throw Error('first slot write failed '+i);
   if(!addOrReplaceLog(id,getScheduledDateTime(date,'18:45'),'taken',at))throw Error('last slot write failed '+i);
  }
  window.renderInputPage();
  const s=getState();
  return {medications:s.medications.length,logs:s.intakeLogs.length,completed:s.medications.filter(m=>m.courseCompleted).length};
 });
 expect(baseline).toEqual({medications:120,logs:240,completed:120});
 await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'));
 await page.reload();
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const state=await page.evaluate(()=>getState());
 expect(state.medications).toHaveLength(120);
 expect(state.intakeLogs).toHaveLength(240);
 expect(state.medications.filter(m=>m.archivedCompleted)).toHaveLength(120);
 expect(new Set(state.intakeLogs.map(l=>l.medicationId+'|'+l.plannedAt)).size).toBe(240);
 await page.goto('http://127.0.0.1:8765/archive.html');
 await expect(page.locator('body')).toContainText('Архив',{timeout:20000});
 await page.waitForFunction(()=>typeof window.getState==='function'&&typeof window.renderArchivePage==='function',{timeout:20000});
 const persisted=await page.evaluate(()=>getState());
 expect(persisted.medications).toHaveLength(120);
 expect(persisted.intakeLogs).toHaveLength(240);
 await context.close();
});
