/* Modular-3 isolated real-page encrypted state adapter.
 * Inject ONLY into disposable preview browser contexts, before real page scripts.
 * Synchronous legacy getState() reads decrypted memory; writes fail closed.
 * No production deployment, no original localStorage writes, no cloud access.
 */
(function(root){
 'use strict';
 const KEY='affixo_medcontrol_standard_v3';
 const originalGet=Storage.prototype.getItem;
 const originalSet=Storage.prototype.setItem;
 const originalRemove=Storage.prototype.removeItem;
 let active=false, snapshot=null, blockedWrites=0;
 let authorization=()=>true;
 function start(decryptedState,accessCheck){
  if(active)throw Error('Preview already active');
  if(!decryptedState||!Array.isArray(decryptedState.medications)||!Array.isArray(decryptedState.intakeLogs))throw Error('Invalid decrypted preview');
  if(originalGet.call(localStorage,KEY)!==null)throw Error('Production key present: refusing preview');
  if(typeof accessCheck!=='function')throw Error('Explicit preview authorization check required');
  if(!accessCheck())throw Error('Preview access locked');
  authorization=accessCheck;
  snapshot=JSON.stringify(structuredClone(decryptedState));
  active=true;
 }
 Storage.prototype.getItem=function(key){
  if(active&&this===localStorage&&key===KEY){
   if(!authorization())throw Error('Preview access locked');
   return snapshot;
  }
  return originalGet.apply(this,arguments);
 };
 Storage.prototype.setItem=function(key,value){
  if(active&&this===localStorage&&key===KEY){
   blockedWrites++;
   throw new DOMException('Encrypted preview is read-only; save requires a verified checkpoint','QuotaExceededError');
  }
  return originalSet.apply(this,arguments);
 };
 Storage.prototype.removeItem=function(key){
  if(active&&this===localStorage&&key===KEY)throw Error('Preview production-key removal prohibited');
  return originalRemove.apply(this,arguments);
 };
 root.MedControlModular3RealPageReadOnly=Object.freeze({
  start,
  status:()=>({active,blockedWrites,sourceKey:KEY}),
  stop:()=>{active=false;snapshot=null;authorization=()=>true;}
 });
})(window);
