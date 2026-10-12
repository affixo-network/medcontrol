/* Test-only encrypted persistence adapter for real MedControl storage state.
 * Does not override getState/saveState or write production STORAGE_KEY.
 */
(function(root){
 'use strict';
 const KEY='medcontrol_modular3_test_encrypted_state_v1';
 const vault=root.MedControlOfflineVault;
 if(!vault)throw Error('Offline vault is required');
 async function save(state,password){
  if(!state||!Array.isArray(state.medications)||!Array.isArray(state.intakeLogs))throw Error('Invalid MedControl state');
  const sealed=await vault.seal(state,password);
  const raw=JSON.stringify(sealed);
  localStorage.setItem(KEY,raw);
  if(localStorage.getItem(KEY)!==raw)throw Error('Encrypted state verification failed');
  return true;
 }
 async function load(password){
  const raw=localStorage.getItem(KEY);
  if(!raw)throw Error('No encrypted offline state');
  const state=await vault.open(JSON.parse(raw),password);
  if(!state||!Array.isArray(state.medications)||!Array.isArray(state.intakeLogs))throw Error('Invalid decrypted state');
  return state;
 }
 root.MedControlOfflineStorageAdapter=Object.freeze({save,load});
})(window);
