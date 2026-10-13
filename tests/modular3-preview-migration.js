/* Modular-3 preview-only migration. The original state remains unchanged. */
(function(root){
 'use strict';
 const SOURCE='affixo_medcontrol_standard_v3';
 const DEST='medcontrol_modular3_test_encrypted_state_v1';
 async function migrate(secret){
  if(localStorage.getItem(DEST)!==null)throw Error('Preview vault already exists');
  const original=localStorage.getItem(SOURCE);
  if(!original)throw Error('No existing state');
  const data=JSON.parse(original);
  if(!data||!Array.isArray(data.medications)||!Array.isArray(data.intakeLogs))throw Error('Invalid source state');
  const sealed=await root.MedControlOfflineVault.seal(data,secret);
  if(localStorage.getItem(SOURCE)!==original)throw Error('Source changed');
  if(localStorage.getItem(DEST)!==null)throw Error('Preview vault appeared');
  localStorage.setItem(DEST,JSON.stringify(sealed));
  const check=await root.MedControlOfflineVault.open(JSON.parse(localStorage.getItem(DEST)),secret);
  if(JSON.stringify(check)!==original){
   if(localStorage.getItem(DEST)===JSON.stringify(sealed))localStorage.removeItem(DEST);
   throw Error('Copy verification failed');
  }
  if(localStorage.getItem(SOURCE)!==original)throw Error('Original changed');
  return {medications:check.medications.length,intakeLogs:check.intakeLogs.length};
 }
 root.MedControlModular3PreviewMigration=Object.freeze({migrate});
})(window);
