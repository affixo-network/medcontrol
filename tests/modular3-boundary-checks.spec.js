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

test('input create course is encrypted before acknowledgement and rejects duplicate',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 const result=await page.evaluate(async()=>{
  const course={id:'new-synthetic-course',name:'Synthetic Input',times:['12:30']};
  await MedControlModular3WriteBoundary.createInputCourse(course);
  let duplicateRejected=false;
  try{await MedControlModular3WriteBoundary.createInputCourse(course);}catch(_){duplicateRejected=true;}
  return {duplicateRejected,encrypted:localStorage.getItem('medcontrol_modular3_protected_state_v1'),state:MedControlModular3WriteBoundary.read('input')};
 });
 expect(result.duplicateRejected).toBe(true);
 expect(result.encrypted).not.toContain('new-synthetic-course');
 expect(result.state.medications.map(m=>m.id)).toEqual(['fake1','new-synthetic-course']);
 await context.close();
});

test('input confirmation awaits encryption, prevents double submit and preserves dialog on write failure',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 const source=await page.evaluate(async()=>await (await fetch('/js/medications.js')).text());
 await page.addScriptTag({content:source+'\nwindow.__setPendingForTest = value => { pendingMedicationCreate = value; };'});
 const result=await page.evaluate(async()=>{
  const dialog=document.createElement('dialog');
  dialog.id='medicationSaveDialog';dialog.innerHTML='<button>Save</button>';
  document.body.appendChild(dialog);dialog.showModal();
  let mounts=0;window.mount=()=>{mounts++;};
  const errors=[];window.showMedicationHint=message=>errors.push(message);
  const boundary=window.MedControlModular3WriteBoundary;
  let calls=0,finish;
  const actualCreate=boundary.createInputCourse.bind(boundary);
  window.MedControlModular3WriteBoundary={enabled:()=>true,createInputCourse:async course=>{calls++;await new Promise(resolve=>finish=resolve);return actualCreate(course);},read:boundary.read.bind(boundary)};
  window.recordRowHistory=(course)=>course.rowHistory.push({action:'created'});
  window.medicationRuleSummary=()=> 'Synthetic';
  const setPending=(item)=>window.__setPendingForTest({state:{medications:[]},item});
  setPending({id:'synthetic-confirm-1',name:'Synthetic Confirm',times:['12:30'],rowHistory:[]});
  const pendingPresent=true;
  const first=confirmMedicationCreate();
  await Promise.resolve();
  const second=await confirmMedicationCreate();
  const before={open:dialog.open,disabled:dialog.querySelector('button').disabled,calls,mounts,second};
  if(typeof finish!=='function')throw Error('Protected write was not invoked: '+JSON.stringify({calls,errors,pendingPresent,protectedEnabled:boundary.enabled(),dialogOpen:dialog.open,firstResult:await first}));
  finish();
  const firstOk=await first;
  const after={open:dialog.open,calls,mounts,firstOk,encrypted:localStorage.getItem('medcontrol_modular3_protected_state_v1').includes('synthetic-confirm-1')};
  dialog.showModal();
  window.MedControlModular3WriteBoundary={enabled:()=>true,createInputCourse:async()=>{calls++;throw Error('Synthetic disk failure');},read:boundary.read.bind(boundary)};
  setPending({id:'synthetic-confirm-fail',name:'Synthetic Failure',times:['14:00'],rowHistory:[]});
  const failed=await confirmMedicationCreate();
  const failure={open:dialog.open,calls,mounts,failed,error:errors.some(e=>e.includes('Synthetic disk failure')),unsaved:!JSON.stringify(boundary.read('input')).includes('synthetic-confirm-fail')};
  window.MedControlModular3WriteBoundary=boundary;
  return {before,after,failure};
 });
 expect(result.before).toEqual({open:true,disabled:true,calls:1,mounts:0,second:false});
 expect(result.after).toEqual({open:false,calls:1,mounts:1,firstOk:true,encrypted:false});
 expect(result.failure).toEqual({open:true,calls:2,mounts:1,failed:false,error:true,unsaved:true});
 await context.close();
});

