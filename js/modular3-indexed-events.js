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
    tx.objectStore(EVENTS).add({owner,id,envelope:structuredClone(envelope),tokens:opaque,revision:1});
    const index=tx.objectStore(TOKENS);
    for(const token of opaque)index.add({owner,token,id});
   });
  }finally{db.close();}
 }
 async function insertBatch(owner,records){
  check(owner,'owner');
  if(!Array.isArray(records)||records.length<1||records.length>100)throw Error('Batch must contain 1..100 events');
  const ids=new Set();
  const prepared=records.map(item=>{
   if(!item||typeof item!=='object')throw Error('Invalid batch event');
   check(item.id,'id');
   if(ids.has(item.id))throw Error('Duplicate batch id');
   ids.add(item.id);
   if(!item.envelope||typeof item.envelope!=='object'||Array.isArray(item.envelope))throw Error('Encrypted envelope required');
   return {owner,id:item.id,envelope:structuredClone(item.envelope),tokens:checkTokens(item.tokens),revision:1};
  });
  const db=await open();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction([EVENTS,TOKENS],'readwrite');
    tx.oncomplete=()=>resolve(prepared.length);
    tx.onerror=()=>reject(tx.error||Error('Atomic batch write failed'));
    tx.onabort=()=>reject(tx.error||Error('Atomic batch write aborted'));
    const events=tx.objectStore(EVENTS),index=tx.objectStore(TOKENS);
    for(const record of prepared){
     events.add(record);
     for(const token of record.tokens)index.add({owner,token,id:record.id});
    }
   });
  }finally{db.close();}
 }
 async function scanPage(owner,{after='',limit=100}={}){
  check(owner,'owner');
  if(typeof after!=='string'||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid scan page');
  const db=await open();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction(EVENTS,'readonly'),rows=[];
    let next=null;
    tx.oncomplete=()=>resolve({rows,next});
    tx.onerror=()=>reject(tx.error||Error('Owner scan failed'));
    tx.onabort=()=>reject(tx.error||Error('Owner scan aborted'));
    const range=root.IDBKeyRange.bound([owner,after],[owner,'\uffff'],!!after,true);
    const req=tx.objectStore(EVENTS).openCursor(range);
    req.onsuccess=()=>{
     const cursor=req.result;
     if(!cursor)return;
     if(rows.length===limit){next=rows[rows.length-1].id;return;}
     const value=cursor.value;
     rows.push({id:value.id,envelope:value.envelope,revision:value.revision});
     cursor.continue();
    };
   });
  }finally{db.close();}
 }
 async function replaceIfRevision(owner,id,expectedRevision,envelope,tokens){
  check(owner,'owner');check(id,'id');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw Error('Invalid expected revision');
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw Error('Encrypted envelope required');
  const opaque=checkTokens(tokens),db=await open();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction([EVENTS,TOKENS],'readwrite');
    let conflict=false;
    tx.oncomplete=()=>resolve(expectedRevision+1);
    tx.onerror=()=>reject(tx.error||Error('Atomic replacement failed'));
    tx.onabort=()=>reject(conflict?Error('Stale event revision'):tx.error||Error('Atomic replacement aborted'));
    const events=tx.objectStore(EVENTS),index=tx.objectStore(TOKENS);
    const read=events.get([owner,id]);
    read.onsuccess=()=>{
     const prior=read.result;
     if(!prior||prior.revision!==expectedRevision||!Array.isArray(prior.tokens)){
      conflict=true;tx.abort();return;
     }
     const old=new Set(prior.tokens),next=new Set(opaque);
     for(const token of old)if(!next.has(token))index.delete([owner,token,id]);
     for(const token of next)if(!old.has(token))index.add({owner,token,id});
     events.put({owner,id,envelope:structuredClone(envelope),tokens:opaque,revision:expectedRevision+1});
    };
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
      rows.push({id,envelope:read.result.envelope,revision:read.result.revision});
      cursor.continue();
     };
    };
   });
  }finally{db.close();}
 }
 // Dedicated high-throughput session: one open connection, bounded atomic batches.
 // The caller must close the session. Existing API and medical vault remain unchanged.
 async function openBatchSession(){
  const db=await open();
  let closed=false;
  return Object.freeze({
   async insertBatch(owner,records){
    if(closed)throw Error('Batch session closed');
    check(owner,'owner');
    if(!Array.isArray(records)||records.length<1||records.length>1000)throw Error('Batch must contain 1..1000 events');
    const ids=new Set();
    const prepared=records.map(item=>{
     if(!item||typeof item!=='object')throw Error('Invalid batch event');
     check(item.id,'id');
     if(ids.has(item.id))throw Error('Duplicate batch id');
     ids.add(item.id);
     if(!item.envelope||typeof item.envelope!=='object'||Array.isArray(item.envelope))throw Error('Encrypted envelope required');
     return {owner,id:item.id,envelope:structuredClone(item.envelope),tokens:checkTokens(item.tokens),revision:1};
    });
    return await new Promise((resolve,reject)=>{
     const tx=db.transaction([EVENTS,TOKENS],'readwrite');
     tx.oncomplete=()=>resolve(prepared.length);
     tx.onerror=()=>reject(tx.error||Error('Atomic session batch write failed'));
     tx.onabort=()=>reject(tx.error||Error('Atomic session batch write aborted'));
     const events=tx.objectStore(EVENTS),index=tx.objectStore(TOKENS);
     for(const record of prepared){
      events.add(record);
      for(const token of record.tokens)index.add({owner,token,id:record.id});
     }
    });
   },
   close(){if(!closed){closed=true;db.close();}}
  });
 }
 root.MedControlT046IndexedEvents=Object.freeze({insert,insertBatch,scanPage,replaceIfRevision,page,openBatchSession});
})(typeof window!=='undefined'?window:globalThis);
