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
  const r=root.indexedDB.open(NAME,3);
  r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('heads'))db.createObjectStore('heads',{keyPath:'vaultId'});if(!db.objectStoreNames.contains('objects'))db.createObjectStore('objects',{keyPath:['vaultId','commitment']});if(!db.objectStoreNames.contains('replicaJobs'))db.createObjectStore('replicaJobs',{keyPath:['vaultId','generation']});};
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

async function commitObjects({vaultId,expected=null,segment,segments=null,manifest,segmentTag,segmentTags=null,manifestTag,commitmentKey}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 const parts=segments===null?[segment]:segments;
 const tags=segmentTags===null?[segmentTag]:segmentTags;
 if(!validVault(vaultId)||!validObject(manifest)||!codec||!auth||!commitmentKey||
    !Array.isArray(parts)||!Array.isArray(tags)||parts.length<1||parts.length>1024||parts.length!==tags.length||
    manifest.vaultId!==vaultId||!await codec.verifyManifest(manifest)||
    manifest.segments.length!==parts.length||
    manifest.previousCommitment!==(expected?expected.commitment:null)||
    manifest.generation!==(expected?expected.generation+1:1)||
    !await auth.verify(commitmentKey,vaultId,'manifest',manifest.commitment,manifestTag))
  throw Error('Invalid authenticated object transition');
 for(let i=0;i<parts.length;i++){
  const part=parts[i],desc=manifest.segments[i];
  if(!validObject(part)||part.vaultId!==vaultId||!await codec.verifySegment(part)||
     desc.commitment!==part.commitment||desc.firstSequence!==part.firstSequence||
     desc.lastSequence!==part.lastSequence||desc.eventCount!==part.eventCount||
     !await auth.verify(commitmentKey,vaultId,'segment',part.commitment,tags[i]))
   throw Error('Invalid authenticated segment transition');
 }
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['heads','objects','replicaJobs'],'readwrite'),heads=tx.objectStore('heads'),objects=tx.objectStore('objects');
  let conflict=false;
  tx.oncomplete=()=>resolve({committed:true,generation:manifest.generation});
  tx.onabort=()=>reject(Error(conflict?'Manifest head conflict':'Object transaction aborted'));
  const persist=()=>{
   for(let i=0;i<parts.length;i++)objects.put({vaultId,commitment:parts[i].commitment,type:'segment',object:parts[i],tag:tags[i]});
   objects.put({vaultId,commitment:manifest.commitment,type:'manifest',object:manifest,tag:manifestTag});
   heads.put({vaultId,generation:manifest.generation,commitment:manifest.commitment});
   tx.objectStore('replicaJobs').add({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment,status:'pending'});
  };
  heads.get(vaultId).onsuccess=e=>{
   const old=e.target.result||null;
   if((old?.commitment||null)!==(expected?.commitment||null)||
      (old?.generation||0)!==(expected?.generation||0)){conflict=true;tx.abort();return;}
   if(expected){
    objects.get([vaultId,expected.commitment]).onsuccess=prior=>{
     const stored=prior.target.result;
     if(!stored||stored.type!=='manifest'||stored.object.generation!==expected.generation||
        stored.object.commitment!==expected.commitment||
        !Number.isSafeInteger(stored.object.committedThrough)||
        manifest.segments[0].firstSequence!==stored.object.committedThrough+1){conflict=true;tx.abort();return;}
     persist();
    };
    return;
   }
   if(manifest.segments[0].firstSequence!==1){conflict=true;tx.abort();return;}
   persist();
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
/* Replication intent is committed atomically with the authenticated head.
 * The external replica queue is a rebuildable delivery projection. */
async function replicaIntent({vaultId,generation}){
 if(!validVault(vaultId)||!Number.isSafeInteger(generation)||generation<1)throw Error('Invalid replica intent reference');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('replicaJobs','readonly');
  const request=tx.objectStore('replicaJobs').get([vaultId,generation]);
  request.onsuccess=()=>resolve(request.result||null);
  request.onerror=()=>reject(request.error);
 });}finally{db.close();}
}
/* Cursor-based, bounded recovery of durable replica intents. Never load the
 * complete history into memory, even for very large vaults. */
async function replicaIntentPage({vaultId,afterGeneration=0,limit=100}){
 if(!validVault(vaultId)||!Number.isSafeInteger(afterGeneration)||afterGeneration<0||
    !Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('Invalid replica intent page');
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const rows=[],tx=db.transaction('replicaJobs','readonly');
  const range=root.IDBKeyRange.bound([vaultId,afterGeneration],[vaultId,Number.MAX_SAFE_INTEGER],true,false);
  const request=tx.objectStore('replicaJobs').openCursor(range);
  request.onerror=()=>reject(request.error||Error('Replica intent cursor failed'));
  request.onsuccess=()=>{
   const cursor=request.result;
   if(!cursor||rows.length===limit){resolve(rows);return;}
   rows.push(cursor.value);
   if(rows.length===limit){resolve(rows);return;}
   cursor.continue();
  };
  tx.onabort=()=>reject(tx.error||Error('Replica intent transaction aborted'));
 });}finally{db.close();}
}
root.MedControlT046ManifestHead=Object.freeze({read,advance,commitObjects,object,replicaIntent,replicaIntentPage});
})(typeof window!=='undefined'?window:globalThis);
