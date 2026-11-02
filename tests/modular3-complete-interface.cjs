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
  // Use Node's HTTP client for readiness: undici fetch can assert on socket teardown.
  const http=require('node:http');
  for(let i=0;i<100;i++){
    const ready=await new Promise(resolve=>{
      const request=http.get(BASE+'/input.html',response=>{
        response.resume();response.on('end',()=>resolve(response.statusCode===200));
        response.on('error',()=>resolve(false));
      });
      request.on('error',()=>resolve(false));
    });
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
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
  // T-038: owner-scoped cloud deletion is tested with an in-memory Supabase mock only.
  const syntheticCloudDeletion=await full.evaluate(async()=>{
    const originalClient=window.medcontrolSupabase;
    const originalUser=window.medcontrolSupabaseUser;
    const snapshot=window.medcontrolCloudSnapshot;
    let count=2;
    const deletedOwners=[];
    window.medcontrolSupabaseUser={id:'synthetic-owner-reset'};
    window.medcontrolSupabase={
      from:table=>{
        if(table!=='mc_cloud_snapshots')throw Error('Unexpected table '+table);
        return {
          select:()=>({eq:async(column,owner)=>{
            if(column!=='owner_user_id'||owner!=='synthetic-owner-reset')throw Error('Unscoped inventory');
            return {count,error:null};
          }}),
          delete:()=>({eq:async(column,owner)=>{
            if(column!=='owner_user_id'||owner!=='synthetic-owner-reset')throw Error('Unscoped delete');
            deletedOwners.push(owner);count=0;return {error:null};
          }})
        };
      }
    };
    try{
      await snapshot.suspendForReset();
      const result=await snapshot.deleteOwnSnapshotsForConfirmedReset();
      return {ok:result.ok,empty:result.empty,remaining:result.remaining,deletedOwners};
    }finally{
      snapshot.resumeAfterResetFailure();
      window.medcontrolSupabase=originalClient;
      window.medcontrolSupabaseUser=originalUser;
    }
  });
  assert.deepEqual(syntheticCloudDeletion,{
    ok:true,empty:true,remaining:0,deletedOwners:['synthetic-owner-reset']
  },'Confirmed reset must delete only owner-scoped cloud snapshots and verify zero remaining');
  console.log('PASS T-038: synthetic owner-scoped cloud snapshot deletion and zero-inventory verification');
  // T-038: a cloud deletion API error must not be misreported as a clean wipe.
  const syntheticCloudDeletionFailure=await full.evaluate(async()=>{
    const originalClient=window.medcontrolSupabase;
    const originalUser=window.medcontrolSupabaseUser;
    const snapshot=window.medcontrolCloudSnapshot;
    const before=JSON.stringify(getState());
    let deletionAttempted=false;
    window.medcontrolSupabaseUser={id:'synthetic-failed-owner'};
    window.medcontrolSupabase={
      from:table=>{
        if(table!=='mc_cloud_snapshots')throw Error('Unexpected table');
        return {
          select:()=>({eq:async()=>({count:1,error:null})}),
          delete:()=>({eq:async(column,owner)=>{
            if(column!=='owner_user_id'||owner!=='synthetic-failed-owner')throw Error('Unscoped delete');
            deletionAttempted=true;
            return {error:{message:'synthetic deletion denied'}};
          }})
        };
      }
    };
    try{
      await snapshot.suspendForReset();
      const result=await snapshot.deleteOwnSnapshotsForConfirmedReset();
      return {ok:result.ok,reason:result.reason,deletionAttempted,localUnchanged:JSON.stringify(getState())===before};
    }finally{
      snapshot.resumeAfterResetFailure();
      window.medcontrolSupabase=originalClient;
      window.medcontrolSupabaseUser=originalUser;
    }
  });
  assert.deepEqual(syntheticCloudDeletionFailure,{
    ok:false,reason:'snapshot_delete_failed',deletionAttempted:true,localUnchanged:true
  },'Cloud deletion failure must be explicit and leave local medical state unchanged');
  console.log('PASS T-038: synthetic cloud deletion failure is reported without changing local records');
  // T-038: a successful delete response is insufficient if a snapshot remains.
  const syntheticCloudResidual=await full.evaluate(async()=>{
    const originalClient=window.medcontrolSupabase;
    const originalUser=window.medcontrolSupabaseUser;
    const snapshot=window.medcontrolCloudSnapshot;
    let checks=0;
    window.medcontrolSupabaseUser={id:'synthetic-residual-owner'};
    window.medcontrolSupabase={
      from:table=>{
        if(table!=='mc_cloud_snapshots')throw Error('Unexpected table');
        return {
          select:()=>({eq:async(column,owner)=>{
            if(column!=='owner_user_id'||owner!=='synthetic-residual-owner')throw Error('Unscoped inventory');
            checks++;
            return {count:1,error:null};
          }}),
          delete:()=>({eq:async(column,owner)=>{
            if(column!=='owner_user_id'||owner!=='synthetic-residual-owner')throw Error('Unscoped delete');
            return {error:null};
          }})
        };
      }
    };
    try{
      await snapshot.suspendForReset();
      const result=await snapshot.deleteOwnSnapshotsForConfirmedReset();
      return {ok:result.ok,reason:result.reason,remaining:result.remaining,checks};
    }finally{
      snapshot.resumeAfterResetFailure();
      window.medcontrolSupabase=originalClient;
      window.medcontrolSupabaseUser=originalUser;
    }
  });
  assert.deepEqual(syntheticCloudResidual,{
    ok:false,reason:'snapshot_delete_incomplete',remaining:1,checks:2
  },'Reset must not claim cloud deletion success while a snapshot remains');
  console.log('PASS T-038: residual cloud backup blocks false completion after delete response');
  // T-038: changing the signed-in cloud owner during inventory must stop deletion.
  const syntheticOwnerSwitch=await full.evaluate(async()=>{
    const originalClient=window.medcontrolSupabase;
    const originalUser=window.medcontrolSupabaseUser;
    const snapshot=window.medcontrolCloudSnapshot;
    let deletes=0;
    const client={
      from:table=>{
        if(table!=='mc_cloud_snapshots')throw Error('Unexpected table');
        return {
          select:()=>({eq:async()=>{
            window.medcontrolSupabaseUser={id:'different-owner'};
            return {count:1,error:null};
          }}),
          delete:()=>({eq:async()=>{deletes++;return {error:null};}})
        };
      }
    };
    window.medcontrolSupabase=client;
    window.medcontrolSupabaseUser={id:'original-owner'};
    try{
      await snapshot.suspendForReset();
      const result=await snapshot.deleteOwnSnapshotsForConfirmedReset();
      return {ok:result.ok,reason:result.reason,deletes};
    }finally{
      snapshot.resumeAfterResetFailure();
      window.medcontrolSupabase=originalClient;
      window.medcontrolSupabaseUser=originalUser;
    }
  });
  assert.deepEqual(syntheticOwnerSwitch,{
    ok:false,reason:'auth_changed_during_inventory',deletes:0
  },'Owner change during cloud inventory must prevent all deletion');
  console.log('PASS T-038: cloud account switch prevents deletion');
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
      intakeCorrections:[{id:'synthetic-correction',medicationId:'synthetic-reset-course'}],
      archiveHistory:[{id:'synthetic-history',medicationId:'synthetic-reset-course'}],
      archivedCourses:[{id:'synthetic-reset-course',medicationId:'synthetic-reset-course'}],
       timeHistory:[{id:'synthetic-time-change',medicationId:'synthetic-reset-course'}],
      deletedTimes:[{medicationId:'synthetic-reset-course',time:'09:00'}],
      replacedTimes:[{medicationId:'synthetic-reset-course',from:'09:00',to:'10:00'}]
    },password);
  },PASS);
  await resetPage.goto(BASE+'/archive.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.waitForFunction(()=>typeof window.manualMedControlCycleReset==='function');
  const syntheticReset=await resetPage.evaluate(async()=>{
    const cloud=window.medcontrolCloudSnapshot;
    const credential=localStorage.getItem('medcontrol_modular3_local_credential_v1');
    const legacyKeys=[
      'affixo_medcontrol_standard_v3',
      'affixo_medcontrol_standard_v3_pre_reset_backup',
      'affixo_medcontrol_standard_v3_corrupt_backup',
      'affixo_medcontrol_standard_v3_pre_modular_2_upgrade_backup',
      'affixo_medcontrol_standard_v3_before_cloud_restore_synthetic'
    ];
    for(const key of legacyKeys)localStorage.setItem(key,JSON.stringify({synthetic:true}));

    window.medcontrolCloudSnapshot={
      suspendForReset:async()=>({ok:true,skipped:true}),
      verifyOwnSnapshotInventoryForReset:async()=>({ok:true,empty:true,remaining:0}),
      deleteOwnSnapshotsForConfirmedReset:async()=>{
        // Simulate a legacy backup arriving after the first inventory.
        localStorage.setItem('affixo_medcontrol_standard_v3_before_cloud_restore_late',JSON.stringify({synthetic:true}));
        return {ok:true,empty:true,remaining:0};
      },
      resumeAfterResetFailure:()=>{}
    };
    try{
      await window.manualMedControlCycleReset();
      const state=window.MedControlModular3ProtectedSession.read();
      return {
        empty:['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses','timeHistory'].every(k=>Array.isArray(state[k])&&state[k].length===0),
        temporalHistoryRemoved:!Object.prototype.hasOwnProperty.call(state,'deletedTimes')&&!Object.prototype.hasOwnProperty.call(state,'replacedTimes'),
        credentialPreserved:credential!==null&&credential===localStorage.getItem('medcontrol_modular3_local_credential_v1'),
        encryptedVaultPresent:localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null,
        legacyRemoved:legacyKeys.every(key=>localStorage.getItem(key)===null)&&
          localStorage.getItem('affixo_medcontrol_standard_v3_before_cloud_restore_late')===null
      };
    }finally{window.medcontrolCloudSnapshot=cloud;}
  });
  assert.deepEqual(syntheticReset,{empty:true,temporalHistoryRemoved:true,credentialPreserved:true,encryptedVaultPresent:true,legacyRemoved:true});
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.locator('#create_name').waitFor();
  const reloaded=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  for(const key of ['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses','timeHistory'])
    assert.deepEqual(reloaded[key],[],key+' must stay empty after restart');
  assert.equal(Object.prototype.hasOwnProperty.call(reloaded,'deletedTimes'),false,'deleted times must stay removed after restart');
  assert.equal(Object.prototype.hasOwnProperty.call(reloaded,'replacedTimes'),false,'replaced times must stay removed after restart');
  // T-046: a fresh protected course can be created after the completed reset.
  await resetPage.evaluate(async()=>{
    await window.MedControlModular3ProtectedSession.transact(state=>{
      assertNewCourseState(state);
      state.medications.push({id:'t046-new-course',name:'Synthetic New Course After Reset',archivedCompleted:false});
    });
    function assertNewCourseState(state){
      if(!Array.isArray(state.medications)||state.medications.length!==0)
        throw new Error('T-046 expected an empty medical course list before creating a new course');
    }
  });
  const created=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  assert.deepEqual(created.medications.map(m=>m.id),['t046-new-course'],'T-046 new course must be saved');
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.locator('#create_name').waitFor();
  const persistedNewCourse=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  assert.deepEqual(persistedNewCourse.medications.map(m=>m.id),['t046-new-course'],'T-046 new course must persist after password re-unlock');
  console.log('PASS T-046: new synthetic course saved after reset and persists after password re-unlock');

  // T-046 UI: use the real Input form and both confirmation steps.
  await resetPage.evaluate(()=>{
    const set=(id,value)=>{const el=document.getElementById(id);if(!el)throw Error('Missing form field '+id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
    set('create_name','Synthetic Form Course After Reset');
    set('create_manufacturer','Synthetic Manufacturer');
    set('create_contentValue','1');
    const content=document.getElementById('create_contentUnit');
    if(!content?.options.length)throw Error('Missing content unit options');
    set('create_contentUnit',[...content.options].find(o=>o.value&&o.value!=='other')?.value||'');
    set('create_intakeQuantity','1');
    const intake=document.getElementById('create_intakeUnit');
    if(!intake?.options.length)throw Error('Missing intake unit options');
    set('create_intakeUnit',[...intake.options].find(o=>o.value&&o.value!=='other')?.value||'');
    set('create_details','Synthetic UI test only');
    set('create_scheduleType','daily');
    set('create_times','09:00');
    set('create_startDate','2026-11-02');
    set('create_endDate','2026-11-09');
    // Report the precise form validation failure rather than waiting on a hidden dialog.
    try{createMedicationFromForm('create_');}catch(error){throw new Error('T-046 form validation: '+error.message);}
    window.createMedication();
    if(!document.getElementById('medicationConfirmDialog')?.open)throw new Error('T-046 confirmation did not open after valid form');
  });
  await resetPage.locator('#medicationConfirmDialog[open]').waitFor();
  await resetPage.evaluate(()=>window.proceedMedicationCreateConfirmation());
  await resetPage.locator('#medicationSaveDialog[open]').waitFor();
  await resetPage.evaluate(()=>window.confirmMedicationCreate());
  await resetPage.waitForFunction(()=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.name==='Synthetic Form Course After Reset'));
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.locator('#create_name').waitFor();
  const uiCreated=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications);
  assert.equal(uiCreated.filter(m=>m.name==='Synthetic Form Course After Reset').length,1,'T-046 UI-created course must persist after restart');
  console.log('PASS T-046: Input form creates a new course after reset and it persists after password re-unlock');

  // T-046 repeatability: create two more courses through the same real UI, without another reset.
  for(const [index,name] of ['Synthetic Second Course After Reset','Synthetic Third Course After Reset'].entries()){
    await resetPage.evaluate(({name,index})=>{
      const set=(id,value)=>{const el=document.getElementById(id);if(!el)throw Error('Missing form field '+id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
      set('create_name',name);
      set('create_manufacturer','Synthetic Manufacturer');
      set('create_contentValue','1');
      const content=document.getElementById('create_contentUnit');
      set('create_contentUnit',[...content.options].find(o=>o.value&&o.value!=='other')?.value||'');
      set('create_intakeQuantity','1');
      const intake=document.getElementById('create_intakeUnit');
      set('create_intakeUnit',[...intake.options].find(o=>o.value&&o.value!=='other')?.value||'');
      set('create_details','Synthetic repeated UI course');
      set('create_scheduleType','daily');
      set('create_times',index===0?'10:00':'11:00');
      set('create_startDate','2026-11-02');
      set('create_endDate','2026-11-09');
      createMedicationFromForm('create_');
      window.createMedication();
      if(!document.getElementById('medicationConfirmDialog')?.open)throw Error('Repeated course confirmation not open');
    },{name,index});
    await resetPage.locator('#medicationConfirmDialog[open]').waitFor();
    await resetPage.evaluate(()=>window.proceedMedicationCreateConfirmation());
    await resetPage.locator('#medicationSaveDialog[open]').waitFor();
    await resetPage.evaluate(()=>window.confirmMedicationCreate());
    await resetPage.waitForFunction(name=>window.MedControlModular3ProtectedSession.read().medications.some(m=>m.name===name),name);
  }
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.locator('#create_name').waitFor();
  const repeated=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications);
  for(const name of ['Synthetic Form Course After Reset','Synthetic Second Course After Reset','Synthetic Third Course After Reset'])
    assert.equal(repeated.filter(m=>m.name===name).length,1,'Repeated UI course must persist: '+name);
  console.log('PASS T-046: three consecutive UI-created courses persist after one reset and password re-unlock');

  // T-046 scale check: 300 and 3000 total courses in the protected store.
  // Bulk fixture writes are not a substitute for creating 3000 courses through the UI.
  for(const target of [300,3000]){
    const before=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.length);
    const start=Date.now();
    for(let offset=before;offset<target;offset+=100){
      const count=Math.min(100,target-offset);
      await resetPage.evaluate(async({offset,count})=>{
        await window.MedControlModular3ProtectedSession.transact(state=>{
          for(let i=offset;i<offset+count;i++)
            state.medications.push({id:'t046-scale-'+i,name:'Synthetic Scale Course '+i,archivedCompleted:false});
        });
      },{offset,count});
    }
    const actual=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications.length);
    assert.equal(actual,target,'T-046 protected scale count before restart');
    console.log('PASS T-046: '+target+' synthetic courses stored in protected vault ('+(Date.now()-start)+' ms)');
  }
  await resetPage.goto(BASE+'/input.html');
  await resetPage.locator('#password').fill(PASS);
  await resetPage.locator('#unlock').click();
  await resetPage.waitForFunction(() => {
    try { return window.MedControlModular3ProtectedSession?.read()?.medications?.length === 3000; }
    catch (_) { return false; }
  }, null, {timeout: 60000});
  // After a large vault unlock, query the DOM directly; Playwright's visibility
  // polling may time out while the page is busy rendering a large history.
  const unlocked3000=await resetPage.evaluate(()=>{
    const field=document.getElementById('create_name');
    const session=window.MedControlModular3ProtectedSession;
    const rect=field?.getBoundingClientRect();
    return {inputVisible:!!field&&getComputedStyle(field).visibility==='visible'&&!!rect?.width&&!!rect?.height,
      sessionAvailable:!!session, count:session?.read()?.medications?.length??-1};
  });
  if(!unlocked3000.inputVisible){
    const visibilityDiagnostic=await resetPage.evaluate(()=>{
      const field=document.getElementById('create_name');
      const nodes=[];
      for(let n=field,i=0;n&&i<12;n=n.parentElement,i++){
        const style=getComputedStyle(n);
        nodes.push({tag:n.tagName,id:n.id,hidden:n.hidden,display:style.display,visibility:style.visibility,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height});
      }
      return {fieldExists:!!field,nodes};
    });
    console.log('T-046 3000-course visibility diagnostic: '+JSON.stringify(visibilityDiagnostic));
  }
  assert.equal(unlocked3000.inputVisible,true,'T-046 Input must remain visible after 3000-course re-unlock: '+JSON.stringify(unlocked3000));
  assert.equal(unlocked3000.sessionAvailable,true,'T-046 protected session must remain available');
  assert.equal(unlocked3000.count,3000,'T-046 protected session must restore 3000 courses');
  const scaled=await resetPage.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications);
  assert.equal(scaled.length,3000,'T-046 3000 courses must persist after password re-unlock');
  assert.equal(new Set(scaled.map(m=>m.id)).size,3000,'T-046 3000 course IDs must remain unique');
  console.log('PASS T-046: 3000 synthetic courses persist after password re-unlock');

  // Explicit opt-in destructive-to-test-data stress mode: up to 1,000,000 courses.
  // Never run against a real vault. Browser storage quota/performance may prevent completion.
  // This is a storage stress test, NOT one million user-interface submissions.
  if(process.env.MEDCONTROL_T046_MILLION==='1'){
    const target=1_000_000;
    const started=Date.now();
    const result=await resetPage.evaluate(async target=>{
      const session=window.MedControlModular3ProtectedSession;
      const existing=session.read().medications.length;
      // One protected write avoids quadratic repeated re-encryption of the entire vault.
      await session.transact(state=>{
        for(let i=existing;i<target;i++)
          state.medications.push({id:'t046-million-'+i,name:'Synthetic Scale Course '+i,archivedCompleted:false});
      });
      const items=session.read().medications;
      return {count:items.length,unique:new Set(items.map(m=>m.id)).size};
    },target);
    assert.deepEqual(result,{count:target,unique:target},'T-046 million course integrity before restart');
    console.log('PASS T-046: 1000000 protected synthetic courses written in '+(Date.now()-started)+' ms');
    await resetPage.goto(BASE+'/input.html');
    await resetPage.locator('#password').fill(PASS);
    await resetPage.locator('#unlock').click();
    await resetPage.locator('#create_name').waitFor();
    const after=await resetPage.evaluate(()=>{
      const items=window.MedControlModular3ProtectedSession.read().medications;
      return {count:items.length,unique:new Set(items.map(m=>m.id)).size};
    });
    assert.deepEqual(after,{count:target,unique:target},'T-046 million course integrity after re-unlock');
    console.log('PASS T-046: 1000000 protected synthetic courses persist after password re-unlock');
  }




  const legacyAfterRestart=await resetPage.evaluate(()=>{
    const remaining=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&(key==='affixo_medcontrol_standard_v3'||
        /^affixo_medcontrol_standard_v3_(?:before_cloud_restore_|.*(?:backup|snapshot))/i.test(key)))
        remaining.push(key);
    }
    return remaining;
  });
  assert.deepEqual(legacyAfterRestart,[],'Legacy medical backups must stay absent after restart');
  console.log('PASS T-038: isolated synthetic protected reset persists after password re-unlock');
  await resetContext.close();
  assert.deepEqual(external,[],'Protected interface must not contact external services');
  assert.deepEqual(errors,[],'Interface must load without script errors');
  console.log('PASS no external service requests or uncaught browser errors');
 }finally{
  if(browser)await browser.close();
  // Wait for the local HTTP server to exit before Node tears down open sockets.
  if(server.exitCode===null&&!server.killed){
   await new Promise(resolve=>{
    const timeout=setTimeout(resolve,3000);
    server.once('exit',()=>{clearTimeout(timeout);resolve();});
    server.kill();
   });
  }
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
