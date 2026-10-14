'use strict';
const {test,expect}=require('@playwright/test');
const ORIGIN='http://127.0.0.1:8765';
const SOURCE='affixo_medcontrol_standard_v3';
const DEST='medcontrol_modular3_protected_state_v1';
const CREDENTIAL='medcontrol_modular3_local_credential_v1';
const PASS='Synthetic-Migration-Passphrase-2026';
const SAMPLE={
  medications:[
    {id:'synthetic-a',name:'SYNTHETIC A',times:['09:00','14:00'],startDate:'2026-10-10',endDate:'2026-10-17'},
    {id:'synthetic-b',name:'SYNTHETIC B',times:['12:00'],startDate:'2026-10-11',endDate:'2026-10-18'},
    {id:'synthetic-archived',name:'SYNTHETIC ARCHIVED',times:['18:45'],archived:true}
  ],
  intakeLogs:[
    {id:'synthetic-log-1',medicationId:'synthetic-a',plannedAt:'2026-10-14T05:00:00.000Z',actualAt:'2026-10-14T05:31:14.000Z',status:'accepted'},
    {id:'synthetic-log-2',medicationId:'synthetic-b',plannedAt:'2026-10-14T08:00:00.000Z',actualAt:'2026-10-14T08:03:15.000Z',status:'accepted'}
  ],
  intakeCorrections:[{id:'synthetic-cancel-1',intakeId:'synthetic-log-1',type:'cancel',at:'2026-10-14T05:32:00.000Z'}],
  archiveHistory:[{id:'synthetic-archive-history',courseId:'synthetic-archived',event:'completed'}],
  metadata:{source:'synthetic-only',version:3}
};
async function prepare(page,brokenWrites=false){
 await page.addInitScript(({SOURCE,SAMPLE,brokenWrites,DEST})=>{
  localStorage.setItem(SOURCE,JSON.stringify(SAMPLE));
  if(brokenWrites){
   const nativeSet=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
    if(key===DEST)throw new DOMException('Synthetic quota failure','QuotaExceededError');
    return nativeSet.call(this,key,value);
   };
  }
 },{SOURCE,SAMPLE,brokenWrites,DEST});
 await page.goto(ORIGIN+'/modular3-protected.html');
 await page.addScriptTag({url:ORIGIN+'/js/modular3-copy-migration.js'});
}
test('copy migration preserves multiple courses, planned/actual intakes, cancellation and archive across offline restart',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan'});
 const page=await context.newPage();
 await prepare(page);
 const result=await page.evaluate(async({PASS,SOURCE,DEST,CREDENTIAL,SAMPLE})=>{
  const migrate=MedControlModular3CopyMigration;
  const before=localStorage.getItem(SOURCE);
  const preview=await migrate.preview(PASS);
  if(localStorage.getItem(DEST)!==null||localStorage.getItem(CREDENTIAL)!==null)throw Error('Preview mutated destination');
  const committed=await migrate.commit(PASS);
  const cipher=localStorage.getItem(DEST);
  const restored=await MedControlModular3EncryptedVault.open(JSON.parse(cipher),PASS);
  return {before,sameSource:before===localStorage.getItem(SOURCE),preview,committed,cipher,restored};
 },{PASS,SOURCE,DEST,CREDENTIAL,SAMPLE});
 expect(result.sameSource).toBe(true);
 expect(result.restored).toEqual(SAMPLE);
 expect(result.committed).toMatchObject({medications:3,intakeLogs:2,sourcePreserved:true});
 expect(result.cipher).not.toContain('SYNTHETIC A');
 expect(result.cipher).not.toContain('synthetic-log-1');
 await page.reload();
 await context.setOffline(true);
 const offline=await page.evaluate(async({PASS,DEST,SOURCE})=>{
  const raw=localStorage.getItem(DEST);
  const credential=await MedControlModular3OfflineCredential.unlock(PASS);
  const restored=await MedControlModular3EncryptedVault.open(JSON.parse(raw),PASS);
  return {credential,restored,source:localStorage.getItem(SOURCE)};
 },{PASS,DEST,SOURCE});
 expect(offline.credential).toBe(true);
 expect(offline.restored).toEqual(SAMPLE);
 expect(offline.source).toBe(result.before);
 await context.close();
});
test('copy migration rejects storage write fault and preserves original and credential state',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await prepare(page,true);
 const result=await page.evaluate(async({PASS,SOURCE,DEST,CREDENTIAL})=>{
  const source=localStorage.getItem(SOURCE);
  let error='';
  try{await MedControlModular3CopyMigration.commit(PASS);}catch(e){error=String(e.name||e.message);}
  return {error,unchanged:source===localStorage.getItem(SOURCE),dest:localStorage.getItem(DEST),credential:localStorage.getItem(CREDENTIAL)};
 },{PASS,SOURCE,DEST,CREDENTIAL});
 expect(result.error).toContain('QuotaExceededError');
 expect(result.unchanged).toBe(true);
 expect(result.dest).toBeNull();
 expect(result.credential).toBeNull();
 await context.close();
});
test('copy migration refuses existing destination and never overwrites legacy state',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await prepare(page);
 const result=await page.evaluate(async({PASS,SOURCE,DEST})=>{
  const before=localStorage.getItem(SOURCE);
  localStorage.setItem(DEST,'PREEXISTING-DO-NOT-OVERWRITE');
  let error='';
  try{await MedControlModular3CopyMigration.commit(PASS);}catch(e){error=e.message;}
  return {error,sourceStable:localStorage.getItem(SOURCE)===before,destination:localStorage.getItem(DEST)};
 },{PASS,SOURCE,DEST});
 expect(result.error).toMatch(/already exists/i);
 expect(result.sourceStable).toBe(true);
 expect(result.destination).toBe('PREEXISTING-DO-NOT-OVERWRITE');
 await context.close();
});