test('real intake handler acknowledges only encrypted persistence and rejects failed writes',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 const source=await page.evaluate(async()=>await (await fetch('/js/intake.js')).text());
 await page.addScriptTag({content:source});
 const result=await page.evaluate(async()=>{
  window.uid=()=> 'synthetic-intake-new';
  window.nowISO=()=> '2026-10-14T05:45:00.000Z';
  window.computeStatusForLog=()=> 'taken_late';
  let mounts=0;window.mount=()=>{mounts++;};
  const original=window.MedControlModular3WriteBoundary;
  let finish,calls=0;
  window.MedControlModular3WriteBoundary={
   enabled:()=>true,
   write:async(page,mutator)=>{calls++;await new Promise(resolve=>finish=resolve);return original.write(page,mutator);}
  };
  const first=window.markTaken('fake1','2026-10-14T05:00:00.000Z');
  await Promise.resolve();
  const second=await window.markTaken('fake1','2026-10-14T05:00:00.000Z');
  const before={second,calls,mounts};
  if(typeof finish!=='function')throw Error('Encrypted write not started');
  finish();
  const accepted=await first;
  const after={accepted,mounts,calls,logs:original.read('action').intakeLogs.filter(x=>x.id==='synthetic-intake-new').length};
  const encrypted=localStorage.getItem('medcontrol_modular3_protected_state_v1');
  window.MedControlModular3WriteBoundary={enabled:()=>true,write:async()=>{throw Error('Synthetic disk fault');}};
  window.alert=()=>{};
  const rejected=await window.markCancelled('fake1','2026-10-14T09:00:00.000Z');
  const failure={rejected,mounts,unchanged:encrypted===localStorage.getItem('medcontrol_modular3_protected_state_v1')};
  window.MedControlModular3WriteBoundary=original;
  return {before,after,failure,plaintext:encrypted.includes('synthetic-intake-new')};
 });
 expect(result.before).toEqual({second:false,calls:1,mounts:0});
 expect(result.after).toEqual({accepted:true,mounts:1,calls:1,logs:1});
 expect(result.failure).toEqual({rejected:false,mounts:1,unchanged:true});
 expect(result.plaintext).toBe(false);
 await context.close();
});

test('real storage reads unlocked encrypted state and blocks plaintext saves',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 await page.addScriptTag({url:'/js/storage.js'});
 const result=await page.evaluate(()=>{
  const key='affixo_medcontrol_standard_v3';
  const before=localStorage.getItem(key);
  const state=getState();
  const saved=saveState({...state,medications:[]});
  return {name:state.medications[0].name,logCount:state.intakeLogs.length,saved,plaintextUnchanged:localStorage.getItem(key)===before};
 });
 expect(result).toEqual({name:'SYNTHETIC',logCount:1,saved:false,plaintextUnchanged:true});
 await page.evaluate(async()=>MedControlModular3ProtectedSession.lock());
 const locked=await page.evaluate(()=>{
  try{getState();return false;}catch(error){return error.code==='protected_session_locked';}
 });
 expect(locked).toBe(true);
 await context.close();
});

test('missing encrypted vault with enrolled local password never falls back to plaintext',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();await setup(page);
 await page.addScriptTag({url:'/js/storage.js'});
 const result=await page.evaluate(async()=>{
  await MedControlModular3ProtectedSession.lock();
  localStorage.removeItem('medcontrol_modular3_protected_state_v1');
  const key='affixo_medcontrol_standard_v3';
  const before=localStorage.getItem(key);
  let blocked=false;
  try{getState();}catch(error){blocked=error.code==='protected_session_locked';}
  const saved=saveState({settings:{},medications:[],intakeLogs:[]});
  return {blocked,saved,plaintextUnchanged:localStorage.getItem(key)===before};
 });
 expect(result).toEqual({blocked:true,saved:false,plaintextUnchanged:true});
 await context.close();
});

async function unlockRealPage(page){
 await page.locator('#password').fill(PASSWORD);await page.locator('#unlock').click();
 await expect(page.locator('.nav')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.medcontrolOfflineShellReady)).toBe(true);
}

test('protected real page starts after local password without cloud session',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await setup(page);
 await page.evaluate(async()=>MedControlModular3ProtectedSession.lock());
 await page.addInitScript(()=>{window.prompt=()=> 'Synthetic-Only-Password-2026';});
 await page.goto('http://127.0.0.1:8765/action.html');
 await unlockRealPage(page);
 await expect.poll(async()=>page.evaluate(()=>Boolean(window.MedControlModular3ProtectedSession?.isUnlocked()))).toBe(true);
 const result=await page.evaluate(()=>({
  protectedCount:getState().medications.length,
  historyCount:getState().intakeLogs.length,
  cloudClient:Boolean(window.medcontrolSupabase),
  protectedSession:MedControlModular3ProtectedSession.isUnlocked()
 }));
 expect(result.protectedSession).toBe(true);
 expect(result.protectedCount).toBe(1);
 expect(result.historyCount).toBe(1);
 expect(result.cloudClient).toBe(false);
 await context.close();
});

