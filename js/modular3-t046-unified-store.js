/* T-046 isolated unified atomic store. Prototype: ciphertext-only, no legacy vault migration. */
(function(root){
'use strict';
const DB='medcontrol_t046_unified_v1',VERSION=1;
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||Error('IndexedDB request failed'));});
const done=t=>new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error||Error('Transaction failed'));t.onabort=()=>no(t.error||Error('Transaction aborted'));});
function open(){return new Promise((ok,no)=>{const r=root.indexedDB.open(DB,VERSION);
 r.onupgradeneeded=()=>{const d=r.result;
 for(const n of ['events','tokens','positions','segments','manifests','heads','replicaJobs'])d.createObjectStore(n);
 };r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||Error('Open failed'));r.onblocked=()=>no(Error('Upgrade blocked'));});}
const validVault=v=>typeof v==='string'&&/^vault_[A-Za-z0-9_-]{8,128}$/.test(v);
const token=t=>typeof t==='string'&&/^[0-9a-f]{64}$/.test(t);
/* Encrypt medical event bodies before the atomic storage transaction. */
async function appendEncryptedBatch({vaultId,entries,encryptionKey,commitmentKey,expectedHead=null,capacityGateway,reservationBytes}){
 if(!encryptionKey||encryptionKey.type!=='secret'||encryptionKey.algorithm?.name!=='AES-GCM'||
    !encryptionKey.usages.includes('encrypt')||!Array.isArray(entries)||entries.length<1||entries.length>1024)
  throw Error('Invalid encrypted batch');
 const first=(expectedHead?.lastSequence??0)+1;
 const encoder=new TextEncoder(),frames=[],indexes=[];
 for(let i=0;i<entries.length;i++){
  const e=entries[i];
  if(!e||typeof e.id!=='string'||!/^event_[A-Za-z0-9_-]{8,128}$/.test(e.id)||
     typeof e.kind!=='string'||!e.kind||!Array.isArray(e.tokens))throw Error('Invalid event');
  const iv=root.crypto.getRandomValues(new Uint8Array(12));
  const aad=encoder.encode(JSON.stringify([1,vaultId,e.id,e.kind]));
  const plaintext=encoder.encode(JSON.stringify(e.body));
  const ciphertext=new Uint8Array(await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},encryptionKey,plaintext));
  const b64=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
  frames.push({sequence:first+i,eventId:e.id,envelope:{v:1,alg:'AES-GCM',iv:b64(iv),ciphertext:b64(ciphertext)}});
  indexes.push({id:e.id,kind:e.kind,tokens:e.tokens});
 }
 return commitBatch({vaultId,frames,entries:indexes,commitmentKey,expectedHead,capacityGateway,reservationBytes});
}
async function commitBatch({vaultId,frames,entries,commitmentKey,expectedHead=null,capacityGateway,reservationBytes}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!validVault(vaultId)||!Array.isArray(frames)||!frames.length||frames.length>1024||
    !Array.isArray(entries)||entries.length!==frames.length)throw Error('Invalid unified batch');
 if(!capacityGateway||typeof capacityGateway.reserve!=='function'||!Number.isSafeInteger(reservationBytes)||reservationBytes<1)
  throw Error('Confirmed capacity reservation required');
 const seen=new Set(),prepared=[];
 for(let i=0;i<frames.length;i++){
  const f=frames[i],e=entries[i];
  if(!e||e.id!==f.eventId||typeof e.kind!=='string'||!e.kind||
     !Array.isArray(e.tokens)||e.tokens.length>16||e.tokens.some(t=>!token(t))||
     new Set(e.tokens).size!==e.tokens.length||seen.has(e.id))throw Error('Invalid event index');
  seen.add(e.id);prepared.push({id:e.id,kind:e.kind,tokens:e.tokens.slice(),envelope:f.envelope});
 }
 const first=frames[0].sequence,last=frames[frames.length-1].sequence;
 if(first!==((expectedHead?.lastSequence??0)+1)||!Number.isSafeInteger(last))throw Error('Invalid predecessor sequence');
 const segments=await codec.buildSegments({vaultId,frames});
 const generation=(expectedHead?.generation??0)+1;
 const manifest=await codec.buildManifest({vaultId,generation,previousCommitment:expectedHead?.commitment??null,segments});
 const segmentTags=await Promise.all(segments.map(s=>auth.sign(commitmentKey,vaultId,'segment',s.commitment)));
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 const actualBytes=new TextEncoder().encode(JSON.stringify({prepared,segments,manifest,segmentTags,manifestTag})).byteLength;
 if(reservationBytes<actualBytes)throw Error('Insufficient capacity reservation');
 const reservation=await capacityGateway.reserve(vaultId+':'+generation,reservationBytes);
 if(!reservation||reservation.reserved!==true)throw Error('Capacity reservation rejected');
 const locks=root.navigator?.locks;
 if(!locks?.request)throw Error('Cross-tab write lock unavailable');
 return locks.request('medcontrol-t046-unified-'+vaultId,{mode:'exclusive'},async()=>{
  const db=await open();
  try{
   const tx=db.transaction(['events','tokens','positions','segments','manifests','heads','replicaJobs'],'readwrite');
   const finished=done(tx);
   try{
    const heads=tx.objectStore('heads'),current=await req(heads.get(vaultId));
    const same=expectedHead?
      current?.generation===expectedHead.generation&&current?.commitment===expectedHead.commitment&&current?.lastSequence===expectedHead.lastSequence:
      current===undefined;
    if(!same)throw Error('Stale unified vault head');
    for(let i=0;i<prepared.length;i++){
     const e=prepared[i],position=first+i-1;
     tx.objectStore('events').add({kind:e.kind,envelope:e.envelope},[vaultId,e.id]);
     tx.objectStore('positions').add(e.id,[vaultId,position]);
     for(const t of e.tokens)tx.objectStore('tokens').add(true,[vaultId,t,e.id]);
    }
    for(let i=0;i<segments.length;i++)tx.objectStore('segments').add({object:segments[i],tag:segmentTags[i]},[vaultId,segments[i].commitment]);
    tx.objectStore('manifests').add({object:manifest,tag:manifestTag},[vaultId,generation]);
    tx.objectStore('replicaJobs').add({vaultId,generation,manifestCommitment:manifest.commitment,status:'pending'},[vaultId,generation]);
    heads.put({generation,commitment:manifest.commitment,lastSequence:last},vaultId);
    await finished;
    return {committed:true,generation,commitment:manifest.commitment,lastSequence:last,replicaConfirmed:false};
   }catch(err){try{tx.abort();}catch{}await finished.catch(()=>{});throw err;}
  }finally{db.close();}
 });
}
async function readHead(vaultId){if(!validVault(vaultId))throw Error('Invalid vault');const db=await open();try{const tx=db.transaction('heads','readonly'),finished=done(tx),head=await req(tx.objectStore('heads').get(vaultId));await finished;return head??null;}finally{db.close();}}
async function readAt(vaultId,position){if(!validVault(vaultId)||!Number.isSafeInteger(position)||position<0)throw Error('Invalid position');const db=await open();try{const tx=db.transaction(['positions','events'],'readonly'),finished=done(tx);const id=await req(tx.objectStore('positions').get([vaultId,position]));const record=id?await req(tx.objectStore('events').get([vaultId,id])):null;await finished;if(id&&!record)throw Error('Broken unified index');return record?{id,...record}:null;}finally{db.close();}}
/* Bounded authenticated read. Never return medical plaintext if the event
 * identifier, type, vault or ciphertext authentication has been altered. */
