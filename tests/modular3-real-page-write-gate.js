/* Isolated Modular-3 write-through preview for real legacy pages.
 * Must only be injected into disposable test browser contexts with synthetic data.
 * Legacy saveState() is synchronous; a write is rejected until encrypted checkpoint
 * has completed, so the UI cannot mistake an asynchronous save for durable storage.
 */
(function(root){
 'use strict';
 const key='affixo_medcontrol_standard_v3';
 const originalGet=Storage.prototype.getItem;
 const originalSet=Storage.prototype.setItem;
 const originalRemove=Storage.prototype.removeItem;
 const encrypted=root.MedControlModular3RealModuleBridge;
 if(!encrypted)throw Error('Encrypted preview bridge unavailable');
 let active=false,snapshot=null,approved=null,rejected=0;
 function start(){
  if(active)throw Error('Already active');
  if(originalGet.call(localStorage,key)!==null)throw Error('Existing legacy data: preview refused');
  const state=encrypted.read();
  snapshot=JSON.stringify(state);active=true;
 }
 Storage.prototype.getItem=function(k){
  if(active&&this===localStorage&&k===key){
   if(!encrypted.status().enabled)throw Error('Preview locked: encrypted data unavailable');
   return snapshot;
  }
  return originalGet.apply(this,arguments);
 };
 Storage.prototype.setItem=function(k,v){
  if(active&&this===localStorage&&k===key){
   if(!encrypted.status().enabled)throw Error('Preview locked: writes unavailable');
   const raw=String(v);
   if(approved!==raw){rejected++;throw Error('Encrypted checkpoint required before legacy save');}
   snapshot=raw;approved=null;return;
  }
  return originalSet.apply(this,arguments);
 };
 Storage.prototype.removeItem=function(k){
  if(active&&this===localStorage&&k===key)throw Error('Legacy removal prohibited');
  return originalRemove.apply(this,arguments);
 };
 async function checkpoint(next){
  if(!active)throw Error('Preview not active');
  if(!encrypted.status().enabled)throw Error('Preview locked: checkpoint unavailable');
  if(approved!==null)throw Error('Previous approval unconsumed');
  if(!next||!Array.isArray(next.medications)||!Array.isArray(next.intakeLogs))throw Error('Invalid state');
  const raw=JSON.stringify(next);
  await encrypted.update(state=>{
   Object.keys(state).forEach(k=>delete state[k]);
   Object.assign(state,structuredClone(next));
  });
  approved=raw;
  return true;
 }
 function stop(){
  if(approved!==null)throw Error('Unconsumed checkpoint approval');
  active=false;snapshot=null;
 }
 root.MedControlModular3WriteThroughPreview=Object.freeze({start,checkpoint,stop,status:()=>({active,rejected,approved:approved!==null})});
})(window);
