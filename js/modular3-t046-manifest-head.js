/* T-046 isolated durable manifest head. No legacy vault access.
 * Compare-and-swap in one IndexedDB transaction prevents competing generations.
 * This is metadata only: callers must persist authenticated objects separately.
 */
(function(root){
'use strict';
const NAME='t046-manifest-head-v1';
const validObject=o=>o&&typeof o==='object'&&digest(o.commitment);
function open(){
 return new Promise((resolve,reject)=>{
  const r=root.indexedDB.open(NAME,2);
  r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('heads'))db.createObjectStore('heads',{keyPath:'vaultId'});if(!db.objectStoreNames.contains('objects'))db.createObjectStore('objects',{keyPath:['vaultId','commitment']});};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('Head database open failed'));
  r.onblocked=()=>reject(Error('Head database blocked'));
 });
}
const validVault=s=>typeof s==='string'&&/^vault_[A-Za-z0-9_-]{8,128}$/.test(s);
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
async function read(vaultId){
 if(!validVault(vaultId))throw Error('Invalid vault');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('heads','readonly'),r=tx.objectStore('heads').get(vaultId);
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });}finally{db.close();}
}
async function advance({vaultId,expected=null,next}){
 if(!validVault(vaultId)||!next||next.vaultId!==vaultId||
    !Number.isSafeInteger(next.generation)||next.generation<1||
    !digest(next.commitment)||next.previousCommitment!==(expected?expected.commitment:null)||
    next.generation!==(expected?expected.generation+1:1)||
    (expected&&(!digest(expected.commitment)||!Number.isSafeInteger(expected.generation))))
  throw Error('Invalid manifest transition');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('heads','readwrite'),store=tx.objectStore('heads');
  let conflict=false;
  tx.oncomplete=()=>resolve({advanced:true,generation:next.generation});
  tx.onabort=()=>reject(Error(conflict?'Manifest head conflict':'Head transaction aborted'));
  tx.onerror=()=>{};
  store.get(vaultId).onsuccess=e=>{
   const old=e.target.result||null;
   if((old?.commitment||null)!==(expected?.commitment||null)||
      (old?.generation||0)!==(expected?.generation||0)){
    conflict=true;tx.abort();return;
   }
   store.put({vaultId,generation:next.generation,commitment:next.commitment});
  };
 });}finally{db.close();}
}

async function commitObjects({vaultId,expected=null,segment,manifest,segmentTag,manifestTag,commitmentKey}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!validVault(vaultId)||!validObject(segment)||!validObject(manifest)||
    segment.vaultId!==vaultId||manifest.vaultId!==vaultId||
    !codec||!await codec.verifySegment(segment)||!await codec.verifyManifest(manifest)||
    (manifest.segments.length!==1||manifest.segments[0].commitment!==segment.commitment||manifest.segments[0].firstSequence!==segment.firstSequence||manifest.segments[0].lastSequence!==segment.lastSequence||manifest.segments[0].eventCount!==segment.eventCount)||
    !auth||!commitmentKey||!await auth.verify(commitmentKey,vaultId,'segment',segment.commitment,segmentTag)||
    !await auth.verify(commitmentKey,vaultId,'manifest',manifest.commitment,manifestTag)||
    manifest.previousCommitment!==(expected?expected.commitment:null)||
    manifest.generation!==(expected?expected.generation+1:1))
  throw Error('Invalid authenticated object transition');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['heads','objects'],'readwrite'),heads=tx.objectStore('heads'),objects=tx.objectStore('objects');
  let conflict=false;
  tx.oncomplete=()=>resolve({committed:true,generation:manifest.generation});
  tx.onabort=()=>reject(Error(conflict?'Manifest head conflict':'Object transaction aborted'));
  heads.get(vaultId).onsuccess=e=>{
   const old=e.target.result||null;
   if((old?.commitment||null)!==(expected?.commitment||null)||
      (old?.generation||0)!==(expected?.generation||0)){conflict=true;tx.abort();return;}
   // Validate continuity against the authenticated predecessor in the SAME transaction.
   // A valid manifest hash alone does not prove that the chain has no skipped events.
   if(expected){
    objects.get([vaultId,expected.commitment]).onsuccess=prior=>{
     const stored=prior.target.result;
     if(!stored||stored.type!=='manifest'||stored.object.generation!==expected.generation||
        stored.object.commitment!==expected.commitment||
        !Number.isSafeInteger(stored.object.committedThrough)||
        manifest.segments[0].firstSequence!==stored.object.committedThrough+1){
      conflict=true;tx.abort();return;
     }
     objects.put({vaultId,commitment:segment.commitment,type:'segment',object:segment,tag:segmentTag});
     objects.put({vaultId,commitment:manifest.commitment,type:'manifest',object:manifest,tag:manifestTag});
     heads.put({vaultId,generation:manifest.generation,commitment:manifest.commitment});
    };
    return;
   }
   if(manifest.segments[0].firstSequence!==1){conflict=true;tx.abort();return;}
   objects.put({vaultId,commitment:segment.commitment,type:'segment',object:segment,tag:segmentTag});
   objects.put({vaultId,commitment:manifest.commitment,type:'manifest',object:manifest,tag:manifestTag});
   heads.put({vaultId,generation:manifest.generation,commitment:manifest.commitment});
  };
 });}finally{db.close();}
}
async function object(vaultId,commitment){
 if(!validVault(vaultId)||!digest(commitment))throw Error('Invalid object reference');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('objects','readonly'),r=tx.objectStore('objects').get([vaultId,commitment]);
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });}finally{db.close();}
}
root.MedControlT046ManifestHead=Object.freeze({read,advance,commitObjects,object});
})(typeof window!=='undefined'?window:globalThis);
