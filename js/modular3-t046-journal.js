/* T-046 isolated encrypted append-only journal.
 * No access to legacy MedControl vault. Every entry and its opaque index tokens
 * commit in the same IndexedDB transaction.
 */
(function(root){
'use strict';
const NAME='medcontrol_t046_journal_v1', VERSION=2, EVENTS='events', TOKENS='tokens', POSITIONS='positions';
const te=new TextEncoder(),td=new TextDecoder();
const assertId=(v,n)=>{if(typeof v!=='string'||!v||v.length>256)throw Error('Invalid '+n);};
const req=(r)=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('IndexedDB request failed'));});
const txDone=(tx)=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Transaction failed'));tx.onabort=()=>reject(tx.error||Error('Transaction aborted'));});
function open(){
 return new Promise((resolve,reject)=>{
  const r=root.indexedDB.open(NAME,VERSION);
  r.onupgradeneeded=()=>{
   const db=r.result;
   if(!db.objectStoreNames.contains(EVENTS))db.createObjectStore(EVENTS,{keyPath:['owner','id']});
   if(!db.objectStoreNames.contains(TOKENS))db.createObjectStore(TOKENS,{keyPath:['owner','token','id']});
   if(!db.objectStoreNames.contains(POSITIONS))db.createObjectStore(POSITIONS,{keyPath:['owner','position']});
  };
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('Open failed'));
  r.onblocked=()=>reject(Error('Database upgrade blocked'));
 });
}
const hex=(bytes)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const b64=(bytes)=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
const unb64=(s)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function checkKey(key){
 if(!key||key.type!=='secret'||key.algorithm.name!=='AES-GCM'||!key.usages.includes('encrypt')||!key.usages.includes('decrypt'))throw Error('AES-GCM vault key required');
}
async function tokenFor(key,owner,tag){
 assertId(owner,'owner');assertId(tag,'tag');
 // Independent HMAC key must be supplied; never reuse the AES-GCM encryption key.
 if(!key||key.type!=='secret'||key.algorithm.name!=='HMAC'||!key.usages.includes('sign'))throw Error('HMAC index key required');
 return hex(new Uint8Array(await root.crypto.subtle.sign('HMAC',key,te.encode(JSON.stringify([owner,tag])))));
}
async function encrypt(key,owner,id,kind,body){
 checkKey(key);assertId(owner,'owner');assertId(id,'id');assertId(kind,'kind');
 const iv=root.crypto.getRandomValues(new Uint8Array(12));
 const aad=te.encode(JSON.stringify([1,owner,id,kind]));
 const plaintext=te.encode(JSON.stringify(body));
 const ciphertext=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plaintext);
 return {v:1,alg:'AES-GCM',iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};
}
async function decrypt(key,owner,id,kind,envelope){
 checkKey(key);
 if(!envelope||envelope.v!==1||envelope.alg!=='AES-GCM')throw Error('Unsupported encrypted envelope');
 const aad=te.encode(JSON.stringify([1,owner,id,kind]));
 const bytes=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv),additionalData:aad},key,unb64(envelope.ciphertext));
 return JSON.parse(td.decode(bytes));
}
function validateTokens(tokens){
 if(!Array.isArray(tokens)||tokens.length>16)throw Error('Invalid tokens');
 const s=new Set();
 for(const t of tokens){if(typeof t!=='string'||!/^[0-9a-f]{64}$/.test(t)||s.has(t))throw Error('Invalid or duplicate opaque token');s.add(t);}
 return [...s].sort();
}
async function append({owner,id,kind,body,key,tokens=[],position}){
 assertId(owner,'owner');assertId(id,'id');assertId(kind,'kind');
 if(position!==undefined&&(!Number.isSafeInteger(position)||position<0||position>Number.MAX_SAFE_INTEGER))throw Error('Invalid event position');
 const index=validateTokens(tokens);
 const envelope=await encrypt(key,owner,id,kind,body);
 const db=await open();
 try{
  const tx=db.transaction([EVENTS,TOKENS,POSITIONS],'readwrite');
  const finished=txDone(tx);
  tx.objectStore(EVENTS).add({owner,id,kind,envelope,tokens:index});
  for(const token of index)tx.objectStore(TOKENS).add({owner,token,id});
  if(position!==undefined)tx.objectStore(POSITIONS).add({owner,position,id});
  await finished;
  return {id,committed:true};
 }finally{db.close();}
}
async function get({owner,id,key}){
 assertId(owner,'owner');assertId(id,'id');
 const db=await open();
 try{
  const tx=db.transaction(EVENTS,'readonly'),finished=txDone(tx);
  const record=await req(tx.objectStore(EVENTS).get([owner,id]));
  await finished;
  if(!record)return null;
  return {id,kind:record.kind,body:await decrypt(key,owner,id,record.kind,record.envelope)};
 }finally{db.close();}
}
async function page({owner,token,after='',limit=100,key}){
 assertId(owner,'owner');
 if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))throw Error('Invalid token');
 if(typeof after!=='string'||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid page');
 const db=await open();
 try{
  const tx=db.transaction([EVENTS,TOKENS],'readonly'),finished=txDone(tx),records=[];
  const range=root.IDBKeyRange.bound([owner,token,after],[owner,token,'\uffff'],Boolean(after),true);
  const cursorRequest=tx.objectStore(TOKENS).openKeyCursor(range);
  await new Promise((resolve,reject)=>{
   cursorRequest.onerror=()=>reject(cursorRequest.error||Error('Index cursor failed'));
   cursorRequest.onsuccess=()=>{
    const cursor=cursorRequest.result;
    if(!cursor||records.length>=limit){resolve();return;}
    const id=cursor.key[2];
    const read=tx.objectStore(EVENTS).get([owner,id]);
    read.onerror=()=>reject(read.error||Error('Event read failed'));
    read.onsuccess=()=>{
     if(!read.result){reject(Error('Index refers to missing event'));return;}
     records.push(read.result);cursor.continue();
    };
   };
  });
  await finished;
  const rows=[];
  for(const r of records)rows.push({id:r.id,kind:r.kind,body:await decrypt(key,owner,r.id,r.kind,r.envelope)});
  return {rows,next:records.length===limit?records[records.length-1].id:null};
 }finally{db.close();}
}
async function getAt({owner,position,key}){
 assertId(owner,'owner');
 if(!Number.isSafeInteger(position)||position<0||position>Number.MAX_SAFE_INTEGER)throw Error('Invalid event position');
 const db=await open();
 try{
  const tx=db.transaction([POSITIONS,EVENTS],'readonly'),finished=txDone(tx);
  const ref=await req(tx.objectStore(POSITIONS).get([owner,position]));
  const record=ref?await req(tx.objectStore(EVENTS).get([owner,ref.id])):null;
  await finished;
  if(!ref)return null;
  if(!record)throw Error('Position refers to missing encrypted event');
  return {position,id:record.id,kind:record.kind,body:await decrypt(key,owner,record.id,record.kind,record.envelope)};
 }finally{db.close();}
}
async function encrypted({owner,id}){
 assertId(owner,'owner');assertId(id,'id');
 const db=await open();
 try{
  const tx=db.transaction(EVENTS,'readonly'),finished=txDone(tx);
  const record=await req(tx.objectStore(EVENTS).get([owner,id]));
  await finished;
  if(!record)return null;
  return structuredClone({owner:record.owner,id:record.id,kind:record.kind,envelope:record.envelope});
 }finally{db.close();}
}
root.MedControlT046Journal=Object.freeze({append,get,getAt,page,tokenFor,encrypted});
})(typeof window!=='undefined'?window:globalThis);
