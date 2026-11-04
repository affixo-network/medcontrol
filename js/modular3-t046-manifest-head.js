/* T-046 isolated durable manifest head. No legacy vault access.
 * Compare-and-swap in one IndexedDB transaction prevents competing generations.
 * This is metadata only: callers must persist authenticated objects separately.
 */
(function(root){
'use strict';
const NAME='t046-manifest-head-v1';
function open(){
 return new Promise((resolve,reject)=>{
  const r=root.indexedDB.open(NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('heads',{keyPath:'vaultId'});
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
root.MedControlT046ManifestHead=Object.freeze({read,advance});
})(typeof window!=='undefined'?window:globalThis);
