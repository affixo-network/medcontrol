/* Opt-in migration. Legacy state is untouched; existing protected state is
 * preserved in an immutable encrypted backup before confirmed activation. */
(function(root){
 'use strict';
 const SOURCE='affixo_medcontrol_standard_v3';
 const DEST='medcontrol_modular3_protected_state_v1';
 const CREDENTIAL='medcontrol_modular3_local_credential_v1';
 const PRESERVED='medcontrol_modular3_preserved_before_import_v1/';
 const importPlans=new WeakMap();
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
   if(!encryptedTransfer||!documentState.encrypted||typeof documentState.encrypted!=='object')throw Error('Encrypted MedControl transfer file required');
   const candidate=await VAULT.open(documentState.encrypted,password);
   validateLegacy(candidate);
   const source=JSON.stringify(candidate);
   const encrypted=documentState.encrypted;
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
 function requireExistingSession(){
  const session=root.MedControlModular3ProtectedSession;
  if(!session?.isUnlocked())throw Error('Protected session locked');
  if(!localStorage.getItem(DEST)||!localStorage.getItem(CREDENTIAL))throw Error('Incomplete existing protected account');
  return session;
 }
 // Inclusion, not counts: every source value must be present, while additional
 // local records/fields are retained. Array order matters, especially for
 // equal-timestamp history entries whose final status depends on sequence.
 function included(source,current){
  if(source===current)return true;
  if(source===null||current===null||typeof source!=='object'||typeof current!=='object')return false;
  if(Array.isArray(source)){
   if(!Array.isArray(current))return false;
   let position=0;
   for(const entry of source){
    while(position<current.length&&!included(entry,current[position]))position++;
    if(position===current.length)return false;
    position++;
   }
   return true;
  }
  if(Array.isArray(current))return false;
  return Object.keys(source).every(key=>Object.prototype.hasOwnProperty.call(current,key)&&included(source[key],current[key]));
 }
 function matchedEntries(source,current){
  const identity=value=>value&&typeof value==='object'&&!Array.isArray(value)&&['string','number'].includes(typeof value.id)?typeof value.id+':'+value.id:null;
  const byId=new Map();
  current.forEach((value,index)=>{const key=identity(value);if(key!==null){if(!byId.has(key))byId.set(key,[]);byId.get(key).push(index);}});
  const all=current.map((_,index)=>index),assigned=new Map();
  function match(index,visited){
   const key=identity(source[index]),candidates=key===null?all:(byId.get(key)||[]);
   for(const target of candidates){
    if(visited.has(target)||!included(source[index],current[target]))continue;
    visited.add(target);
    if(!assigned.has(target)||match(assigned.get(target),visited)){assigned.set(target,index);return true;}
   }
   return false;
  }
  let count=0;
  source.forEach((_,index)=>{if(match(index,new Set()))count++;});
  return count;
 }
 function compareSource(candidate,current){
  const differentFields=Object.keys(candidate).filter(key=>!Object.prototype.hasOwnProperty.call(current,key)||!included(candidate[key],current[key]));
  const group=key=>Object.freeze({matched:matchedEntries(candidate[key],current[key]),total:candidate[key].length,additional:Math.max(0,current[key].length-candidate[key].length)});
  return Object.freeze({allIncluded:differentFields.length===0,medications:group('medications'),intakeLogs:group('intakeLogs'),differentFields:Object.freeze(differentFields)});
 }
 async function previewExistingImport(raw,filePassword){
  const session=requireExistingSession();
  if(typeof raw!=='string'||!raw.length||raw.length>20*1024*1024)throw Error('Invalid backup file size');
  const before=localStorage.getItem(DEST),credential=localStorage.getItem(CREDENTIAL);
  const state=JSON.stringify(session.read());
  const transfer=JSON.parse(raw);
  if(transfer?.format!=='medcontrol-encrypted-transfer-v1'||!transfer.encrypted)throw Error('Encrypted MedControl transfer file required');
  const candidate=await VAULT.open(transfer.encrypted,filePassword);
  const incoming=validateLegacy(candidate),existing=validateLegacy(JSON.parse(state));
  requireExistingSession();
  if(localStorage.getItem(DEST)!==before||localStorage.getItem(CREDENTIAL)!==credential||JSON.stringify(session.read())!==state)throw Error('Protected account changed during import preview');
  const comparison=compareSource(candidate,JSON.parse(state));
  const plan=Object.freeze({incoming:Object.freeze(incoming),existing:Object.freeze(existing),comparison});
  // Only the exact preview object can authorize activation; no decrypted state in storage.
  importPlans.set(plan,{before,credential,state,candidate,comparison});
  return plan;
 }
 async function commitExistingImport(plan){
  const record=importPlans.get(plan);
  if(!record)throw Error('Import preview required');
  importPlans.delete(plan);
  const session=requireExistingSession();
  const same=record.comparison.allIncluded;
  let backupKey=null;
  const activated=await session.transact(next=>{
   if(localStorage.getItem(DEST)!==record.before||localStorage.getItem(CREDENTIAL)!==record.credential||JSON.stringify(next)!==record.state)throw Error('Protected account changed after import preview');
   if(same)return;
   backupKey=PRESERVED+crypto.randomUUID();
   if(localStorage.getItem(backupKey)!==null)throw Error('Preserved backup already exists');
   const backup=JSON.stringify({format:'medcontrol-protected-preserved-v1',createdAt:new Date().toISOString(),encrypted:JSON.parse(record.before),credential:JSON.parse(record.credential)});
   // Persist and read back the entire old encrypted vault BEFORE touching active data.
   // Failed activation may leave this additional safe copy; it is never removed.
   localStorage.setItem(backupKey,backup);
   if(localStorage.getItem(backupKey)!==backup)throw Error('Preserved backup verification failed');
   for(const key of Object.keys(next))delete next[key];
   Object.defineProperties(next,Object.getOwnPropertyDescriptors(structuredClone(record.candidate)));
  },{skipUnchanged:true});
  return Object.freeze({medications:activated.medications.length,intakeLogs:activated.intakeLogs.length,sourcePreserved:true,previousVaultPreserved:!same,alreadyImported:same,backupKey});
 }
 function readPreservedBackup(key){
  if(typeof key!=='string'||!key.startsWith(PRESERVED))throw Error('Invalid preserved backup key');
  const backup=JSON.parse(localStorage.getItem(key)||'null');
  if(backup?.format!=='medcontrol-protected-preserved-v1'||!backup.encrypted||!backup.credential||typeof backup.createdAt!=='string')throw Error('Invalid preserved backup');
  return backup;
 }
 function listPreservedBackups(){
  return Object.keys(localStorage).filter(key=>key.startsWith(PRESERVED)).map(key=>{
   const backup=readPreservedBackup(key);
   return Object.freeze({key,createdAt:backup.createdAt});
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }
 function exportPreservedBackup(key){
  const backup=readPreservedBackup(key);
  return JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:backup.encrypted});
 }
 root.MedControlModular3CopyMigration=Object.freeze({inspect,preview,commit,resume,importBackup,previewExistingImport,commitExistingImport,listPreservedBackups,exportPreservedBackup});
})(typeof window!=='undefined'?window:globalThis);
