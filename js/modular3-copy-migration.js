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
 root.MedControlModular3CopyMigration=Object.freeze({inspect,preview,commit,resume});
})(typeof window!=='undefined'?window:globalThis);
