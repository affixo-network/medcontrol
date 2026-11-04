/* T-046 isolated authenticated atomic store v2.
 * No unauthenticated write API is exported. No production data access.
 * Keys are provided by caller; persistence and recovery remain separate.
 */
(function(root){
'use strict';
const dbName='t046-authenticated-atomic-v2';
function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   db.createObjectStore('segments');
   db.createObjectStore('manifests');
   db.createObjectStore('head');
  };
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>resolve(req.result);
 });
}
async function authenticate(key,segment,manifest,segmentTag,manifestTag){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!await codec.verifySegment(segment)||!await codec.verifyManifest(manifest))throw Error('Invalid objects');
 if(segment.vaultId!==manifest.vaultId||!manifest.segments.some(s=>s.commitment===segment.commitment))throw Error('Inconsistent objects');
 if(!await auth.verify(key,segment.vaultId,'segment',segment.commitment,segmentTag)||
    !await auth.verify(key,manifest.vaultId,'manifest',manifest.commitment,manifestTag))throw Error('Authentication required');
}
async function commitAuthenticated(key,segment,manifest,expectedGeneration,segmentTag,manifestTag){
 await authenticate(key,segment,manifest,segmentTag,manifestTag);
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||manifest.generation!==expectedGeneration+1)throw Error('Invalid generation');
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['segments','manifests','head'],'readwrite');
  tx.oncomplete=()=>resolve(true);
  tx.onabort=()=>reject(tx.error||Error('Transaction aborted'));
  const heads=tx.objectStore('head');
  heads.get('current').onsuccess=e=>{
   const old=e.target.result;
   if((old?old.generation:0)!==expectedGeneration||
      manifest.previousCommitment!==(old?old.commitment:null)||
      old&&old.vaultId!==manifest.vaultId){tx.abort();return;}
   tx.objectStore('segments').put({segment,tag:segmentTag},segment.commitment);
   tx.objectStore('manifests').put({manifest,tag:manifestTag},manifest.generation);
   heads.put({generation:manifest.generation,commitment:manifest.commitment,vaultId:manifest.vaultId},'current');
  };
 });}finally{db.close();}
}
async function inspect(){
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['head','manifests'],'readonly');
  const result={head:null,manifest:null};
  tx.onerror=()=>reject(tx.error);
  tx.oncomplete=()=>resolve(result);
  tx.objectStore('head').get('current').onsuccess=e=>{
   result.head=e.target.result||null;
   if(result.head)tx.objectStore('manifests').get(result.head.generation).onsuccess=m=>result.manifest=m.target.result||null;
  };
 });}finally{db.close();}
}
async function verifyPersisted(key){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!key)throw Error('Authentication prerequisites required');
 const db=await openDB();
 try{
  const state=await new Promise((resolve,reject)=>{
   const tx=db.transaction(['head','manifests','segments'],'readonly');
   let head=null,record=null,segments=[];
   tx.onerror=()=>reject(tx.error);
   tx.oncomplete=()=>resolve({head,record,segments});
   tx.objectStore('head').get('current').onsuccess=e=>{
    head=e.target.result||null;
    if(!head)return;
    tx.objectStore('manifests').get(head.generation).onsuccess=m=>{
     record=m.target.result||null;
     if(!record||!record.manifest||!Array.isArray(record.manifest.segments))return;
     for(const descriptor of record.manifest.segments){
      tx.objectStore('segments').get(descriptor.commitment).onsuccess=s=>segments.push({descriptor,stored:s.target.result||null});
     }
    };
   };
  });
  if(!state.head)return {valid:true,empty:true};
  const {head,record,segments}=state;
  if(!record||!record.manifest)return {valid:false,reason:'missing-manifest'};
  const manifest=record.manifest;
  if(manifest.commitment!==head.commitment||manifest.generation!==head.generation||manifest.vaultId!==head.vaultId||
     !await codec.verifyManifest(manifest)||
     !await auth.verify(key,head.vaultId,'manifest',manifest.commitment,record.tag))return {valid:false,reason:'invalid-manifest'};
  if(segments.length!==manifest.segments.length||segments.some(s=>!s.stored))return {valid:false,reason:'missing-segment'};
  for(const {descriptor,stored} of segments){
   const segment=stored.segment;
   if(!segment||segment.commitment!==descriptor.commitment||segment.vaultId!==head.vaultId||
      segment.firstSequence!==descriptor.firstSequence||segment.lastSequence!==descriptor.lastSequence||
      !await codec.verifySegment(segment)||
      !await auth.verify(key,head.vaultId,'segment',segment.commitment,stored.tag))return {valid:false,reason:'invalid-segment'};
  }
  return {valid:true,empty:false,generation:head.generation};
 }finally{db.close();}
}
async function restoreAuthenticatedSegment(key,candidate,tag){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!candidate||!await codec.verifySegment(candidate)||
    !await auth.verify(key,candidate.vaultId,'segment',candidate.commitment,tag))throw Error('Unauthenticated recovery copy');
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['head','manifests','segments'],'readwrite');
  let restored=false;
  tx.oncomplete=()=>resolve(restored);
  tx.onabort=()=>reject(tx.error||Error('Recovery transaction aborted'));
  tx.objectStore('head').get('current').onsuccess=e=>{
   const head=e.target.result;
   if(!head||head.vaultId!==candidate.vaultId){tx.abort();return;}
   tx.objectStore('manifests').get(head.generation).onsuccess=m=>{
    const record=m.target.result;
    const manifest=record&&record.manifest;
    if(!manifest||manifest.commitment!==head.commitment||manifest.generation!==head.generation||
       !manifest.segments.some(s=>s.commitment===candidate.commitment&&s.firstSequence===candidate.firstSequence&&s.lastSequence===candidate.lastSequence)){tx.abort();return;}
    const segments=tx.objectStore('segments');
    segments.get(candidate.commitment).onsuccess=s=>{
     const existing=s.target.result;
     if(existing&&JSON.stringify(existing.segment)===JSON.stringify(candidate)&&existing.tag===tag)return;
     segments.put({segment:structuredClone(candidate),tag},candidate.commitment);
     restored=true;
    };
   };
  };
 });}finally{db.close();}
}
root.MedControlT046AuthenticatedAtomic=Object.freeze({commitAuthenticated,inspect,verifyPersisted,restoreAuthenticatedSegment});
})(typeof window!=='undefined'?window:globalThis);
