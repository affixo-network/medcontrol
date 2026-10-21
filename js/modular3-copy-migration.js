/* Opt-in copy-only migration. Original state and backups are never overwritten. */
(function(root){
 'use strict';
 const SOURCE='affixo_medcontrol_standard_v3';
 const DEST='medcontrol_modular3_protected_state_v1';
 const CREDENTIAL='medcontrol_modular3_local_credential_v1';
 const VAULT=root.MedControlModular3EncryptedVault;
 const CRED=root.MedControlModular3OfflineCredential;
 if(!VAULT||!CRED)throw Error('Protected migration dependencies unavailable');
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function validateLegacy(parsed){
  if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.medications)||!Array.isArray(parsed.intakeLogs))throw Error('legacy_invalid_shape');
  const counts={medications:parsed.medications.length,intakeLogs:parsed.intakeLogs.length};
  for(const key of ['intakeCorrections','archiveHistory','archivedCourses','timeHistory']){
   if(Object.prototype.hasOwnProperty.call(parsed,key)){
    if(!Array.isArray(parsed[key]))throw Error('legacy_invalid_'+key);
    counts[key]=parsed[key].length;
   }
  }
  return counts;
 }
 function inspect(){
  const source=localStorage.getItem(SOURCE);
  const destinationPresent=localStorage.getItem(DEST)!==null;
  const credentialPresent=localStorage.getItem(CREDENTIAL)!==null;
  if(source===null)return Object.freeze({ready:false,reason:'legacy_missing',destinationPresent,credentialPresent});
  let parsed;
  try{parsed=JSON.parse(source);}catch(_){return Object.freeze({ready:false,reason:'legacy_invalid_json',destinationPresent,credentialPresent});}
  let counts;
  try{counts=validateLegacy(parsed);}catch(error){return Object.freeze({ready:false,reason:error.message,destinationPresent,credentialPresent});}
  return Object.freeze({ready:!destinationPresent&&!credentialPresent,reason:destinationPresent||credentialPresent?'protected_account_exists':'ready',destinationPresent,credentialPresent,counts:Object.freeze(counts)});
 }
 async function preview(password){
  if(localStorage.getItem(DEST)!==null||localStorage.getItem(CREDENTIAL)!==null)throw Error('Protected account already exists');
  const original=localStorage.getItem(SOURCE);
  if(!original)throw Error('Legacy data not found');
  const parsed=JSON.parse(original);
  validateLegacy(parsed);
  const encrypted=await VAULT.seal(parsed,password);
  const restored=await VAULT.open(encrypted,password);
  if(!equal(parsed,restored))throw Error('Round-trip mismatch');
  if(localStorage.getItem(SOURCE)!==original)throw Error('Source changed during migration');
  return Object.freeze({medications:parsed.medications.length,intakeLogs:parsed.intakeLogs.length,encrypted,source:original});
 }
 async function resume(password){
  const source=localStorage.getItem(SOURCE);
  const destination=localStorage.getItem(DEST);
  if(!source||!destination||localStorage.getItem(CREDENTIAL)!==null)throw Error('No recoverable migration checkpoint');
  const original=JSON.parse(source);
  validateLegacy(original);
  const restored=await VAULT.open(JSON.parse(destination),password);
  if(!equal(restored,original))throw Error('Checkpoint does not match original');
  if(localStorage.getItem(SOURCE)!==source||localStorage.getItem(DEST)!==destination||localStorage.getItem(CREDENTIAL)!==null)throw Error('Migration state changed');
  await CRED.enroll(password);
  if(localStorage.getItem(SOURCE)!==source||localStorage.getItem(DEST)!==destination)throw Error('Migration state changed after enrollment');
  if(!await CRED.unlock(password))throw Error('Credential verification failed');
  if(!equal(await VAULT.open(JSON.parse(localStorage.getItem(DEST)),password),original))throw Error('Post-enrollment vault mismatch');
  return Object.freeze({medications:restored.medications.length,intakeLogs:restored.intakeLogs.length,sourcePreserved:true,recovered:true});
 }
 async function commit(password){
  const check=await preview(password);
  if(localStorage.getItem(DEST)!==null||localStorage.getItem(CREDENTIAL)!==null||localStorage.getItem(SOURCE)!==check.source)throw Error('Migration state changed');
  const serialized=JSON.stringify(check.encrypted);
  localStorage.setItem(DEST,serialized);
  try{
   const stored=localStorage.getItem(DEST);
   if(stored!==serialized)throw Error('Encrypted checkpoint mismatch');
   const restored=await VAULT.open(JSON.parse(stored),password);
   if(!equal(restored,JSON.parse(check.source)))throw Error('Restored state mismatch');
   if(localStorage.getItem(SOURCE)!==check.source)throw Error('Legacy source changed');
   await CRED.enroll(password);
   if(localStorage.getItem(SOURCE)!==check.source)throw Error('Legacy source changed after enrollment');
   if(!await CRED.unlock(password))throw Error('Credential verification failed');
   if(!equal(await VAULT.open(JSON.parse(localStorage.getItem(DEST)),password),JSON.parse(check.source)))throw Error('Post-enrollment vault mismatch');
   return Object.freeze({medications:restored.medications.length,intakeLogs:restored.intakeLogs.length,sourcePreserved:true});
  }catch(error){
   if(localStorage.getItem(CREDENTIAL)===null&&localStorage.getItem(DEST)===serialized)localStorage.removeItem(DEST);
   throw error;
  }
 }
 async function importBackup(raw,password){
  // Import a user-selected local backup without ever persisting its plaintext.
  if(typeof raw!=='string'||!raw.length||raw.length>20*1024*1024)throw Error('Invalid backup file size');
  if(!navigator.locks?.request)throw Error('Cross-tab storage locking unavailable');
  return navigator.locks.request('medcontrol-modular3-initialize',{mode:'exclusive'},async()=>{
   if(localStorage.getItem(DEST)!==null||localStorage.getItem(CREDENTIAL)!==null)throw Error('Protected account already exists');
   let documentState;
   try{documentState=JSON.parse(raw);}catch(_){throw Error('Backup is not valid JSON');}
   const encryptedTransfer=documentState?.format==='medcontrol-encrypted-transfer-v1';
   const candidate=encryptedTransfer
    ?await VAULT.open(documentState.encrypted,password)
    :(documentState&&typeof documentState==='object'&&documentState.state&&typeof documentState.state==='object'?documentState.state:documentState);
   validateLegacy(candidate);
   const source=JSON.stringify(candidate);
   const encrypted=encryptedTransfer?documentState.encrypted:await VAULT.seal(candidate,password);
   if(!equal(await VAULT.open(encrypted,password),candidate))throw Error('Backup encryption verification failed');
   if(localStorage.getItem(DEST)!==null||localStorage.getItem(CREDENTIAL)!==null)throw Error('Protected account already exists');
   const checkpoint=JSON.stringify(encrypted);
   localStorage.setItem(DEST,checkpoint);
   try{
    if(localStorage.getItem(DEST)!==checkpoint)throw Error('Encrypted backup not persisted');
    if(!equal(await VAULT.open(JSON.parse(checkpoint),password),candidate))throw Error('Encrypted backup content mismatch');
    await CRED.enroll(password);
    if(!await CRED.unlock(password))throw Error('Credential verification failed');
    if(localStorage.getItem(DEST)!==checkpoint)throw Error('Encrypted backup changed');
    if(!equal(await VAULT.open(JSON.parse(localStorage.getItem(DEST)),password),JSON.parse(source)))throw Error('Imported backup mismatch');
    return Object.freeze({medications:candidate.medications.length,intakeLogs:candidate.intakeLogs.length,sourcePreserved:true});
   }catch(error){
    // Never delete a checkpoint after credentials were created: the pair may be accessible.
    if(localStorage.getItem(CREDENTIAL)===null&&localStorage.getItem(DEST)===checkpoint)
     localStorage.removeItem(DEST);
    throw error;
   }
  });
 }
 root.MedControlModular3CopyMigration=Object.freeze({inspect,preview,commit,resume,importBackup});
})(typeof window!=='undefined'?window:globalThis);
