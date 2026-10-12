'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const cloud=fs.readFileSync(path.resolve(__dirname,'../js/cloud-snapshot.js'),'utf8');
const storage=fs.readFileSync(path.resolve(__dirname,'../js/storage.js'),'utf8');
test('cloud sync: snapshot, deduplication, offline failure, retry, restore, no data loss',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 const outcome=await page.evaluate(async({cloud,storage})=>{
  const key='affixo_medcontrol_standard_v3';
  localStorage.clear();
  (0,eval)(storage);
  const original={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'SYNTH-CLOUD',name:'Synthetic only'}],intakeLogs:[{id:'SYNTH-LOG',action:'taken'}]};
  window.getState=()=>JSON.parse(localStorage.getItem(key));
  window.saveState=(state)=>{localStorage.setItem(key,JSON.stringify(state));return true;};
  window.STORAGE_KEY=key;
  const records=[];let offline=false;let seq=0;
  const query={
   select(){return this;},order(){return this;},limit(){return this;},
   async maybeSingle(){return offline?{data:null,error:{message:'network down'}}:{data:records.at(-1)||null,error:null};},
   insert(payload){this.payload=payload;return this;},
   async single(){if(offline)return {data:null,error:{message:'network down'}};const row={id:'mock-'+(++seq),state:this.payload.state,created_at:new Date().toISOString()};records.push(row);return {data:row,error:null};}
  };
  window.medcontrolSupabase={from(table){if(table!=='mc_cloud_snapshots')throw Error('unexpected table');return query;}};
  window.medcontrolSupabaseUser={id:'synthetic-user'};
  (0,eval)(cloud);
  await window.medcontrolCloudSnapshot.flush();
  const first=await window.medcontrolCloudSnapshot.create({state:original});
  const second=await window.medcontrolCloudSnapshot.create({state:original});
  offline=true;
  const changed=JSON.parse(JSON.stringify(original));changed.intakeLogs.push({id:'SYNTH-SECOND',action:'cancelled'});
  const saved=window.saveState(changed);
  const failed=await window.medcontrolCloudSnapshot.flush();
  const localIntact=JSON.stringify(getState())===JSON.stringify(changed);
  offline=false;
  const retried=await window.medcontrolCloudSnapshot.flush();
  const latest=await window.medcontrolCloudSnapshot.latest();
  const restoreBlocked=await window.medcontrolCloudSnapshot.restoreLatest();
  const restore=await window.medcontrolCloudSnapshot.restoreLatest({overwriteExisting:true});
  return {first:first.ok,second:second.reason,saved,failed:failed.reason,localIntact,retried:retried.ok,latestCount:latest.snapshot?.state.intakeLogs.length,restoreBlocked:restoreBlocked.reason,restored:restore.ok,backupPresent:!!restore.restoreSafetyKey,recordCount:records.length};
 },{cloud,storage});
 expect(outcome).toMatchObject({first:true,second:'unchanged',saved:true,failed:'latest_snapshot_read_failed',localIntact:true,retried:true,latestCount:2,restoreBlocked:'local_state_exists',restored:true,backupPresent:true,recordCount:2});
});
test('corrupted browser state: backup preserved, startup stopped safely',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 const result=await page.evaluate(storage=>{
  localStorage.clear();
  const key='affixo_medcontrol_standard_v3';const damaged='{BROKEN-SYNTHETIC-JSON';
  localStorage.setItem(key,damaged);
  (0,eval)(storage);
  try{getState();return {unexpected:'no exception'};}catch(e){return {code:e.code,backup:localStorage.getItem(key+'_corrupt_backup'),primary:localStorage.getItem(key)};}
 },storage);
 expect(result.code).toBe('recovery_required');
 expect(result.backup).toBe('{BROKEN-SYNTHETIC-JSON');
 expect(result.primary).not.toBe('{BROKEN-SYNTHETIC-JSON');
});
