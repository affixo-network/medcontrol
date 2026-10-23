'use strict';
const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:8765';
const DATA='medcontrol_modular3_protected_state_v1';
const CRED='medcontrol_modular3_local_credential_v1';
const OLD_PASS='Synthetic-previous-local-pass-2026';
const FILE_PASS='Synthetic-new-file-pass-2026';
const OLD={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru'},medications:[{id:'old-test',name:'SYNTHETIC OLD TEST',times:['20:00'],startDate:'2099-10-18',endDate:'2099-10-18',active:false}],intakeLogs:[],unknownOldMetadata:{keep:[0,false,null]},timeHistory:[{id:'old-time'}]};
const INCOMING={settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru',infoDismissed:true},medications:Array.from({length:7},(_,i)=>({id:'source-'+i,order:i+1,name:'SYNTHETIC SOURCE '+i,times:['09:00'],timeStatuses:{'09:00':true},timeStatusHistory:[],startDate:'2099-10-01',endDate:'2099-10-31',active:false})),intakeLogs:Array.from({length:35},(_,i)=>({id:'log-'+i,medicationId:'source-'+i%7,action:'taken',plannedAt:'2099-10-01T05:00:00Z',actualAt:'2099-10-01T05:00:01Z'})),intakeCorrections:[{id:'correction'}],archivedCourses:[],archiveHistory:[{id:'archive-event'}],timeHistory:[{id:'source-time'}],unknownSourceMetadata:{keep:['all',0,false,null]}};
let transfer;
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
 await page.goto(BASE+'/modular3-protected.html');
 await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 transfer=await page.evaluate(async({OLD,INCOMING,OLD_PASS,FILE_PASS})=>{
  await MedControlModular3ProtectedSession.initialize(OLD,OLD_PASS);
  const raw=JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(INCOMING,FILE_PASS)});
  await MedControlModular3ProtectedSession.lock();
  return raw;
 },{OLD,INCOMING,OLD_PASS,FILE_PASS});
 await page.reload();
 await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
});
async function snapshot(page){return page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));}
async function preview(page){return page.evaluate(async({OLD_PASS,FILE_PASS,transfer})=>{
 await MedControlModular3ProtectedSession.unlock(OLD_PASS);
 window.importPlan=await MedControlModular3CopyMigration.previewExistingImport(transfer,FILE_PASS);
 return window.importPlan;
},{OLD_PASS,FILE_PASS,transfer});}
async function fillImport(page){
 await page.locator('#password').fill(OLD_PASS);
 await page.locator('#transfer-password').fill(FILE_PASS);
 await page.locator('#legacy-backup').setInputFiles({name:'synthetic-encrypted-transfer.json',mimeType:'application/json',buffer:Buffer.from(transfer)});
}
test('reproduces initial import refusal, then previews the existing-install transfer without writes',async({page})=>{
 const before=await snapshot(page);
 const refusal=await page.evaluate(async({transfer,FILE_PASS})=>{
  try{await MedControlModular3CopyMigration.importBackup(transfer,FILE_PASS);return '';}
  catch(e){return e.message;}
 },{transfer,FILE_PASS});
 expect(refusal).toContain('already exists');
 const plan=await preview(page);
 expect(plan.incoming).toMatchObject({medications:7,intakeLogs:35});
 expect(plan.existing).toMatchObject({medications:1,intakeLogs:0});
 expect(await snapshot(page)).toEqual(before);
});
test('activation preserves exact old ciphertext and credential while importing all source fields',async({page})=>{
 const before=await snapshot(page);await preview(page);
 const result=await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 expect(result).toMatchObject({medications:7,intakeLogs:35,previousVaultPreserved:true});
 expect((await snapshot(page))[CRED]).toBe(before[CRED]);
 const after=await page.evaluate(async({OLD_PASS})=>{
  const backups=MedControlModular3CopyMigration.listPreservedBackups();
  const raw=MedControlModular3CopyMigration.exportPreservedBackup(backups[0].key);
  const previous=await MedControlModular3EncryptedVault.open(JSON.parse(raw).encrypted,OLD_PASS);
  return {state:MedControlModular3ProtectedSession.read(),previous,backups,raw};
 },{OLD_PASS});
 expect(after.state).toEqual(INCOMING);expect(after.previous).toEqual(OLD);
 expect(after.backups).toHaveLength(1);
 expect(JSON.stringify(after)).not.toContain(OLD_PASS);
 expect(JSON.parse(after.raw).encrypted).toEqual(JSON.parse(before[DATA]));
 for(const value of Object.values(await snapshot(page))){expect(value).not.toContain('SYNTHETIC');expect(value).not.toContain('unknownOldMetadata');}
 await page.reload();
 const restored=await page.evaluate(async({OLD_PASS,FILE_PASS})=>{
  const fileCannotLogin=!(await MedControlModular3ProtectedSession.unlock(FILE_PASS));
  const localLogin=await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  return {fileCannotLogin,localLogin,state:MedControlModular3ProtectedSession.read(),backups:MedControlModular3CopyMigration.listPreservedBackups()};
 },{OLD_PASS,FILE_PASS});
 expect(restored).toMatchObject({fileCannotLogin:true,localLogin:true,state:INCOMING});
 expect(restored.backups).toHaveLength(1);
});
test('locked session and wrong file password cannot write or preserve a partial import',async({page})=>{
 const before=await snapshot(page);
 const errors=await page.evaluate(async({transfer,OLD_PASS})=>{
  const errors=[];
  try{await MedControlModular3CopyMigration.previewExistingImport(transfer,OLD_PASS);}catch(e){errors.push(e.message);}
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  try{await MedControlModular3CopyMigration.previewExistingImport(transfer,'Incorrect-file-password-2026');}catch(e){errors.push(e.message);}
  return errors;
 },{transfer,OLD_PASS});
 expect(errors).toHaveLength(2);expect(await snapshot(page)).toEqual(before);
});
test('a changed active state rejects a stale confirmation without rolling back the edit',async({page})=>{
 await preview(page);
 await page.evaluate(async()=>MedControlModular3ProtectedSession.transact(state=>{state.unknownOldMetadata.latest='confirmed edit';}));
 const before=await snapshot(page);
 const error=await page.evaluate(async()=>{try{await MedControlModular3CopyMigration.commitExistingImport(window.importPlan);return '';}catch(e){return e.message;}});
 expect(error).toContain('changed');expect(await snapshot(page)).toEqual(before);
});
for(const fault of ['backup quota','backup readback','active write']){
 test(fault+' leaves the previous vault usable and credentials unchanged',async({page})=>{
  const before=await snapshot(page);await preview(page);
  const error=await page.evaluate(async({fault,DATA})=>{
   const set=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){
    if((fault==='backup quota'&&k.includes('preserved_before_import'))||(fault==='active write'&&k===DATA))throw new DOMException('Synthetic storage failure','QuotaExceededError');
    if(fault==='backup readback'&&k.includes('preserved_before_import'))return;
    return set.call(this,k,v);
   };
   try{await MedControlModular3CopyMigration.commitExistingImport(window.importPlan);return '';}
   catch(e){return e.message;}finally{Storage.prototype.setItem=set;}
  },{fault,DATA});
  expect(error).not.toBe('');const after=await snapshot(page);
  expect(after[DATA]).toBe(before[DATA]);expect(after[CRED]).toBe(before[CRED]);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(OLD);
 });
}
test('identical repeat import does not create duplicate backups or alter ciphertext',async({page})=>{
 await preview(page);await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 const before=await snapshot(page);await preview(page);
 const result=await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 expect(result.alreadyImported).toBe(true);expect(await snapshot(page)).toEqual(before);
});
test('the preserved file can restore the previous state while retaining the imported vault',async({page})=>{
 await preview(page);await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 const result=await page.evaluate(async({OLD_PASS})=>{
  const migration=MedControlModular3CopyMigration;
  const raw=migration.exportPreservedBackup(migration.listPreservedBackups()[0].key);
  const plan=await migration.previewExistingImport(raw,OLD_PASS);
  await migration.commitExistingImport(plan);
  const backups=migration.listPreservedBackups();
  const preserved=[];
  for(const backup of backups)preserved.push(await MedControlModular3EncryptedVault.open(JSON.parse(migration.exportPreservedBackup(backup.key)).encrypted,OLD_PASS));
  return {state:MedControlModular3ProtectedSession.read(),preserved};
 },{OLD_PASS});
 expect(result.state).toEqual(OLD);expect(result.preserved).toHaveLength(2);
 expect(result.preserved).toContainEqual(OLD);expect(result.preserved).toContainEqual(INCOMING);
});
test('UI cancellation leaves storage unchanged and reports both sets of counts',async({page})=>{
 const before=await snapshot(page);await fillImport(page);
 let confirmation='';page.once('dialog',async dialog=>{confirmation=dialog.message();await dialog.dismiss();});
 await page.locator('#import-backup').click();
 await expect(page.locator('#message')).toContainText('отменён');
 expect(confirmation).toContain('7');expect(confirmation).toContain('35');expect(confirmation).toContain('1');
 expect(await snapshot(page)).toEqual(before);
});
test('UI wrong local password does not activate file or create a backup',async({page})=>{
 const before=await snapshot(page);await fillImport(page);
 await page.locator('#password').fill('Incorrect-existing-password-2026');
 await page.locator('#import-backup').click();
 await expect(page.locator('#message')).toContainText('Неверный пароль существующего хранилища');
 expect(await snapshot(page)).toEqual(before);
});
test('cancelling a second UI import locks the preview session and hides the prior Open action',async({page})=>{
 await fillImport(page);page.once('dialog',d=>d.accept());await page.locator('#import-backup').click();
 await expect(page.locator('#open-imported')).toBeVisible();
 const before=await snapshot(page);await fillImport(page);
 const previousFile=await page.evaluate(async({OLD,FILE_PASS})=>JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(OLD,FILE_PASS)}),{OLD,FILE_PASS});
 await page.locator('#legacy-backup').setInputFiles({name:'previous.json',mimeType:'application/json',buffer:Buffer.from(previousFile)});
 page.once('dialog',d=>d.dismiss());await page.locator('#import-backup').click();
 await expect(page.locator('#message')).toContainText('отменён');
 await expect(page.locator('#import-backup')).toBeEnabled();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isUnlocked())).toBe(false);
 await expect(page.locator('#open-imported')).toBeHidden();expect(await snapshot(page)).toEqual(before);
});
async function installSuperset(page){
 await page.evaluate(async({OLD_PASS,INCOMING})=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  await MedControlModular3ProtectedSession.transact(state=>{
   for(const key of Object.keys(state))delete state[key];Object.assign(state,INCOMING);
   state.medications.push({id:'extra-test',name:'SYNTHETIC EXTRA',times:['20:00']});
   state.intakeLogs.push({id:'extra-log',medicationId:'extra-test',action:'taken'});
  });
  await MedControlModular3ProtectedSession.lock();
 },{OLD_PASS,INCOMING});
}
test('full source is recognized inside eight courses and 36 events without replacing extras',async({page})=>{
 await installSuperset(page);const before=await snapshot(page);const plan=await preview(page);
 expect(plan.comparison).toMatchObject({allIncluded:true,medications:{matched:7,total:7,additional:1},intakeLogs:{matched:35,total:35,additional:1},differentFields:[]});
 const result=await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 expect(result).toMatchObject({alreadyImported:true,medications:8,intakeLogs:36});expect(await snapshot(page)).toEqual(before);
});
test('matching counts alone do not hide changed facts or missing historical fields',async({page})=>{
 await installSuperset(page);
 await page.evaluate(async OLD_PASS=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  await MedControlModular3ProtectedSession.transact(state=>{state.intakeLogs[0].actualAt='2099-10-01T05:00:02Z';delete state.unknownSourceMetadata;});
 },OLD_PASS);
 const before=await snapshot(page);const plan=await preview(page);
 expect(plan.comparison.allIncluded).toBe(false);expect(plan.comparison.intakeLogs.matched).toBe(34);
 expect(plan.comparison.differentFields).toContain('intakeLogs');expect(plan.comparison.differentFields).toContain('unknownSourceMetadata');
 expect(await snapshot(page)).toEqual(before);
});
test('comparison consumes duplicate historical entries separately',async({page})=>{
 await installSuperset(page);
 const result=await page.evaluate(async({OLD_PASS,FILE_PASS,INCOMING})=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  await MedControlModular3ProtectedSession.transact(state=>{state.audit=[{at:'same',detail:'same'}];});
  const source=structuredClone(INCOMING);source.audit=[{at:'same',detail:'same'},{at:'same',detail:'same'}];
  const raw=JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(source,FILE_PASS)});
  return (await MedControlModular3CopyMigration.previewExistingImport(raw,FILE_PASS)).comparison;
 },{OLD_PASS,FILE_PASS,INCOMING});
 expect(result.allIncluded).toBe(false);expect(result.differentFields).toContain('audit');
});
test('object property order does not change inclusion',async({page})=>{
 await installSuperset(page);
 const result=await page.evaluate(async({OLD_PASS,FILE_PASS,INCOMING})=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  await MedControlModular3ProtectedSession.transact(state=>{
   state.audit=[{a:1},{a:1,b:2}];
  });
  const source=structuredClone(INCOMING);source.audit=[{a:1},{b:2,a:1}];
  const raw=JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(source,FILE_PASS)});
  return (await MedControlModular3CopyMigration.previewExistingImport(raw,FILE_PASS)).comparison;
 },{OLD_PASS,FILE_PASS,INCOMING});
 expect(result.allIncluded).toBe(true);
});
test('reversed equal-timestamp status history cannot be reported as preserved',async({page})=>{
 const result=await page.evaluate(async({OLD_PASS,FILE_PASS,INCOMING})=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  const source=structuredClone(INCOMING);
  source.medications[0].timeStatusHistory=[{at:'2099-10-01T05:00:00Z',time:'09:00',active:false},{at:'2099-10-01T05:00:00Z',time:'09:00',active:true}];
  const target=structuredClone(source);target.medications[0].timeStatusHistory.reverse();
  await MedControlModular3ProtectedSession.transact(state=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,target);});
  const raw=JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(source,FILE_PASS)});
  return (await MedControlModular3CopyMigration.previewExistingImport(raw,FILE_PASS)).comparison;
 },{OLD_PASS,FILE_PASS,INCOMING});
 expect(result.allIncluded).toBe(false);expect(result.differentFields).toContain('medications');
});
test('read-only UI check reports full source inclusion and retains the extra course and event',async({page})=>{
 await installSuperset(page);const before=await snapshot(page);await fillImport(page);
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss();});
 await page.locator('#inspect-migration').click();
 await expect(page.locator('#message')).toContainText('Курсов из файла найдено: 7 из 7');
 await expect(page.locator('#message')).toContainText('событий приёма: 35 из 35');
 await expect(page.locator('#message')).toContainText('Различий в полях файла: 0');
 await expect(page.locator('#message')).toContainText('Повторный импорт не требуется');
 await expect(page.locator('#inspect-migration')).toBeEnabled();
 expect(dialogs).toBe(0);expect(await snapshot(page)).toEqual(before);
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isUnlocked())).toBe(false);
});
test('import UI recognizes an already preserved source without asking to replace the larger current state',async({page})=>{
 await installSuperset(page);const before=await snapshot(page);await fillImport(page);
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss();});
 await page.locator('#import-backup').click();
 await expect(page.locator('#message')).toContainText('Все данные выбранного файла уже присутствуют');
 await expect(page.locator('#message')).toContainText('Препаратов: 8; приёмов: 36');
 expect(dialogs).toBe(0);expect(await snapshot(page)).toEqual(before);
});
test('plaintext, malformed histories and invalid JSON are refused without writes',async({page})=>{
 const before=await snapshot(page);
 const rejected=await page.evaluate(async({OLD_PASS,FILE_PASS,INCOMING})=>{
  await MedControlModular3ProtectedSession.unlock(OLD_PASS);
  const malformed=structuredClone(INCOMING);malformed.archiveHistory={bad:true};
  const inputs=['{broken-json',JSON.stringify(INCOMING),JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(malformed,FILE_PASS)})];
  let refused=0;
  for(const raw of inputs){try{await MedControlModular3CopyMigration.previewExistingImport(raw,FILE_PASS);}catch(_){refused++;}}
  return refused;
 },{OLD_PASS,FILE_PASS,INCOMING});
 expect(rejected).toBe(3);expect(await snapshot(page)).toEqual(before);
});
test('preexisting plaintext source is never changed by protected activation',async({page})=>{
 await page.evaluate(INCOMING=>localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(INCOMING)),INCOMING);
 const before=await snapshot(page);await preview(page);
 await page.evaluate(async()=>MedControlModular3CopyMigration.commitExistingImport(window.importPlan));
 const after=await snapshot(page);expect(after.affixo_medcontrol_standard_v3).toBe(before.affixo_medcontrol_standard_v3);
});
test('UI imports seven courses and 35 events, downloads the old copy, and opens the full original interface',async({page,context})=>{
 await fillImport(page);page.once('dialog',d=>d.accept());await page.locator('#import-backup').click();
 await expect(page.locator('#message')).toContainText('Препаратов: 7; приёмов: 35');
 await expect(page.locator('#message')).toContainText('Пароль входа остался прежним');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-preserved-backup').click()]);
 const fs=require('node:fs');const raw=fs.readFileSync(await download.path(),'utf8');
 const old=await page.evaluate(async({raw,OLD_PASS})=>MedControlModular3EncryptedVault.open(JSON.parse(raw).encrypted,OLD_PASS),{raw,OLD_PASS});
 expect(old).toEqual(OLD);
 await page.locator('#open-imported').click();
 await expect(page.locator('#create_name')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(INCOMING);
 await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true);
 await context.setOffline(true);await page.reload();
 await page.locator('#password').fill(OLD_PASS);await page.locator('#unlock').click();
 await expect(page.locator('#create_name')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(INCOMING);
});