test('interrupted migration after encrypted checkpoint keeps original and supports safe recovery',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 await prepare(page);
 const first=await page.evaluate(async({PASS,SOURCE,DEST,CREDENTIAL})=>{
  const original=localStorage.getItem(SOURCE);
  const native=MedControlModular3OfflineCredential.enroll;
  // Simulate a process interruption after checkpoint but before credential enrollment.
  const checkpoint=await MedControlModular3CopyMigration.preview(PASS);
  localStorage.setItem(DEST,JSON.stringify(checkpoint.encrypted));
  return {original,checkpointPresent:!!localStorage.getItem(DEST),credential:localStorage.getItem(CREDENTIAL)};
 },{PASS,SOURCE,DEST,CREDENTIAL});
 expect(first.checkpointPresent).toBe(true);
 expect(first.credential).toBeNull();
 await page.reload();
 const after=await page.evaluate(async({PASS,SOURCE,DEST,CREDENTIAL})=>{
  const source=localStorage.getItem(SOURCE);
  const encrypted=JSON.parse(localStorage.getItem(DEST));
  const restored=await MedControlModular3EncryptedVault.open(encrypted,PASS);
  let rejected=false;
  try{await MedControlModular3CopyMigration.commit(PASS);}catch(e){rejected=/already exists/i.test(e.message);}
  return {source,restored,rejected,credential:localStorage.getItem(CREDENTIAL)};
 },{PASS,SOURCE,DEST,CREDENTIAL});
 expect(after.source).toBe(first.original);
 expect(after.restored).toEqual(SAMPLE);
 expect(after.rejected).toBe(true);
 expect(after.credential).toBeNull();
 const recovered=await page.evaluate(async({PASS,SOURCE,DEST,CREDENTIAL})=>{
  const result=await MedControlModular3CopyMigration.resume(PASS);
  return {result,source:localStorage.getItem(SOURCE),destination:localStorage.getItem(DEST),credential:localStorage.getItem(CREDENTIAL)};
 },{PASS,SOURCE,DEST,CREDENTIAL});
 expect(recovered.result).toMatchObject({recovered:true,sourcePreserved:true,medications:3,intakeLogs:2});
 expect(recovered.source).toBe(first.original);
 expect(recovered.destination).not.toBeNull();
 expect(recovered.credential).not.toBeNull();
 await page.reload();
 expect(await page.evaluate(async(PASS)=>MedControlModular3ProtectedSession.unlock(PASS),PASS)).toBe(true);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(SAMPLE);
 await context.close();
});
