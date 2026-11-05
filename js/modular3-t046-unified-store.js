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
     typeof e.kind!=='string'||!e.kind||!Array.isArray(e.tokens)||
     e.body===undefined)throw Error('Invalid event');
  const iv=root.crypto.getRandomValues(new Uint8Array(12));
  const aad=encoder.encode(JSON.stringify([1,vaultId,e.id,e.kind]));
  const json=JSON.stringify(e.body);
  if(typeof json!=='string')throw Error('Medical event body is not serializable');
  const plaintext=encoder.encode(json);
  if(plaintext.byteLength>2*1024*1024)throw Error('Medical event exceeds bounded encryption limit');
  const ciphertext=new Uint8Array(await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},encryptionKey,plaintext));
  // Encode in bounded chunks: spreading or mapping a multi-megabyte buffer
  // into one JavaScript call can exhaust the stack or duplicate large arrays.
  const b64=bytes=>{
   let binary='';
   for(let offset=0;offset<bytes.length;offset+=8192)
    binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
   return btoa(binary);
  };
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
 let ciphertextBudget=0;
 for(let i=0;i<frames.length;i++){
  const f=frames[i],e=entries[i];
  if(!e||e.id!==f.eventId||typeof e.kind!=='string'||!e.kind||
     !Array.isArray(e.tokens)||e.tokens.length>16||e.tokens.some(t=>!token(t))||
     new Set(e.tokens).size!==e.tokens.length||seen.has(e.id))throw Error('Invalid event index');
  if(!f.envelope||typeof f.envelope.ciphertext!=='string'||typeof f.envelope.iv!=='string'||
     f.envelope.ciphertext.length>4*1024*1024||f.envelope.iv.length!==16)
   throw Error('Invalid encrypted frame bounds');
  ciphertextBudget+=f.envelope.ciphertext.length;
  if(ciphertextBudget>64*1024*1024)throw Error('Encrypted batch exceeds bounded memory budget');
  seen.add(e.id);prepared.push({id:e.id,kind:e.kind,tokens:e.tokens.slice(),envelope:f.envelope});
 }
 // Reject events whose ciphertext is not a valid AES-GCM envelope before
 // allocating an IndexedDB transaction. The decrypting read authenticates AAD.
 for(const frame of frames){
  if(frame.envelope.v!==1||frame.envelope.alg!=='AES-GCM')throw Error('Unsupported encrypted frame');
 }
 const first=frames[0].sequence,last=frames[frames.length-1].sequence;
 if(expectedHead!==null&&(!Number.isSafeInteger(expectedHead.generation)||expectedHead.generation<1||
    !Number.isSafeInteger(expectedHead.lastSequence)||expectedHead.lastSequence<1||
    typeof expectedHead.commitment!=='string'||!/^[0-9a-f]{64}$/.test(expectedHead.commitment)))
  throw Error('Invalid expected head');
 if(!Number.isSafeInteger(first)||first<1||!Number.isSafeInteger(last)||
    first!==((expectedHead?.lastSequence??0)+1)||last-first+1!==frames.length)
  throw Error('Invalid predecessor sequence');
 const segments=await codec.buildSegments({vaultId,frames});
 // The segment codec verifies structural integrity; only signed segments may
 // be admitted to a new atomic generation.
 if(segments.some(segment=>segment.vaultId!==vaultId||
    segment.firstSequence<first||segment.lastSequence>last))
  throw Error('Invalid segment boundary');
 const generation=(expectedHead?.generation??0)+1;
 const manifest=await codec.buildManifest({vaultId,generation,previousCommitment:expectedHead?.commitment??null,segments});
 const segmentTags=await Promise.all(segments.map(s=>auth.sign(commitmentKey,vaultId,'segment',s.commitment)));
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 if(!await codec.verifyManifest(manifest)||
    !await auth.verify(commitmentKey,vaultId,'manifest',manifest.commitment,manifestTag))
  throw Error('New manifest failed authentication');
 const actualBytes=new TextEncoder().encode(JSON.stringify({prepared,segments,manifest,segmentTags,manifestTag})).byteLength;
 if(!Number.isSafeInteger(actualBytes)||actualBytes<1)throw Error('Invalid storage byte accounting');
 if(reservationBytes<actualBytes)throw Error('Insufficient capacity reservation');
 const reservation=await capacityGateway.reserve(vaultId+':'+generation,reservationBytes);
 if(!reservation||reservation.reserved!==true)throw Error('Capacity reservation rejected');
 const locks=root.navigator?.locks;
 if(!locks?.request)throw Error('Cross-tab write lock unavailable');
 return locks.request('medcontrol-t046-unified-'+vaultId,{mode:'exclusive'},async()=>{
  // Crypto is asynchronous: authenticate the predecessor BEFORE opening the
  // IndexedDB write transaction, which must stay free of non-IDB awaits.
  if(expectedHead){
   const priorDb=await open();
   try{
    const priorTx=priorDb.transaction('manifests','readonly'),priorFinished=done(priorTx);
    const prior=await req(priorTx.objectStore('manifests').get([vaultId,expectedHead.generation]));
    await priorFinished;
    if(!prior||prior.object.commitment!==expectedHead.commitment||
       prior.object.generation!==expectedHead.generation||
       prior.object.segments.at(-1)?.lastSequence!==expectedHead.lastSequence||
       !await codec.verifyManifest(prior.object)||
       !await auth.verify(commitmentKey,vaultId,'manifest',prior.object.commitment,prior.tag))
     throw Error('Committed predecessor manifest missing or unauthenticated');
   }finally{priorDb.close();}
  }
  // Storage may change after admission; never assume the earlier reservation
  // proves that this browser still has sufficient free disk capacity.
  if(root.navigator?.storage?.estimate){
   const estimate=await root.navigator.storage.estimate();
   // Browser quota is an estimate, not a physical reservation. Fail closed
   // when the browser cannot supply finite, internally consistent evidence.
   if(!Number.isFinite(estimate.quota)||!Number.isFinite(estimate.usage)||
      estimate.quota<0||estimate.usage<0||estimate.usage>estimate.quota)
    throw Error('Browser storage capacity cannot be confirmed');
   if(estimate.quota-estimate.usage<actualBytes)
    throw Error('Insufficient currently available browser storage');
  }
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
    // Read the predecessor's authenticated manifest in the same write transaction.
    // A forged or orphaned head must never authorize a successor generation.
    if(current){
     const prior=await req(tx.objectStore('manifests').get([vaultId,current.generation]));
     if(!prior||prior.object.commitment!==current.commitment||
        prior.object.generation!==current.generation||
        prior.object.segments.at(-1)?.lastSequence!==current.lastSequence)
      throw Error('Committed predecessor manifest missing or unauthenticated');
    }
    for(let i=0;i<prepared.length;i++){
     const e=prepared[i],position=first+i-1;
     tx.objectStore('events').add({kind:e.kind,envelope:e.envelope},[vaultId,e.id]);
     tx.objectStore('positions').add({id:e.id,generation},[vaultId,position]);
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
/* Authenticate a committed generation and every referenced encrypted segment.
 * Bounded to the maximum 1024 segments of one manifest generation. */
async function verifyGeneration({vaultId,generation,commitmentKey}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!validVault(vaultId)||!Number.isSafeInteger(generation)||generation<1||!codec||!auth||!commitmentKey)
  throw Error('Invalid generation verification');
 const db=await open();
 try{
  const tx=db.transaction('manifests','readonly'),finished=done(tx);
  const stored=await req(tx.objectStore('manifests').get([vaultId,generation]));
  await finished;
  if(!stored)return false;
  if(stored.object.generation!==generation||stored.object.vaultId!==vaultId||
     !await codec.verifyManifest(stored.object)||
     !await auth.verify(commitmentKey,vaultId,'manifest',stored.object.commitment,stored.tag))return false;
  // Authenticate one immutable segment at a time. Never load the entire
  // generation of encrypted medical events into browser memory.
  for(const descriptor of stored.object.segments){
   const segmentTx=db.transaction('segments','readonly'),segmentDone=done(segmentTx);
   const item=await req(segmentTx.objectStore('segments').get([vaultId,descriptor.commitment]));
   await segmentDone;
   if(!item||item.object.commitment!==descriptor.commitment||
      item.object.firstSequence!==descriptor.firstSequence||item.object.lastSequence!==descriptor.lastSequence||
      item.object.eventCount!==descriptor.eventCount||
      !await codec.verifySegment(item.object)||
      !await auth.verify(commitmentKey,vaultId,'segment',item.object.commitment,item.tag))return false;
  }
  return true;
 }finally{db.close();}
}
/* Export exactly one authenticated immutable generation for provider-neutral
 * replication. The caller must verify independent durable readback before
 * reporting remote protection; this method never marks jobs complete. */
async function exportVerifiedGeneration({vaultId,generation,commitmentKey}){
 if(!await verifyGeneration({vaultId,generation,commitmentKey}))
  throw Error('Cannot export unauthenticated generation');
 const db=await open();
 try{
  const tx=db.transaction(['manifests','segments','replicaJobs'],'readonly'),finished=done(tx);
  const stored=await req(tx.objectStore('manifests').get([vaultId,generation]));
  const intent=await req(tx.objectStore('replicaJobs').get([vaultId,generation]));
  if(!stored||!intent||intent.manifestCommitment!==stored.object.commitment)
   throw Error('Durable replica intent mismatch');
  const segments=await Promise.all(stored.object.segments.map(d=>req(tx.objectStore('segments').get([vaultId,d.commitment]))));
  await finished;
  if(segments.some((s,i)=>!s||s.object.commitment!==stored.object.segments[i].commitment))
   throw Error('Missing immutable segment');
  return {vaultId,generation,manifest:stored,segments,intent};
 }finally{db.close();}
}
/* Bounded authenticated export page for large generations. The caller must
 * preserve the returned cursor and verify independent durable readback.
 * No full-generation ciphertext array is allocated by this interface. */
async function exportVerifiedGenerationPage({vaultId,generation,commitmentKey,afterSegment=0,limit=4}){
 if(!Number.isSafeInteger(afterSegment)||afterSegment<0||
    !Number.isSafeInteger(limit)||limit<1||limit>16)
  throw Error('Invalid export page');
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!validVault(vaultId)||!Number.isSafeInteger(generation)||generation<1||!codec||!auth||!commitmentKey)
  throw Error('Invalid authenticated export');
 const db=await open();
 try{
  const tx=db.transaction(['manifests','replicaJobs'],'readonly'),finished=done(tx);
  const stored=await req(tx.objectStore('manifests').get([vaultId,generation]));
  const intent=await req(tx.objectStore('replicaJobs').get([vaultId,generation]));
  await finished;
  if(!stored||!intent||intent.manifestCommitment!==stored.object.commitment||
     stored.object.generation!==generation||stored.object.vaultId!==vaultId||
     !await codec.verifyManifest(stored.object)||
     !await auth.verify(commitmentKey,vaultId,'manifest',stored.object.commitment,stored.tag))
   throw Error('Unauthenticated export manifest or intent');
  const descriptors=stored.object.segments;
  if(afterSegment>descriptors.length)throw Error('Export cursor out of range');
  const segments=[];
  for(let i=afterSegment;i<Math.min(descriptors.length,afterSegment+limit);i++){
   const descriptor=descriptors[i];
   const segmentTx=db.transaction('segments','readonly'),segmentDone=done(segmentTx);
   const item=await req(segmentTx.objectStore('segments').get([vaultId,descriptor.commitment]));
   await segmentDone;
   if(!item||item.object.commitment!==descriptor.commitment||
      item.object.firstSequence!==descriptor.firstSequence||
      item.object.lastSequence!==descriptor.lastSequence||
      item.object.eventCount!==descriptor.eventCount||
      !await codec.verifySegment(item.object)||
      !await auth.verify(commitmentKey,vaultId,'segment',descriptor.commitment,item.tag))
    throw Error('Unauthenticated export segment');
   segments.push(item);
  }
  const nextSegment=afterSegment+segments.length;
  return {vaultId,generation,manifest:stored,intent,segments,nextSegment,
   hasMore:nextSegment<descriptors.length};
 }finally{db.close();}
}
async function readHead(vaultId){if(!validVault(vaultId))throw Error('Invalid vault');const db=await open();try{const tx=db.transaction('heads','readonly'),finished=done(tx),head=await req(tx.objectStore('heads').get(vaultId));await finished;return head??null;}finally{db.close();}}
async function readAt(vaultId,position){if(!validVault(vaultId)||!Number.isSafeInteger(position)||position<0)throw Error('Invalid position');const db=await open();try{const tx=db.transaction(['positions','events'],'readonly'),finished=done(tx);const ref=await req(tx.objectStore('positions').get([vaultId,position]));const id=typeof ref==='string'?ref:ref?.id;const record=id?await req(tx.objectStore('events').get([vaultId,id])):null;await finished;if(id&&!record)throw Error('Broken unified index');return record?{id,generation:ref?.generation??null,...record}:null;}finally{db.close();}}
/* Bounded authenticated read. Never return medical plaintext if the event
 * identifier, type, vault or ciphertext authentication has been altered. */
async function readDecryptedAt({vaultId,position,encryptionKey,commitmentKey=null}){
 if(!encryptionKey||encryptionKey.type!=='secret'||encryptionKey.algorithm?.name!=='AES-GCM'||
    !encryptionKey.usages.includes('decrypt'))throw Error('AES-GCM decryption key required');
 const record=await readAt(vaultId,position);
 if(!record)return null;
 if(commitmentKey){
  const head=await readHead(vaultId);
  if(!head||position>=head.lastSequence||!Number.isSafeInteger(record.generation)||record.generation<1)
   throw Error('Event has no authenticated generation index');
  if(!await verifyGeneration({vaultId,generation:record.generation,commitmentKey}))
   throw Error('Encrypted event generation authentication failed');
  // Authentication must cover this exact ciphertext, not merely an unrelated
  // valid manifest in the same generation.
  const db=await open();
  let match=false;
  try{
   const tx=db.transaction(['manifests','segments'],'readonly'),finished=done(tx);
   const stored=await req(tx.objectStore('manifests').get([vaultId,record.generation]));
   const descriptor=stored?.object.segments.find(x=>x.firstSequence<=position+1&&x.lastSequence>=position+1);
   const segment=descriptor?await req(tx.objectStore('segments').get([vaultId,descriptor.commitment])):null;
   await finished;
   const frame=segment?.object.frames[position+1-descriptor.firstSequence];
   match=frame?.eventId===record.id&&JSON.stringify(frame.envelope)===JSON.stringify(record.envelope);
  }finally{db.close();}
  if(!match)throw Error('Encrypted event does not match authenticated segment');
 }

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
root.MedControlT046UnifiedStore=Object.freeze({appendEncryptedBatch,commitBatch,verifyGeneration,exportVerifiedGeneration,exportVerifiedGenerationPage,readHead,readAt,readDecryptedAt,replicaPage});
})(typeof window!=='undefined'?window:globalThis);
