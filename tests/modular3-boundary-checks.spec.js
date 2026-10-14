'use strict';
const {test,expect}=require('@playwright/test');
const URL='http://127.0.0.1:8765/modular3-protected.html';
const PASSWORD='Synthetic-Only-Password-2026';
const KEY='medcontrol_modular3_protected_state_v1';
const SAMPLE={settings:{timezone:'Asia/Yerevan'},medications:[{id:'fake1',name:'SYNTHETIC',times:['09:00','14:00']}],intakeLogs:[{id:'event1',plannedAt:'2026-10-14T05:00:00Z',actualAt:'2026-10-14T05:30:00Z'}],intakeCorrections:[{id:'cancel1',eventId:'event1'}],archiveHistory:[{id:'archive1',medicationId:'fake1'}]};
async function setup(page){await page.goto(URL);await page.addScriptTag({url:'/js/modular3-write-boundary.js'});await page.evaluate(async ({sample,password})=>MedControlModular3ProtectedSession.initialize(sample,password),{sample:SAMPLE,password:PASSWORD});}
test('encrypted write failure rejects operation without losing history',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 const result=await page.evaluate(async key=>{
  const original=localStorage.getItem(key),native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===key)throw Error('Synthetic write failure');return native.call(this,k,v);};
  let rejected=false;
  try{await MedControlModular3WriteBoundary.write('action',s=>s.intakeLogs.push({id:'unsaved'}));}catch(_){rejected=true;}
  Storage.prototype.setItem=native;
  return {rejected,unchanged:localStorage.getItem(key)===original,state:MedControlModular3WriteBoundary.read('archive')};
 },KEY);
 expect(result.rejected).toBe(true);expect(result.unchanged).toBe(true);expect(result.state.intakeLogs).toEqual(SAMPLE.intakeLogs);
 await context.close();
});
test('protected mode blocks plaintext cloud requests',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 await page.addScriptTag({url:'/js/cloud-snapshot.js'});
 const result=await page.evaluate(async()=>{
  let calls=0;window.medcontrolSupabaseUser={id:'fake-user'};window.medcontrolSupabase={from(){calls++;throw Error('Unexpected cloud access');}};
  const state=MedControlModular3WriteBoundary.read('input');
  const created=await medcontrolCloudSnapshot.create({state});
  const queued=await medcontrolCloudSnapshot.queue(state);
  const restored=await medcontrolCloudSnapshot.restoreLatest({overwriteExisting:true});
  await medcontrolCloudSnapshot.flush();
  return {calls,created:created.reason,queued:queued.reason,restored:restored.reason};
 });
 expect(result.calls).toBe(0);
 expect(result.created).toBe('protected_mode_blocks_plaintext_cloud_snapshot');
 expect(result.queued).toBe('protected_mode_blocks_plaintext_cloud_snapshot');
 expect(result.restored).toBe('protected_mode_blocks_plaintext_cloud_restore');
 await context.close();
});
test('four-section encrypted history survives reload and local password unlock',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 for(const section of ['input','action','dashboard','archive'])await page.evaluate(async section=>MedControlModular3WriteBoundary.write(section,s=>{s.audit=s.audit||[];s.audit.push(section);}),section);
 await page.reload();await page.addScriptTag({url:'/js/modular3-write-boundary.js'});
 expect(await page.evaluate(async password=>MedControlModular3ProtectedSession.unlock(password),PASSWORD)).toBe(true);
 const state=await page.evaluate(()=>MedControlModular3WriteBoundary.read('archive'));
 for(const field of ['medications','intakeLogs','intakeCorrections','archiveHistory'])expect(state[field]).toEqual(SAMPLE[field]);
 expect(state.audit).toEqual(['input','action','dashboard','archive']);
 await context.close();
});
