/* Isolated real-page preview transaction coordinator.
 * Legacy synchronous saveState cannot safely wait for WebCrypto. This coordinator
 * performs encrypted checkpoint first, then permits one exact synchronous save.
 * Only for explicit test-preview operations, never production or live user data.
 */
(function(root){
 'use strict';
 const gate=root.MedControlModular3WriteThroughPreview;
 if(!gate)throw Error('Preview write gate missing');
 let chain=Promise.resolve();
 function transact(mutator){
  if(typeof mutator!=='function')return Promise.reject(Error('Mutation callback required'));
  const task=chain.then(async()=>{
   const current=getState();
   const next=structuredClone(current);
   mutator(next);
   // Mirror production saveState normalization BEFORE encrypted checkpoint.
   next.settings=next.settings||{};
   next.settings.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
   await gate.checkpoint(next);
   const saved=saveState(next,{silent:true,skipCloudSnapshot:true});
   if(!saved)throw Error('Preview save rejected after encrypted checkpoint');
   return getState();
  });
  chain=task.catch(()=>{});
  return task;
 }
 root.MedControlModular3RealPageTransaction=Object.freeze({transact,settle:()=>chain});
})(window);
