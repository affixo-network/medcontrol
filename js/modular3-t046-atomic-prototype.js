/* T-046 isolated IndexedDB atomic commit experiment. Not connected to medical vault. */
(function(root){
'use strict';
const dbName='t046-atomic-experiment-v1';
function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   db.createObjectStore('segments');
   db.createObjectStore('manifests');
   db.createObjectStore('head');
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function commit(segment,manifest,expectedGeneration){
 const codec=root.MedControlT046SegmentCodec;
 if(!codec||!await codec.verifySegment(segment)||!await codec.verifyManifest(manifest))throw Error('Invalid object');
 if(manifest.vaultId!==segment.vaultId||!manifest.segments.some(x=>x.commitment===segment.commitment))throw Error('Missing segment reference');
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||manifest.generation!==expectedGeneration+1)throw Error('Invalid generation');
 const db=await openDB();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(['segments','manifests','head'],'readwrite');
   let committed=false;
   tx.oncomplete=()=>resolve(committed);
   tx.onabort=()=>reject(tx.error||Error('Commit aborted'));
   const head=tx.objectStore('head');
   const req=head.get('current');
   req.onsuccess=()=>{
    const old=req.result;
    if((old?old.generation:0)!==expectedGeneration||
       manifest.previousCommitment!==(old?old.commitment:null)||
       old&&old.vaultId!==manifest.vaultId){tx.abort();return;}
    tx.objectStore('segments').put(segment,segment.commitment);
    tx.objectStore('manifests').put(manifest,manifest.generation);
    head.put({generation:manifest.generation,commitment:manifest.commitment,vaultId:manifest.vaultId},'current');
    committed=true;
   };
  });
 }finally{db.close();}
}
async function inspect(){
 const db=await openDB();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(['head','manifests','segments'],'readonly');
   const result={head:null,manifest:null,segments:[]};
   tx.onerror=()=>reject(tx.error);
   tx.oncomplete=()=>resolve(result);
   const h=tx.objectStore('head').get('current');
   h.onsuccess=()=>{
    result.head=h.result||null;
    if(!result.head)return;
    const m=tx.objectStore('manifests').get(result.head.generation);
    m.onsuccess=()=>{
     result.manifest=m.result||null;
     if(!result.manifest)return;
     for(const descriptor of result.manifest.segments){
      const s=tx.objectStore('segments').get(descriptor.commitment);
      s.onsuccess=()=>result.segments.push(s.result||null);
     }
    };
   };
  });
 }finally{db.close();}
}
async function verifyState(){
 const snapshot=await inspect();
 if(!snapshot.head)return {valid:true,empty:true};
 const {head,manifest,segments}=snapshot;
 const codec=root.MedControlT046SegmentCodec;
 if(!codec||!manifest||manifest.commitment!==head.commitment||manifest.generation!==head.generation||manifest.vaultId!==head.vaultId||!await codec.verifyManifest(manifest))return {valid:false,reason:'invalid-manifest'};
 if(segments.length!==manifest.segments.length||segments.some(x=>!x))return {valid:false,reason:'missing-segment'};
 for(const descriptor of manifest.segments){
  const segment=segments.find(x=>x&&x.commitment===descriptor.commitment);
  if(!segment||segment.vaultId!==head.vaultId||segment.firstSequence!==descriptor.firstSequence||segment.lastSequence!==descriptor.lastSequence||!await codec.verifySegment(segment))return {valid:false,reason:'invalid-segment'};
 }
 return {valid:true,empty:false,generation:head.generation};
}
root.MedControlT046AtomicExperiment=Object.freeze({commit,inspect,verifyState});
})(typeof window!=='undefined'?window:globalThis);
