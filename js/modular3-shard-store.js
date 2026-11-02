/* Modular-3 T-046: append-only, paged encrypted-record storage foundation.
 * Opt-in only: existing vault and medical records are never migrated implicitly.
 * Callers provide already-encrypted payloads; this module never accepts plaintext.
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
    if(typeof owner!=='string'||!owner||typeof id!=='string'||!id)throw Error('Owner and record ID required');
  }
  async function putEncrypted(owner,id,ciphertext){
    validate(owner,id);
    if(!ciphertext||typeof ciphertext!=='object'||Array.isArray(ciphertext))throw Error('Encrypted payload required');
    const db=await open();
    try{
      await transaction(db,'readwrite',(store)=>store.put({owner,id,ciphertext:structuredClone(ciphertext)}));
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
    const db=await open();
    try{return await transaction(db,'readonly',(store,set)=>{
      const rows=[];
      const lower=after?[owner,after]:[owner,''];
      const range=root.IDBKeyRange.bound(lower,[owner,'\uffff'],!!after,false);
      const req=store.index('byOwner').openCursor(range);
      req.onsuccess=()=>{
        const cursor=req.result;
        if(!cursor||rows.length===limit){set({rows,next:rows.length===limit?rows[rows.length-1].id:null});return;}
        rows.push({id:cursor.value.id,ciphertext:cursor.value.ciphertext});
        cursor.continue();
      };
    });}finally{db.close();}
  }
  root.MedControlModular3ShardStore=Object.freeze({putEncrypted,getEncrypted,pageEncrypted});
})(typeof window!=='undefined'?window:globalThis);
