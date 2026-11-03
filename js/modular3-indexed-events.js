/* T-046: isolated atomic encrypted event + opaque token index store.
 * Experimental v1: does not read or modify the existing shard/legacy vault.
 */
(function(root){
 'use strict';
 const DB='medcontrol_t046_indexed_events_v1', VERSION=1;
 const EVENTS='events', TOKENS='tokens';
 const check=(s,label)=>{if(typeof s!=='string'||!s||s.length>512)throw Error('Invalid '+label);};
 const checkTokens=values=>{
  if(!Array.isArray(values)||values.length>16)throw Error('Invalid token list');
  const result=[...values];
  for(const token of result){check(token,'token');if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid opaque token');}
  if(new Set(result).size!==result.length)throw Error('Duplicate token');
  return result.sort();
 };
 function open(){
  return new Promise((resolve,reject)=>{
   const req=root.indexedDB.open(DB,VERSION);
   req.onupgradeneeded=()=>{
    const db=req.result;
    db.createObjectStore(EVENTS,{keyPath:['owner','id']});
    db.createObjectStore(TOKENS,{keyPath:['owner','token','id']});
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error('Indexed storage open failed'));
   req.onblocked=()=>reject(Error('Indexed storage blocked'));
  });
 }
 async function insert(owner,id,envelope,tokens){
  check(owner,'owner');check(id,'id');
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw Error('Encrypted envelope required');
  const opaque=checkTokens(tokens),db=await open();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction([EVENTS,TOKENS],'readwrite');
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error||Error('Atomic indexed write failed'));
    tx.onabort=()=>reject(tx.error||Error('Atomic indexed write aborted'));
    tx.objectStore(EVENTS).add({owner,id,envelope:structuredClone(envelope)});
    const index=tx.objectStore(TOKENS);
    for(const token of opaque)index.add({owner,token,id});
   });
  }finally{db.close();}
 }
 async function page(owner,token,{after='',limit=100}={}){
  check(owner,'owner');check(token,'token');
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid opaque token');
  if(typeof after!=='string'||!Number.isInteger(limit)||limit<1||limit>500)throw Error('Invalid page');
  const db=await open();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction([EVENTS,TOKENS],'readonly');
    let rows=[],next=null;
    tx.oncomplete=()=>resolve({rows,next});
    tx.onerror=()=>reject(tx.error||Error('Indexed query failed'));
    tx.onabort=()=>reject(tx.error||Error('Indexed query aborted'));
    const range=root.IDBKeyRange.bound([owner,token,after],[owner,token,'\uffff'],!!after,true);
    const request=tx.objectStore(TOKENS).openKeyCursor(range);
    request.onsuccess=()=>{
     const cursor=request.result;
     if(!cursor)return;
     if(rows.length===limit){next=rows[rows.length-1].id;return;}
     const id=cursor.key[2];
     const read=tx.objectStore(EVENTS).get([owner,id]);
     read.onsuccess=()=>{
      if(!read.result){tx.abort();return;}
      rows.push({id,envelope:read.result.envelope});
      cursor.continue();
     };
    };
   });
  }finally{db.close();}
 }
 root.MedControlT046IndexedEvents=Object.freeze({insert,page});
})(typeof window!=='undefined'?window:globalThis);
