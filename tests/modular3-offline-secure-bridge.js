/* Isolated offline-only bridge for real synchronous MedControl storage API.
 * Test fixture only; never injected into production pages.
 * The application state exists in memory while unlocked, and encrypted at rest.
 */
(function(root){
 'use strict';
 const KEY='affixo_medcontrol_standard_v3';
 const originalGet=Storage.prototype.getItem;
 const originalSet=Storage.prototype.setItem;
 const originalRemove=Storage.prototype.removeItem;
 let active=false,plain=null,password=null,queue=Promise.resolve(),failure=null;
 function validate(state){
  if(!state||typeof state!=='object'||!Array.isArray(state.medications)||!Array.isArray(state.intakeLogs))throw Error('Invalid MedControl state');
  return state;
 }
 function schedule(raw){
  queue=queue.catch(()=>{}).then(async()=>{
   await root.MedControlOfflineStorageAdapter.save(validate(JSON.parse(raw)),password);
  }).catch(error=>{failure=error;throw error;});
 }
 const bridge={
  async unlock(secret,initialState){
   if(active)throw Error('Already unlocked');
   if(typeof secret!=='string'||secret.length<12)throw Error('Invalid passphrase');
   if(!root.MedControlOfflineStorageAdapter)throw Error('Encrypted adapter unavailable');
   const encrypted=originalGet.call(localStorage,'medcontrol_modular3_test_encrypted_state_v1');
   const state=encrypted?await root.MedControlOfflineStorageAdapter.load(secret):validate(initialState);
   plain=JSON.stringify(validate(state));password=secret;failure=null;
   if(!encrypted)await root.MedControlOfflineStorageAdapter.save(state,secret);
   active=true;
  },
  async flush(){await queue;if(failure)throw failure;},
  async lock(){try{await bridge.flush();}finally{active=false;plain=null;password=null;}},
  isUnlocked(){return active;}
 };
 Storage.prototype.getItem=function(key){
  if(this===localStorage&&key===KEY)return active?plain:null;
  return originalGet.call(this,key);
 };
 Storage.prototype.setItem=function(key,value){
  if(this===localStorage&&key===KEY){
   if(!active)throw Error('Encrypted MedControl storage locked');
   const raw=String(value);validate(JSON.parse(raw));plain=raw;schedule(raw);return;
  }
  return originalSet.call(this,key,value);
 };
 Storage.prototype.removeItem=function(key){
  if(this===localStorage&&key===KEY)throw Error('Cannot remove protected state');
  return originalRemove.call(this,key);
 };
 root.MedControlOfflineSecureBridge=Object.freeze(bridge);
})(window);
