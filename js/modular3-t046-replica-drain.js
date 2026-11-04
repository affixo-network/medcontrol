/* T-046 isolated restartable queue drain.
 * No background timers, no network provider and no production integration.
 * Each job's immutable authenticated objects and adapter are resolved by caller.
 */
(function(root){
'use strict';
async function drain(resolveJob){
 const queue=root.MedControlT046ReplicaQueue;
 const coordinator=root.MedControlT046ReplicaCoordinator;
 if(!queue||!coordinator||typeof resolveJob!=='function')throw Error('Replica drain prerequisites required');
 if(typeof queue.pendingPage!=='function')throw Error('Bounded replica queue pages required');
 let afterId=null;
 const result={confirmed:0,failed:0,remaining:0};
 do{
  const page=await queue.pendingPage({afterId,limit:100});
  for(const job of page.jobs){
  try{
   const item=await resolveJob(job);
   if(!item||!item.adapter||!item.key)throw Error('Replica unavailable');
   await coordinator.replicate(job,item.adapter,item.key,item.segment,item.manifest,
    item.segmentTag,item.manifestTag,job.generation-1);
   result.confirmed++;
  }catch{
   // Do not discard jobs on failure. A later explicit drain can retry.
   result.failed++;
  }
  }
  afterId=page.nextAfterId;
 }while(afterId!==null);
 afterId=null;
 do{
  const page=await queue.pendingPage({afterId,limit:100});
  result.remaining+=page.jobs.length;
  afterId=page.nextAfterId;
 }while(afterId!==null);
 return result;
}
root.MedControlT046ReplicaDrain=Object.freeze({drain});
})(typeof window!=='undefined'?window:globalThis);