async function readDecryptedAt({vaultId,position,encryptionKey}){
 if(!encryptionKey||encryptionKey.type!=='secret'||encryptionKey.algorithm?.name!=='AES-GCM'||
    !encryptionKey.usages.includes('decrypt'))throw Error('AES-GCM decryption key required');
 const record=await readAt(vaultId,position);
 if(!record)return null;
 const envelope=record.envelope;
 if(!envelope||envelope.v!==1||envelope.alg!=='AES-GCM'||
    typeof envelope.iv!=='string'||typeof envelope.ciphertext!=='string')throw Error('Invalid encrypted event');
 const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 const iv=decode(envelope.iv),ciphertext=decode(envelope.ciphertext);
 if(iv.byteLength!==12||ciphertext.byteLength<16||ciphertext.byteLength>3*1024*1024)
  throw Error('Invalid encrypted event size');
 const aad=new TextEncoder().encode(JSON.stringify([1,vaultId,record.id,record.kind]));
 const plain=await root.crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},encryptionKey,ciphertext);
 return {id:record.id,kind:record.kind,body:JSON.parse(new TextDecoder().decode(plain))};
}
async function replicaPage(vaultId,afterGeneration=0,limit=100){if(!validVault(vaultId)||!Number.isSafeInteger(afterGeneration)||afterGeneration<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('Invalid page');const db=await open();try{const tx=db.transaction('replicaJobs','readonly'),finished=done(tx);const range=IDBKeyRange.bound([vaultId,afterGeneration+1],[vaultId,Number.MAX_SAFE_INTEGER]);const cursor=tx.objectStore('replicaJobs').openCursor(range);const jobs=[];await new Promise((ok,no)=>{cursor.onerror=()=>no(cursor.error);cursor.onsuccess=()=>{const c=cursor.result;if(!c||jobs.length===limit){ok();return;}jobs.push(c.value);c.continue();};});await finished;return {jobs,nextGeneration:jobs.length?jobs[jobs.length-1].generation:afterGeneration};}finally{db.close();}}
root.MedControlT046UnifiedStore=Object.freeze({appendEncryptedBatch,commitBatch,readHead,readAt,readDecryptedAt,replicaPage});
})(typeof window!=='undefined'?window:globalThis);
