/* Modular-3 opt-in real-module storage bridge. Disabled by default.
 * Only a preview can enable this after successful encrypted unlock.
 * Existing MedControl state and Supabase Auth are never replaced automatically.
 */
(function(root){
 'use strict';
 const sourceKey='affixo_medcontrol_standard_v3';
 const vaultKey='medcontrol_modular3_test_encrypted_state_v1';
 const bridge=root.MedControlOfflineEncryptedBridge;
 if(!bridge)throw Error('Encrypted bridge unavailable');
 let enabled=false;
 function activate(){
  if(enabled)throw Error('Already activated');
  if(!root.MedControlOfflineProofAuthorized)throw Error('Explicit preview authorization required');
  bridge.read();
  enabled=true;
 }
 function read(){
  if(!enabled)throw Error('Preview bridge not active');
  return bridge.read();
 }
 async function update(mutator){
  if(!enabled)throw Error('Preview bridge not active');
  if(typeof mutator!=='function')throw Error('Mutation callback required');
  const state=bridge.read();
  mutator(state);
  bridge.write(state);
  await bridge.checkpoint();
  return bridge.read();
 }
 function status(){return Object.freeze({enabled,productionStorageUntouched:true,sourceKey,vaultKey});}
 root.MedControlModular3RealModuleBridge=Object.freeze({activate,read,update,status});
})(window);
