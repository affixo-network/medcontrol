/* Modular-3 isolated preview bridge. Never loaded by production pages. */
(function(root){
 'use strict';
 const sourceKey='affixo_medcontrol_standard_v3';
 const vaultKey='medcontrol_modular3_test_encrypted_state_v1';
 const bridge=root.MedControlOfflineEncryptedBridge;
 const auth=root.medcontrolOfflineProofAuth;
 if(!bridge||!auth)throw Error('Offline encrypted bridge and local authorization required');
 let enabled=false;
 let queue=Promise.resolve();
 function assertAuthorized(){
  if(!enabled||!auth.isUnlocked())throw Error('Offline preview locked');
  bridge.read();
 }
 function activate(){
  if(enabled)throw Error('Already activated');
  if(!auth.isUnlocked())throw Error('Verified local authorization required');
  bridge.read();
  enabled=true;
 }
 function read(){assertAuthorized();return bridge.read();}
 function update(mutator){
  if(typeof mutator!=='function')return Promise.reject(Error('Mutation callback required'));
  const task=queue.then(async()=>{
   assertAuthorized();
   const state=bridge.read();
   mutator(state);
   bridge.write(state);
   await bridge.checkpoint();
   return bridge.read();
  });
  queue=task.catch(()=>{});
  return task;
 }
 async function close(){
  await queue;
  if(bridge.isDirty())throw Error('Uncommitted changes');
  enabled=false;
 }
 function status(){return Object.freeze({enabled:enabled&&auth.isUnlocked(),productionStorageUntouched:true,sourceKey,vaultKey});}
 root.MedControlModular3RealModuleBridge=Object.freeze({activate,read,update,close,status});
})(window);
