'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const PASS='Synthetic-Complete-Interface-2026';
const KEY='medcontrol_modular3_protected_state_v1';
const BASE='http://127.0.0.1:8791';
async function run(){
 const server=spawn('python3',['-m','http.server','8791','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<100;i++){try{const response=await fetch(BASE+'/input.html');await response.arrayBuffer();if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  browser=await chromium.launch({headless:true,...(process.env.MEDCONTROL_CHROMIUM?{executablePath:process.env.MEDCONTROL_CHROMIUM,args:['--no-sandbox']}:{} )});
  const context=await browser.newContext({timezoneId:'Asia/Yerevan'});
  const page=await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-23T08:00:00Z'));
  const external=[];const errors=[];
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==BASE){external.push(u.origin);return route.abort();}return route.continue();});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(BASE+'/modular3-protected.html');
  await page.evaluate(async password=>{
   await window.MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',country:'Armenia',infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[]},password);
  },PASS);
  await page.goto(BASE+'/input.html');
  await page.locator('#password').fill(PASS);
  await page.locator('#unlock').click();
  await page.locator('#create_name').waitFor({timeout:10000});
  assert.equal(new URL(page.url()).pathname,'/input.html','Original Input must open after local unlock');
  console.log('PASS original Modular-2 Input opens behind local password');
  await page.evaluate(()=>{
   const fields={name:'Synthetic Original Course',manufacturer:'Synthetic Factory',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'Synthetic details',startDate:'2026-10-23',endDate:'2026-10-24'};
   for(const [key,value]of Object.entries(fields))document.getElementById('create_'+key).value=value;
   document.getElementById('create_timeHour').value='13';document.getElementById('create_timeMinute').value='00';
   window.addStructuredTime('create_');
  });
  await page.locator('#createMedicationButton').click();
  await page.locator('#medicationConfirmDialog[open]').waitFor();
  await page.locator('#medicationConfirmDialog button[onclick="proceedMedicationCreateConfirmation()"] ').click();
  await page.locator('#medicationSaveDialog[open]').waitFor();
  const failedCreate=await page.evaluate(async()=>{
   const native=Storage.prototype.setItem,before=localStorage.getItem('medcontrol_modular3_protected_state_v1');
   Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')throw Error('Synthetic draft disk failure');return native.call(this,k,v);};
   let rejected=false,result;
   try{result=await window.confirmMedicationCreate();}catch(error){rejected=true;}
   finally{Storage.prototype.setItem=native;}
   return {rejected,result,unchanged:localStorage.getItem('medcontrol_modular3_protected_state_v1')===before,open:document.getElementById('medicationSaveDialog').open};
  });
  assert.equal(failedCreate.rejected,false,'Draft failure must be handled by the confirmation UI');
  assert.equal(failedCreate.result,false);assert.equal(failedCreate.unchanged,true);assert.equal(failedCreate.open,true);
  console.log('PASS creation draft failure reports failure and keeps confirmation open');
  // Delay real WebCrypto: the original UI must keep the confirmation open until persistence.
  await page.evaluate(()=>{
   const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);
   let release;const gate=new Promise(r=>release=r);window.releaseEncryption=release;
   crypto.subtle.encrypt=async(...args)=>{await gate;return encrypt(...args);};
  });
  await page.locator('#medicationSaveDialog button[onclick="confirmMedicationCreate()"] ').click();
  assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.length),0);
  assert.equal(await page.locator('#medicationSaveDialog').evaluate(d=>d.open),true);
  await page.evaluate(()=>window.releaseEncryption());
  await page.waitForFunction(()=>window.MedControlModular3ProtectedSession.read().medications.length===1);
  await page.waitForFunction(()=>!document.getElementById('medicationSaveDialog').open);
  const course=await page.evaluate(()=>getState().medications[0]);
  assert.equal(course.name,'Synthetic Original Course');assert.deepEqual(course.times,['13:00']);
  console.log('PASS original creation waits for real encryption and durable write');
  await page.clock.setFixedTime(new Date('2026-10-23T08:00:01Z'));
  await page.evaluate(async()=>{await window.toggleMedicationMode(getState().medications[0].id);});
  assert.equal(await page.evaluate(()=>getState().medications[0].active),false);
  await page.clock.setFixedTime(new Date('2026-10-23T08:00:02Z'));
  await page.evaluate(async()=>{await window.toggleMedicationMode(getState().medications[0].id);});
  assert.equal(await page.evaluate(()=>getState().medications[0].active),true);
  console.log('PASS original active/passive handlers save encrypted state');
  await page.clock.setFixedTime(new Date('2026-10-23T08:00:03Z'));
  await page.evaluate(()=>window.openEditMedication(getState().medications[0].id));
  await page.locator('#edit_name').fill('Synthetic Edited Course');
  await page.evaluate(async()=>{await window.saveMedicationEdit(getState().medications[0].id);});
  assert.equal(await page.evaluate(()=>getState().medications[0].name),'Synthetic Edited Course');
  console.log('PASS original edit and history persist');
  const navigate=async section=>{await page.locator('.nav a[href="'+section+'.html"]').click();await page.waitForURL('**/'+section+'.html');assert.deepEqual(errors,[],'Navigation must not throw');};
  await navigate('action');
  await page.locator('button[onclick^="markTaken("]').first().click();
  await page.waitForFunction(()=>getState().intakeLogs.length===1);
  const intake=await page.evaluate(()=>getState().intakeLogs[0]);
  assert.equal(intake.actualAt,'2026-10-23T08:00:03.000Z');
  await page.clock.setFixedTime(new Date('2026-10-23T08:00:04Z'));
  await page.locator('button[onclick^="openCorrection("]').first().click();
  assert.deepEqual(await page.locator('#correction_reason option').evaluateAll(options=>options.map(x=>x.value)),['','accident','error']);
  await page.locator('#correction_reason').selectOption('accident');
  await page.locator('#correction_apply').click();
  await page.waitForFunction(()=>getState().intakeCorrections.length===1);
  assert.equal(await page.evaluate(()=>getState().intakeLogs[0].actualAt),intake.actualAt);
  console.log('PASS original intake and accident cancellation preserve factual time');
  await navigate('dashboard');
  assert.ok((await page.locator('body').innerText()).includes('Synthetic Edited Course'));
  await navigate('input');
  await page.evaluate(async()=>{
   const setItem=Storage.prototype.setItem;
   const before=localStorage.getItem('medcontrol_modular3_protected_state_v1');
   Storage.prototype.setItem=function(key,value){if(key==='medcontrol_modular3_protected_state_v1')throw new DOMException('Synthetic quota failure','QuotaExceededError');return setItem.call(this,key,value);};
   window.openEditMedication(getState().medications[0].id);
   document.getElementById('edit_name').value='Synthetic Must Not Save';
   await window.saveMedicationEdit(getState().medications[0].id);
   Storage.prototype.setItem=setItem;
   if(localStorage.getItem('medcontrol_modular3_protected_state_v1')!==before)throw Error('Failed save changed ciphertext');
   if(getState().medications[0].name!=='Synthetic Edited Course')throw Error('Failed save changed memory');
   if(!document.getElementById('editDialog').open)throw Error('Failed save closed edit dialog');
   document.getElementById('editDialog').close();
  });
  console.log('PASS storage failure preserves ciphertext, state and edit dialog');
  // No secret input may leak into auxiliary draft or backup storage.
  const plain=await page.evaluate(()=>Object.entries(localStorage).filter(([key,value])=>/Synthetic (Original|Edited|Must Not Save|Factory|details)/.test(value)).map(([key])=>key));
  assert.deepEqual(plain,[]);
  await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true,null,{timeout:45000});
  const expected=await page.evaluate(()=>getState());
  await page.close();
  await context.setOffline(true);
  for(const section of ['input','action','dashboard','archive']){
   const p=await context.newPage();
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(BASE+'/'+section+'.html');
   assert.equal(await p.locator('body').innerText().then(t=>t.includes('Synthetic Edited Course')),false,'Locked page exposed medical data');
   await p.locator('#password').fill(PASS);await p.locator('#unlock').click();
   await p.waitForFunction(()=>!!document.querySelector('.nav'));
   assert.deepEqual(await p.evaluate(()=>getState()),expected,'Offline '+section+' changed saved history');
   await p.close();
  }
  console.log('PASS all four original sections restore exact state after offline restart');
  await context.setOffline(false);
  const full=await context.newPage();
  full.on('dialog',d=>d.accept());full.on('pageerror',e=>errors.push(e.message));
  await full.clock.setFixedTime(new Date('2026-10-23T08:00:10Z'));
  await full.goto(BASE+'/input.html');await full.locator('#password').fill(PASS);await full.locator('#unlock').click();
  await full.locator('#create_name').waitFor();
  // Existing time editor, scope and deleted/replaced history use the same encrypted boundary.
  await full.evaluate(()=>window.editMedicationTimeStatus(getState().medications[0].id,'13:00'));
  await full.locator('#timeEditMinute').selectOption('30');
  await full.locator('#timeEditScope').selectOption('today_future');
  await full.evaluate(async()=>{await window.saveInputTimeEditV4();});
  assert.deepEqual(await full.evaluate(()=>getState().medications[0].times),['13:30']);
  assert.equal(await full.evaluate(()=>getState().medications[0].timeStatusHistory.at(-1).oldTime),'13:00');
  console.log('PASS original time editor preserves replaced time and scope in encrypted history');
  // Rapid typing coalesces ciphertext writes; confirming or leaving flushes the last draft.
  const draftBurst=await full.evaluate(async()=>{
   const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);let count=0;
   crypto.subtle.encrypt=async(...args)=>{count++;return encrypt(...args);};
   const field=document.getElementById('create_name');
   for(let i=0;i<100;i++){field.value='Synthetic Draft '+i;field.dispatchEvent(new Event('input',{bubbles:true}));}
   await window.medControlInputDraft.flush();crypto.subtle.encrypt=encrypt;
   return {count,name:getState().inputDraft.fields.name};
  });
  assert.ok(draftBurst.count<=2,'Typing must coalesce encryption instead of queueing one write per key');
  assert.equal(draftBurst.name,'Synthetic Draft 99');
  console.log('PASS rapid draft input coalesces writes and flushes final value');
  // Capture a real draft, restart, and recover the same fields without plaintext storage.
  await full.locator('#create_name').fill('Synthetic Protected Draft');
  await full.evaluate(async()=>{await window.medControlInputDraft.save();});
  await full.reload();await full.locator('#password').fill(PASS);await full.locator('#unlock').click();
  await full.locator('#create_name').waitFor();
  await full.waitForFunction(()=>document.getElementById('create_name')?.value==='Synthetic Protected Draft');
  assert.equal(await full.evaluate(()=>localStorage.getItem('affixo_medcontrol_standard_v3_input_draft')),null);
  console.log('PASS encrypted draft survives restart');
  // Protected Modular-3 archives completed courses immediately; Archive permits history/reset only.
  await full.clock.setFixedTime(new Date('2026-10-25T08:00:00Z'));
  await full.evaluate(async()=>{await window.mount('input');});
  assert.equal(await full.evaluate(()=>getState().medications[0].courseCompleted),true);
  assert.equal(await full.evaluate(()=>getState().medications[0].archivedCompleted),true);
  await full.locator('.nav a[href="archive.html"]').click();
  assert.equal(await full.locator('[data-repeat-archived], [data-correct-archived]').count(),0);
  const archivedState=await full.evaluate(()=>getState());
  await full.evaluate(()=>repeatCompletedCourse(getState().medications[0].id));
  assert.deepEqual(await full.evaluate(()=>getState()),archivedState);
  assert.equal(await full.evaluate(()=>window.__repeatCompletedCourseSourceId||null),null);
  console.log('PASS archived course rejects repeat and preserves complete state');
  assert.equal(await full.evaluate(()=>getState().intakeLogs[0].actualAt),intake.actualAt);
  await full.waitForFunction(() => document.body.innerText.includes('Synthetic Edited Course'), null, { timeout: 10000 });
  assert.ok((await full.locator('body').innerText()).includes('Synthetic Edited Course'));
  console.log('PASS immediate auto-archive and original Archive display');
  // T-038: synthetic legacy medical backup must block reset even with an empty cloud inventory.
  const legacyBackupGates=await full.evaluate(async()=>{
    const keys=[
      'affixo_medcontrol_standard_v3_pre_reset_backup',
      'affixo_medcontrol_standard_v3_corrupt_backup',
      'affixo_medcontrol_standard_v3_pre_modular_2_upgrade_backup'
    ];
    const original=window.medcontrolCloudSnapshot;
    const results=[];
    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:true,remaining:0}),
      resumeAfterResetFailure:()=>{}
    };
    try{
      for(const key of keys){
        const before=JSON.stringify(getState());
        localStorage.setItem(key,JSON.stringify({medications:[{name:'Synthetic Legacy Medication'}]}));
        try{
          await window.manualMedControlCycleReset();
          results.push({key,unchanged:JSON.stringify(getState())===before,backupPresent:localStorage.getItem(key)!==null});
        }finally{localStorage.removeItem(key);}
      }
      return results;
    }finally{window.medcontrolCloudSnapshot=original;}
  });
  assert.equal(legacyBackupGates.length,3);
  for(const result of legacyBackupGates){
    assert.equal(result.unchanged,true,result.key+' must not erase medical records');
    assert.equal(result.backupPresent,true,result.key+' must not be silently removed');
  }
  console.log('PASS T-038: all three synthetic legacy medical backup types block reset; records preserved');
  // T-038: cloud copies must block reset even when all local legacy backups are absent.
  const cloudInventoryGate=await full.evaluate(async()=>{
    const original=window.medcontrolCloudSnapshot;
    const before=JSON.stringify(getState());
    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:false,remaining:1}),
      resumeAfterResetFailure:()=>{}
    };
    try{
      await window.manualMedControlCycleReset();
      return {unchanged:JSON.stringify(getState())===before};
    }finally{window.medcontrolCloudSnapshot=original;}
  });
  assert.deepEqual(cloudInventoryGate,{unchanged:true},
    'Cloud medical backup must block local reset without deleting records');
  console.log('PASS T-038: synthetic cloud inventory with one backup blocks reset');
  // T-038: legacy primary plaintext medical state must block a protected reset.
  const legacyPrimaryGate=await full.evaluate(async()=>{
    const key='affixo_medcontrol_standard_v3';
    const prior=localStorage.getItem(key);
    const cloud=window.medcontrolCloudSnapshot;
    const before=JSON.stringify(getState());
    localStorage.setItem(key,JSON.stringify({medications:[{name:'Synthetic Legacy Primary'}]}));
    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:true,remaining:0}),
      resumeAfterResetFailure:()=>{}
    };
    try{
      await window.manualMedControlCycleReset();
      return {unchanged:JSON.stringify(getState())===before,legacyPreserved:localStorage.getItem(key)!==null};
    }finally{
      window.medcontrolCloudSnapshot=cloud;
      if(prior===null)localStorage.removeItem(key);else localStorage.setItem(key,prior);
    }
  });
  assert.deepEqual(legacyPrimaryGate,{unchanged:true,legacyPreserved:true},
    'Legacy primary medical state must prevent reset without erasing either copy');
  console.log('PASS T-038: synthetic legacy primary medical state blocks protected reset');
  // T-038: dynamically named cloud-restore backups must also block a reset.
  const dynamicBackupGate=await full.evaluate(async()=>{
    const key='affixo_medcontrol_standard_v3_before_cloud_restore_1760000000000';
    const original=window.medcontrolCloudSnapshot;
    const before=JSON.stringify(getState());
    localStorage.setItem(key,JSON.stringify({medications:[{name:'Synthetic Restored Medication'}]}));
    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:true,remaining:0}),
      resumeAfterResetFailure:()=>{}
    };
    try{
      await window.manualMedControlCycleReset();
      return {unchanged:JSON.stringify(getState())===before,backupPresent:localStorage.getItem(key)!==null};
    }finally{
      window.medcontrolCloudSnapshot=original;
      localStorage.removeItem(key);
    }
  });
  assert.deepEqual(dynamicBackupGate,{unchanged:true,backupPresent:true},
    'Dynamic cloud-restore medical backup must block reset without losing records');
  console.log('PASS T-038: synthetic dynamically named cloud-restore backup blocks reset');
  // T-038: a reset must never retain an old encrypted cycle backup.
  // The cloud-inventory gate is intentionally unavailable in this isolated offline E2E.
  const beforeReset=await full.evaluate(()=>getState());
  await full.evaluate(async()=>{await window.manualMedControlCycleReset();});
  const afterReset=await full.evaluate(()=>getState());
  assert.deepEqual(afterReset,beforeReset,'Reset must not erase medical records when cloud inventory cannot be verified');
  assert.equal(await full.evaluate(()=>localStorage.getItem('affixo_medcontrol_standard_v3_pre_reset_backup')),null);
  console.log('PASS T-038: reset blocked without cloud inventory verification; medical records preserved');
  await full.goto(BASE+'/input.html');
  if(await full.locator('#password').count()){
   await full.locator('#password').fill(PASS);
   await full.locator('#unlock').click();
  }
  await full.locator('#create_name').waitFor();
  const blockedNavigation=await full.evaluate(async()=>{
   const native=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')throw Error('Synthetic navigation draft failure');return native.call(this,k,v);};
   document.getElementById('create_name').value='Synthetic Unsaved Navigation Draft';
   const saving=window.medControlInputDraft.save().catch(()=>false);
   const navigation=window.medcontrolNavigateTo('archive');
   await saving;const result=await navigation;Storage.prototype.setItem=native;
   return {result,path:location.pathname,value:document.getElementById('create_name')?.value};
  });
  assert.deepEqual(blockedNavigation,{result:false,path:'/input.html',value:'Synthetic Unsaved Navigation Draft'});
  console.log('PASS draft write failure preserves Input instead of navigating away');
  await full.evaluate(()=>{
   const native=Storage.prototype.setItem,encrypt=crypto.subtle.encrypt.bind(crypto.subtle);
   let release;const gate=new Promise(r=>release=r);window.releaseLogoutWrite=release;
   crypto.subtle.encrypt=async(...args)=>{await gate;return encrypt(...args);};
   Storage.prototype.setItem=function(k,v){if(k==='medcontrol_modular3_protected_state_v1')throw Error('Synthetic logout draft failure');return native.call(this,k,v);};
   document.getElementById('create_name').value='Synthetic Unsaved Logout Draft';
   window.medControlInputDraft.save().catch(()=>{});
  });
  await full.locator('[data-medcontrol-logout]').click();
  await full.evaluate(()=>window.releaseLogoutWrite());
  await full.locator('#password').waitFor();
  assert.equal((await full.locator('body').innerText()).includes('Synthetic Edited Course'),false);
  console.log('PASS logout locks medical data even when pending draft write fails');
  await full.close();
  const fresh=await browser.newContext({timezoneId:'Asia/Yerevan'});
  await fresh.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==BASE){external.push(u.origin);return route.abort();}return route.continue();});
  const entry=await fresh.newPage();entry.on('pageerror',e=>errors.push(e.message));
  await entry.goto(BASE+'/modular3-protected.html');await entry.locator('#password').fill(PASS);await entry.locator('#enroll').click();
  await entry.locator('#create_name').waitFor({timeout:15000});
  assert.equal(new URL(entry.url()).pathname,'/input.html');
  assert.ok((await entry.locator('body').innerText()).includes('VERSION 3'));
  console.log('PASS default protected entry opens complete original program without second password');
  await fresh.close();
  // T-038: isolated successful reset on synthetic records, including persistence after re-unlock.
  const resetContext=await browser.newContext({timezoneId:'Asia/Yerevan'});
  await resetContext.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==BASE){external.push(u.origin);return route.abort();}
    return route.continue();
  });
  const resetPage=await resetContext.newPage();
  resetPage.on('pageerror',e=>errors.push(e.message));
  resetPage.on('dialog',d=>d.accept());
  await resetPage.goto(BASE+'/modular3-protected.html');
  await resetPage.evaluate(async password=>{
    await window.MedControlModular3ProtectedSession.initialize({
      settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',country:'Armenia',infoDismissed:true},
      medications:[{id:'synthetic-reset-course',name:'Synthetic Archived Course',archivedCompleted:true}],
      intakeLogs:[{id:'synthetic-intake',medicationId:'synthetic-reset-course'}],
      intakeCorrections:[{id:'synthetic-correction'}],
      archiveHistory:[{id:'synthetic-history'}],
      archivedCourses:[{id:'synthetic-archive'}]
    },password);
  },PASS);
  await resetPage.goto(BASE+'/archive.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.waitForFunction(()=>typeof window.manualMedControlCycleReset==='function');
  const syntheticReset=await resetPage.evaluate(async()=>{
    const cloud=window.medcontrolCloudSnapshot;
    const credential=localStorage.getItem('medcontrol_modular3_local_credential_v1');
    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:true,remaining:0}),
      resumeAfterResetFailure:()=>{}
    };
    try{
      await window.manualMedControlCycleReset();
      const state=window.MedControlModular3ProtectedSession.read();
      return {
        empty:['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses'].every(k=>Array.isArray(state[k])&&state[k].length===0),
        credentialPreserved:credential!==null&&credential===localStorage.getItem('medcontrol_modular3_local_credential_v1'),
        encryptedVaultPresent:localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null
      };
    }finally{window.medcontrolCloudSnapshot=cloud;}
  });
  assert.deepEqual(syntheticReset,{empty:true,credentialPreserved:true,encryptedVaultPresent:true});
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.locator('#create_name').waitFor();
  const reloaded=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  for(const key of ['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses'])
    assert.deepEqual(reloaded[key],[],key+' must stay empty after restart');
  console.log('PASS T-038: isolated synthetic protected reset persists after password re-unlock');
  await resetContext.close();
  assert.deepEqual(external,[],'Protected interface must not contact external services');
  assert.deepEqual(errors,[],'Interface must load without script errors');
  console.log('PASS no external service requests or uncaught browser errors');
 }finally{if(browser)await browser.close();server.kill();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
