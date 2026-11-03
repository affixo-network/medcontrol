/* T-046: explicit, copy-only bridge from an unlocked legacy session.
 * Never writes to the source, never switches the active UI, never deletes data.
 * The destination is a NEW owner namespace. Failure leaves it untrusted.
 */
(function(root){
 'use strict';
 const SOURCE=root.MedControlModular3ProtectedSession;
 const TARGET=root.MedControlModular3ShardVault;
 const MANIFEST='migration:manifest';
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
   const result={};
   for(const key of Object.keys(value).sort())result[key]=canonical(value[key]);
   return result;
  }
  return value;
 }
 const encode=value=>new TextEncoder().encode(JSON.stringify(canonical(value)));
 async function digest(value){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 }
 function entries(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Invalid legacy state');
  const result=[];
  for(const [key,value] of Object.entries(state)){
   if(Array.isArray(value)){
    result.push({id:'structure:'+key,record:{kind:'array',length:value.length}});
    for(let i=0;i<value.length;i++)
     result.push({id:'item:'+key+':'+String(i).padStart(12,'0'),record:value[i]});
   }else result.push({id:'field:'+key,record:value});
  }
  return result;
 }
 async function copy({owner,password,onProgress=()=>{}}){
  if(!SOURCE?.isUnlocked())throw Error('Unlock original protected session first');
  if(typeof owner!=='string'||!owner.startsWith('t046-copy-'))
   throw Error('Copy destination must use a new t046-copy- namespace');
  const source=SOURCE.read();
  const expectedHash=await digest(source);
  const records=entries(source);
  // create() rejects existing owner; never overwrite an existing copy.
  const vault=await TARGET.create(owner,password);
  try{
   for(let offset=0;offset<records.length;offset+=100){
    await vault.createRecordsBatch(records.slice(offset,offset+100));
    onProgress({copied:Math.min(offset+100,records.length),total:records.length});
   }
   // Do not certify a stale copy if the active medical history changed mid-transfer.
   if(!SOURCE.isUnlocked()||await digest(SOURCE.read())!==expectedHash)
    throw Error('Original medical state changed during copy; destination is not certified');
   // Manifest is written last; incomplete copies cannot pass verification.
   await vault.createRecord(MANIFEST,{format:'t046-legacy-copy-v1',hash:expectedHash,records:records.length});
   const verified=await verify({owner,password,expected:source});
   if(!verified.equal)throw Error('Copied data mismatch');
   return {owner,records:records.length,verified:true,hash:expectedHash};
  }finally{vault.lock();}
 }
 async function verify({owner,password,expected}){
  const vault=await TARGET.open(owner,password);
  try{
   const manifest=await vault.getRecord(MANIFEST);
   if(!manifest||manifest.format!=='t046-legacy-copy-v1')throw Error('Copy incomplete');
   const collected={};const arrays=new Map();
   let after='',seen=0;
   while(true){
    const page=await vault.page({after,limit:100});
    for(const {id,record} of page.rows){
     if(id===MANIFEST)continue;
     seen++;
     if(id.startsWith('field:'))collected[id.slice(6)]=record;
     else if(id.startsWith('structure:')){
      const key=id.slice(10);
      if(!Number.isSafeInteger(record?.length)||record.length<0)throw Error('Invalid array length');
      const prior=arrays.get(key);if(prior?.length!==null&&prior?.length!==undefined)throw Error('Duplicate array structure');
      arrays.set(key,{length:record.length,items:prior?.items||new Map()});
     }else if(id.startsWith('item:')){
      const match=/^item:(.*):(\d{12})$/.exec(id);
      if(!match)throw Error('Invalid item ID');
      const key=match[1],index=Number(match[2]);
      if(!arrays.has(key))arrays.set(key,{length:null,items:new Map()});
      arrays.get(key).items.set(index,record);
     }else throw Error('Unexpected record '+id);
    }
    if(page.next===null)break;
    if(page.next===after)throw Error('Cursor did not advance');
    after=page.next;
   }
   for(const [key,data] of arrays){
    if(data.length===null||data.items.size!==data.length)throw Error('Array incomplete: '+key);
    const arr=[];
    for(let i=0;i<data.length;i++){
     if(!data.items.has(i))throw Error('Missing array item');
     arr.push(data.items.get(i));
    }
    collected[key]=arr;
   }
   const hash=await digest(collected);
   const equal=seen===manifest.records&&hash===manifest.hash&&
     (expected===undefined||hash===await digest(expected));
   return {equal,records:seen,hash};
  }finally{vault.lock();}
 }
 root.MedControlModular3CopyBridge=Object.freeze({copy,verify});
})(typeof window!=='undefined'?window:globalThis);
