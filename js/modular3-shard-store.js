/* Modular-3 T-046: append-only, paged encrypted-record storage foundation.
 * Opt-in only: existing vault and medical records are never migrated implicitly.
 * Callers provide already-encrypted payloads; this module never accepts plaintext.
 * Never use this store as the sole copy until migration and recovery are verified.
 */
(function(root){
  'use strict';
  const DB_NAME='medcontrol_modular3_shards_v1';
  const VERSION=1;
  const STORE='records';
  function open(){
    if(!root.indexedDB)return Promise.reject(Error('IndexedDB unavailable'));
    return new Promise((resolve,reject)=>{
      const req=root.indexedDB.open(DB_NAME,VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store=db.createObjectStore(STORE,{keyPath:['owner','id']});
          store.createIndex('byOwner',['owner','id'],{unique:true});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error('Storage open failed'));
      req.onblocked=()=>reject(Error('Storage upgrade blocked by another tab'));
    });
  }
  function transaction(db,mode,run){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      let result;
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||Error('Storage transaction failed'));
      tx.onabort=()=>reject(tx.error||Error('Storage transaction aborted'));
      try{run(tx.objectStore(STORE),value=>{result=value;});}
      catch(error){tx.abort();reject(error);}
    });
  }
  function validate(owner,id){
    if(typeof owner!=='string'||!owner||typeof id!=='string'||!id||id==='\uffff')throw Error('Owner and valid record ID required');
  }
  // Creation must never silently replace an existing medical record.
  async function createEncrypted(owner,id,ciphertext){
    validate(owner,id);
    if(!ciphertext||typeof ciphertext!=='object'||Array.isArray(ciphertext))throw Error('Encrypted payload required');
    const db=await open();
    try{
      await transaction(db,'readwrite',store=>store.add({owner,id,ciphertext:structuredClone(ciphertext)}));
      return true;
    }finally{db.close();}
  }
  // Optimistic concurrency: read and compare inside the same readwrite transaction.
  // A stale editor cannot overwrite a newer encrypted medical record.
  async function replaceEncryptedIfMatch(owner,id,expectedCiphertext,nextCiphertext){
    validate(owner,id);
    if(!expectedCiphertext||typeof expectedCiphertext!=='object'||
       !nextCiphertext||typeof nextCiphertext!=='object')throw Error('Encrypted payloads required');
    const db=await open();
    try{
      await transaction(db,'readwrite',store=>{
        const request=store.get([owner,id]);
        request.onsuccess=()=>{
          const previous=request.result;
          if(!previous||JSON.stringify(previous.ciphertext)!==JSON.stringify(expectedCiphertext)){
            store.transaction.abort();return;
          }
          store.put({owner,id,ciphertext:structuredClone(nextCiphertext)});
        };
      });
      return true;
    }finally{db.close();}
  }
  async function getEncrypted(owner,id){
    validate(owner,id);
    const db=await open();
    try{return await transaction(db,'readonly',(store,set)=>{
      const req=store.get([owner,id]);req.onsuccess=()=>set(req.result?.ciphertext??null);
    });}finally{db.close();}
  }
  async function pageEncrypted(owner,{after='',limit=100}={}){
    validate(owner,'page');
    if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Page limit must be 1..500');
    if(typeof after!=='string')throw Error('Invalid cursor');
    if(after==='\uffff')throw Error('Invalid cursor');
    const db=await open();
    try{return await transaction(db,'readonly',(store,set)=>{
      const rows=[];
      const lower=after?[owner,after]:[owner,''];
      const range=root.IDBKeyRange.bound(lower,[owner,'\uffff'],!!after,true);
      const req=store.index('byOwner').openCursor(range);
      req.onsuccess=()=>{
        const cursor=req.result;
        if(!cursor){set({rows,next:null});return;}
        if(rows.length===limit){set({rows,next:rows[rows.length-1].id});return;}
        rows.push({id:cursor.value.id,ciphertext:cursor.value.ciphertext});
        cursor.continue();
      };
    });}finally{db.close();}
  }
  // Atomic import into a NEW owner namespace only. Any collision aborts
  // the entire page, preventing partial page restoration or overwrites.
  async function importEncryptedPageNewOwner(owner,rows){
    validate(owner,'import');
    if(!Array.isArray(rows)||rows.length<1||rows.length>500)
      throw Error('Import page must contain 1..500 records');
    let previous='';
    const prepared=rows.map(row=>{
      validate(owner,row?.id);
      if(row.id<=previous||!row.ciphertext||
         typeof row.ciphertext!=='object'||Array.isArray(row.ciphertext))
        throw Error('Invalid or unordered encrypted import records');
      previous=row.id;
      return {owner,id:row.id,ciphertext:structuredClone(row.ciphertext)};
    });
    const db=await open();
    try{
      await transaction(db,'readwrite',store=>{
        for(const row of prepared)store.add(row);
      });
      return prepared.length;
    }finally{db.close();}
  }
  root.MedControlModular3ShardStore=Object.freeze({createEncrypted,replaceEncryptedIfMatch,getEncrypted,pageEncrypted,importEncryptedPageNewOwner});
})(typeof window!=='undefined'?window:globalThis);