test('four real pages reopen same protected history after restart with cloud unavailable',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await setup(page);
 await page.evaluate(async()=>MedControlModular3ProtectedSession.lock());
 await page.addInitScript(()=>{
  window.prompt=()=> 'Synthetic-Only-Password-2026';
  window.fetch=(original=>function(input,init){
    const url=String(typeof input==='string'?input:input?.url||'');
    if(url.includes('supabase.co'))return Promise.reject(Error('Synthetic offline cloud'));
    return original.call(this,input,init);
  })(window.fetch);
 });
 for(const section of ['input','action','dashboard','archive']){
  await page.goto('http://127.0.0.1:8765/'+section+'.html');
  await unlockRealPage(page);
  await expect.poll(async()=>page.evaluate(()=>Boolean(window.MedControlModular3ProtectedSession?.isUnlocked()))).toBe(true);
  const state=await page.evaluate(()=>getState());
  expect(state.medications.map(m=>m.id)).toContain('fake1');
  expect(state.intakeLogs.map(log=>log.id)).toContain('event1');
  expect(state.intakeCorrections.map(entry=>entry.id)).toContain('cancel1');
  expect(state.archiveHistory.map(entry=>entry.id)).toContain('archive1');
 }
 await context.close();
});

test('fully offline browser restart unlocks all four protected pages',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await setup(page);
 await page.evaluate(async()=>MedControlModular3ProtectedSession.lock());
 await page.addInitScript(()=>{window.prompt=()=> 'Synthetic-Only-Password-2026';});
 await page.goto('http://127.0.0.1:8765/action.html');
 await unlockRealPage(page);
 await expect.poll(async()=>page.evaluate(()=>Boolean(navigator.serviceWorker?.controller))).toBe(true);
 await expect.poll(async()=>page.evaluate(async()=>{
  const cache=await caches.open('medcontrol-static-modular3-v10');
  return Boolean(await cache.match('/archive.html'))&&Boolean(await cache.match('/js/archive-page.js'));
 })).toBe(true);
 await page.close();
 await context.setOffline(true);
 const reopened=await context.newPage();
 await reopened.addInitScript(()=>{window.prompt=()=> 'Synthetic-Only-Password-2026';});
 for(const section of ['input','action','dashboard','archive']){
  await reopened.goto('http://127.0.0.1:8765/'+section+'.html');
  await unlockRealPage(reopened);
  await expect.poll(async()=>reopened.evaluate(()=>Boolean(window.MedControlModular3ProtectedSession?.isUnlocked()))).toBe(true);
  const state=await reopened.evaluate(()=>getState());
  expect(state.medications.map(m=>m.id)).toContain('fake1');
  expect(state.intakeLogs.map(log=>log.id)).toContain('event1');
 }
 await context.close();
});

test('offline intake write survives page restart and remains encrypted',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await setup(page);
 await page.evaluate(async()=>MedControlModular3ProtectedSession.lock());
 await page.addInitScript(()=>{window.prompt=()=> 'Synthetic-Only-Password-2026';});
 await page.goto('http://127.0.0.1:8765/action.html');
 await unlockRealPage(page);
 await expect.poll(async()=>page.evaluate(()=>Boolean(navigator.serviceWorker?.controller))).toBe(true);
 await expect.poll(async()=>page.evaluate(async()=>{
  const cache=await caches.open('medcontrol-static-modular3-v10');
  return Boolean(await cache.match('/action.html'))&&Boolean(await cache.match('/js/modular3-write-boundary.js'));
 })).toBe(true);
 await context.setOffline(true);
 const before=await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
 const result=await page.evaluate(async()=>{
  await MedControlModular3WriteBoundary.write('action',state=>{
   state.intakeLogs.push({id:'offline-intake-verified',plannedAt:'2026-10-14T09:00:00Z',actualAt:'2026-10-14T09:15:00Z'});
  });
  const encrypted=localStorage.getItem('medcontrol_modular3_protected_state_v1');
  return {saved:MedControlModular3WriteBoundary.read('action').intakeLogs.some(x=>x.id==='offline-intake-verified'),plaintext:encrypted.includes('offline-intake-verified')};
 });
 expect(result).toEqual({saved:true,plaintext:false});
 const after=await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1'));
 expect(after).not.toBe(before);
 await page.close();
 const reopened=await context.newPage();
 await reopened.addInitScript(()=>{window.prompt=()=> 'Synthetic-Only-Password-2026';});
 await reopened.goto('http://127.0.0.1:8765/archive.html');
 await unlockRealPage(reopened);
 await expect.poll(async()=>reopened.evaluate(()=>Boolean(window.MedControlModular3ProtectedSession?.isUnlocked()))).toBe(true);
 const history=await reopened.evaluate(()=>getState().intakeLogs.map(x=>x.id));
 expect(history).toContain('event1');
 expect(history).toContain('offline-intake-verified');
 await context.close();
});
