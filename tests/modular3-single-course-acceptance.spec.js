'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const guard=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
test('single acceptance: create real course, calculate both slots, take dose with factual time, display and persist',async({browser})=>{
 const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://127.0.0.1:8765')return route.abort();
  if(u.pathname==='/js/auth-guard.js')return route.fulfill({status:200,contentType:'application/javascript',body:guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-acceptance'},access_token:'fake',refresh_token:'fake'}},error:null})}})})")});
  if(u.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* synthetic only */'});
  return route.continue();
 });
 const page=await context.newPage();
 await page.clock.install({time:new Date('2026-10-14T05:31:00.000Z')});
 await page.goto('http://127.0.0.1:8765/input.html');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const created=await page.evaluate(()=>{
  const fields={name:'Synthetic Two Doses',manufacturer:'Test',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'capsule',details:'Automated acceptance',scheduleType:'daily',times:'09:00,14:00',startDate:'2026-10-14',endDate:'2026-10-14'};
  for(const [field,value] of Object.entries(fields)){const el=document.getElementById('create_'+field);if(!el)throw Error('Missing form field: '+field);el.value=value;}
  document.getElementById('create_active').checked=true;
  createMedication();
  if(!document.getElementById('medicationConfirmDialog').open)throw Error('Create confirmation did not open');
  proceedMedicationCreateConfirmation();
  confirmMedicationCreate();
  const s=getState(),med=s.medications.find(m=>m.name==='Synthetic Two Doses');
  if(!med)throw Error('Course not saved');
  return {id:med.id,times:med.times,slots:med.times.map(time=>getScheduledDateTime('2026-10-14',time))};
 });
 expect(created.times).toEqual(['09:00','14:00']);
 expect(created.slots).toHaveLength(2);
 expect(created.slots.map(t=>new Date(t).toLocaleTimeString('en-GB',{timeZone:'Asia/Yerevan',hour:'2-digit',minute:'2-digit'}))).toEqual(['09:00','14:00']);
 await page.goto('http://127.0.0.1:8765/action.html');
 await expect(page.locator('#app')).not.toBeEmpty();
 const taken=await page.evaluate(({id,plannedAt})=>{
  if(!markTaken(id,plannedAt))throw Error('Taken failed');
  const log=getState().intakeLogs.find(l=>l.medicationId===id&&l.plannedAt===plannedAt);
  return {log,html:document.getElementById('app').innerText};
 },{id:created.id,plannedAt:created.slots[0]});
 expect(taken.log.action).toBe('taken');
 expect(taken.log.actualAt).toBe('2026-10-14T05:31:00.000Z');
 expect(taken.html).toContain('Synthetic Two Doses');
 expect(taken.html).toMatch(/09:00/);
 expect(taken.html).toMatch(/14:00/);
 await page.reload();
 await expect(page.locator('#app')).not.toBeEmpty();
 const persisted=await page.evaluate(id=>{
  const s=getState();return {med:s.medications.find(m=>m.id===id),logs:s.intakeLogs.filter(l=>l.medicationId===id),screen:document.getElementById('app').innerText};
 },created.id);
 expect(persisted.med.times).toEqual(['09:00','14:00']);
 expect(persisted.logs).toHaveLength(1);
 expect(persisted.logs[0].actualAt).toBe(taken.log.actualAt);
 expect(persisted.screen).toContain('Synthetic Two Doses');
 await context.close();
});
