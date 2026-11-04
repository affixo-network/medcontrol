/* T-046 isolated durable replication queue. Not connected to medical vault.
 * Stores references to authenticated immutable objects, never plaintext.
 */
(function(root){
'use strict';
const dbName='t046-replica-queue-v1';
function open(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('jobs',{keyPath:'id'});
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
function validate(job){
 if(!job||typeof job.vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(job.vaultId)||
    !Number.isSafeInteger(job.generation)||job.generation<1||
    typeof job.manifestCommitment!=='string'||! /^[a-f0-9]{64}$/.test(job.manifestCommitment))throw Error('Invalid replica job');
 return {id:job.vaultId+':'+job.generation,vaultId:job.vaultId,generation:job.generation,manifestCommitment:job.manifestCommitment,status:'pending'};
}
async function enqueue(job){
 const candidate=validate(job),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs');
  tx.oncomplete=()=>resolve(candidate.id);
  tx.onabort=()=>reject(tx.error||Error('Queue aborted'));
  store.get(candidate.id).onsuccess=e=>{
   const old=e.target.result;
   if(old&&old.manifestCommitment!==candidate.manifestCommitment){tx.abort();return;}
   if(!old)store.put(candidate);
  };
 });}finally{db.close();}
}
async function pending(){
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('jobs','readonly');
  const req=tx.objectStore('jobs').getAll();
  req.onsuccess=()=>resolve(req.result.filter(x=>x.status==='pending').sort((a,b)=>a.generation-b.generation));
  req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
async function confirmVerified(job,adapter,key,segment,manifest,segmentTag,manifestTag){
 const candidate=validate(job);
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!adapter||!key||!segment||!manifest||
    segment.vaultId!==candidate.vaultId||manifest.vaultId!==candidate.vaultId||
    manifest.generation!==candidate.generation||manifest.commitment!==candidate.manifestCommitment||
    !Array.isArray(manifest.segments)||!manifest.segments.some(x=>x.commitment===segment.commitment)||
    !await codec.verifySegment(segment)||!await codec.verifyManifest(manifest)||
    !await auth.verify(key,candidate.vaultId,'segment',segment.commitment,segmentTag)||
    !await auth.verify(key,candidate.vaultId,'manifest',manifest.commitment,manifestTag))
  throw Error('Authenticated replica evidence required');
 const [head,sr,mr]=await Promise.all([
  adapter.getHead(),adapter.getSegment(segment.commitment),adapter.getManifest(manifest.commitment)
 ]);
 if(!head||head.vaultId!==candidate.vaultId||head.generation!==candidate.generation||
    head.commitment!==candidate.manifestCommitment||
    JSON.stringify(sr)!==JSON.stringify({segment,tag:segmentTag})||
    JSON.stringify(mr)!==JSON.stringify({manifest,tag:manifestTag}))
  throw Error('Replica readback mismatch');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('jobs','readwrite'),store=tx.objectStore('jobs');
  tx.oncomplete=()=>resolve(true);
  tx.onabort=()=>reject(tx.error||Error('Confirmation aborted'));
  store.get(candidate.id).onsuccess=e=>{
   const old=e.target.result;
   if(!old||old.manifestCommitment!==candidate.manifestCommitment){tx.abort();return;}
   store.put({...old,status:'confirmed'});
  };
 });}finally{db.close();}
}
root.MedControlT046ReplicaQueue=Object.freeze({enqueue,pending,confirmVerified});
})(typeof window!=='undefined'?window:globalThis);
