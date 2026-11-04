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
root.MedControlT046AuthenticatedAtomic=Object.freeze({commitAuthenticated,inspect});
})(typeof window!=='undefined'?window:globalThis);
