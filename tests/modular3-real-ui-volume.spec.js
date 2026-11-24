'use strict';
const {test,expect}=require('@playwright/test');
const {BASE,installLegacyModuleHost}=require('./modular3-legacy-module-fixture.cjs');
test('legacy-module browser regression: real UI: 120 synthetic courses, 240 slot events, archive after seven days and reload without loss',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan',serviceWorkers:'block'});
 await installLegacyModuleHost(context);
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-10-12T15:00:00Z')});
 await page.goto(BASE+'/input.html');
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
 await page.goto(BASE+'/archive.html');
 await expect(page.locator('body')).toContainText('Архив',{timeout:20000});
 await page.waitForFunction(()=>typeof window.getState==='function'&&typeof window.renderArchivePage==='function',{timeout:20000});
 const persisted=await page.evaluate(()=>getState());
 expect(persisted.medications).toHaveLength(120);
 expect(persisted.intakeLogs).toHaveLength(240);
 await context.close();
});
