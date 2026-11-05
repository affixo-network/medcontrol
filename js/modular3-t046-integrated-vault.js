/* T-046 isolated integrated vault interface: local encrypted commit to authenticated
 * segment/manifest and durable replication queue. Never touches legacy vault.
 * Replication remains pending until an independently supplied adapter verifies it.
 */
(function(root){
'use strict';
async function appendAndStage({vaultId,eventId,kind,body,encryptionKey,indexTokens=[],commitmentKey,sequence=1,capacityGateway=null,reservationBytes=null}){
 const journal=root.MedControlT046Journal,codec=root.MedControlT046SegmentCodec,
  auth=root.MedControlT046AuthenticatedCommitment,queue=root.MedControlT046ReplicaQueue,
  head=root.MedControlT046ManifestHead;
 if(!journal||!codec||!auth||!queue||!head||!commitmentKey)throw Error('Integrated vault prerequisites missing');
 if(!Number.isSafeInteger(sequence)||sequence<1)throw Error('Invalid sequence');
 // Generation 1 is a single-event prototype. Reject later sequences rather than
 // silently rewriting generation 1 or losing an existing replication queue entry.
 if(sequence!==1)throw Error('Multi-event manifest chain not implemented');
 if(capacityGateway!==null){
  if(typeof capacityGateway.reserve!=='function'||!Number.isSafeInteger(reservationBytes)||reservationBytes<1)
   throw Error('Invalid capacity reservation prerequisites');
  const reservation=await capacityGateway.reserve(vaultId+':'+eventId,reservationBytes);
  if(!reservation||reservation.reserved!==true)throw Error('Capacity reservation not committed');
 }
 if(await head.read(vaultId))throw Error('Existing manifest head requires multi-event append protocol');
 const local=await journal.append({owner:vaultId,id:eventId,kind,body,key:encryptionKey,tokens:indexTokens,position:sequence-1});
 const record=await journal.encrypted({owner:vaultId,id:eventId});
 if(!record)throw Error('Committed event not readable');
 const segment=await codec.buildSegment({vaultId,frames:[{sequence,eventId,envelope:record.envelope}]});
 const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
 const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 await head.commitObjects({vaultId,segment,manifest,segmentTag,manifestTag,commitmentKey});
 await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
 return {localCommitted:local.committed,replicaConfirmed:false,segment,manifest,segmentTag,manifestTag};
}
async function recoverReplicaQueue({vaultId,commitmentKey}){
 const head=root.MedControlT046ManifestHead,queue=root.MedControlT046ReplicaQueue,
  codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!head||!queue||!codec||!auth||!commitmentKey)throw Error('Recovery prerequisites missing');
 const current=await head.read(vaultId);
 if(!current)return {recovered:false,reason:'no-committed-head'};
 let cursor=current;
 while(cursor){
  const stored=await head.object(vaultId,cursor.commitment);
  if(!stored||stored.type!=='manifest'||stored.object.commitment!==cursor.commitment||
     stored.object.generation!==cursor.generation||
     !await codec.verifyManifest(stored.object)||
     !await auth.verify(commitmentKey,vaultId,'manifest',stored.object.commitment,stored.tag))
   throw Error('Committed manifest authentication failed');
  for(const descriptor of stored.object.segments){
   const segment=await head.object(vaultId,descriptor.commitment);
   if(!segment||segment.type!=='segment'||segment.object.commitment!==descriptor.commitment||
      !await codec.verifySegment(segment.object)||
      !await auth.verify(commitmentKey,vaultId,'segment',segment.object.commitment,segment.tag))
    throw Error('Committed segment authentication failed');
  }
  if(cursor.generation===1){
   if(stored.object.previousCommitment!==null)throw Error('Invalid genesis predecessor');
  }else if(!stored.object.previousCommitment)throw Error('Missing predecessor');

  if(cursor.generation===1)break;
  const previous=await head.object(vaultId,stored.object.previousCommitment);
  if(!previous||previous.type!=='manifest'||previous.object.generation!==cursor.generation-1||
     previous.object.commitment!==stored.object.previousCommitment)
   throw Error('Manifest predecessor missing');
  cursor={generation:previous.object.generation,commitment:previous.object.commitment};
 }
 // Stage only after complete authentication; a second descending traversal
 // avoids retaining one object per historical generation in memory.
 cursor=current;
 while(cursor){
  await queue.enqueue({vaultId,generation:cursor.generation,manifestCommitment:cursor.commitment});
  if(cursor.generation===1)break;
  const stored=await head.object(vaultId,cursor.commitment);
  const previous=await head.object(vaultId,stored.object.previousCommitment);
  cursor={generation:previous.object.generation,commitment:previous.object.commitment};
 }
 return {recovered:true,generation:current.generation,replicaConfirmed:false};
}
async function recoverOrphanEvent({vaultId,eventId,commitmentKey}){
 const journal=root.MedControlT046Journal,codec=root.MedControlT046SegmentCodec,
  auth=root.MedControlT046AuthenticatedCommitment,head=root.MedControlT046ManifestHead;
 if(!journal||!codec||!auth||!head||!commitmentKey)throw Error('Recovery prerequisites missing');
 // Fail closed: an existing head requires explicit chain reconciliation.
 if(await head.read(vaultId))throw Error('Existing manifest head requires reconciliation');
 const record=await journal.encrypted({owner:vaultId,id:eventId});
 if(!record)return {recovered:false,reason:'event-not-found'};
 const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId,envelope:record.envelope}]});
 const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
 const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 await head.commitObjects({vaultId,segment,manifest,segmentTag,manifestTag,commitmentKey});
 return {recovered:true,replicaConfirmed:false,manifestCommitment:manifest.commitment};
}
async function recoverNextOrphanEvent({vaultId,eventId,expectedHead,commitmentKey}){
 const locks=root.navigator?.locks;
 if(!locks||typeof locks.request!=='function')throw Error('Cross-tab write lock unavailable');
 if(typeof vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(vaultId))
  throw Error('Invalid vault');
 return locks.request('medcontrol-t046-chain-'+vaultId,{mode:'exclusive'},async()=>{
  const journal=root.MedControlT046Journal,codec=root.MedControlT046SegmentCodec,
   auth=root.MedControlT046AuthenticatedCommitment,queue=root.MedControlT046ReplicaQueue,
   head=root.MedControlT046ManifestHead;
  if(!journal||!codec||!auth||!queue||!head||!commitmentKey||
     !expectedHead||!Number.isSafeInteger(expectedHead.generation)||expectedHead.generation<1)
   throw Error('Recovery prerequisites missing');
  const current=await head.read(vaultId);
  if(!current||current.commitment!==expectedHead.commitment||
     current.generation!==expectedHead.generation)throw Error('Manifest head conflict');
  const predecessor=await head.object(vaultId,current.commitment);
  if(!predecessor||predecessor.type!=='manifest'||
     predecessor.object.commitment!==current.commitment||
     predecessor.object.generation!==current.generation||
     !await codec.verifyManifest(predecessor.object)||
     !await auth.verify(commitmentKey,vaultId,'manifest',predecessor.object.commitment,predecessor.tag))
   throw Error('Predecessor manifest authentication failed');
  const record=await journal.encrypted({owner:vaultId,id:eventId});
  if(!record)return {recovered:false,reason:'event-not-found'};
  const sequence=predecessor.object.committedThrough+1;
  if(!Number.isSafeInteger(sequence))throw Error('Sequence exhausted');
  const segment=await codec.buildSegment({vaultId,frames:[{sequence,eventId,envelope:record.envelope}]});
  const manifest=await codec.buildManifest({vaultId,generation:current.generation+1,
   previousCommitment:current.commitment,segments:[segment]});
  const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
  const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
  await head.commitObjects({vaultId,expected:current,segment,manifest,segmentTag,manifestTag,commitmentKey});
  await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
  return {recovered:true,replicaConfirmed:false,manifestCommitment:manifest.commitment};
 });
}
async function appendNextAndStageLocked({vaultId,eventId,kind,body,encryptionKey,indexTokens=[],commitmentKey,expectedHead}){
 const journal=root.MedControlT046Journal,codec=root.MedControlT046SegmentCodec,
  auth=root.MedControlT046AuthenticatedCommitment,queue=root.MedControlT046ReplicaQueue,
  head=root.MedControlT046ManifestHead;
 if(!journal||!codec||!auth||!queue||!head||!commitmentKey||
    !expectedHead||!Number.isSafeInteger(expectedHead.generation)||expectedHead.generation<1)
  throw Error('Next append prerequisites missing');
 const current=await head.read(vaultId);
 if(!current||current.commitment!==expectedHead.commitment||
    current.generation!==expectedHead.generation)throw Error('Manifest head conflict');
 const prior=await head.object(vaultId,current.commitment);
 if(!prior||prior.type!=='manifest'||prior.object.commitment!==current.commitment||
    prior.object.generation!==current.generation||
    !await codec.verifyManifest(prior.object)||
    !await auth.verify(commitmentKey,vaultId,'manifest',prior.object.commitment,prior.tag))
  throw Error('Predecessor manifest authentication failed');
 const sequence=prior.object.committedThrough+1;
 if(!Number.isSafeInteger(sequence))throw Error('Sequence exhausted');
 const local=await journal.append({owner:vaultId,id:eventId,kind,body,key:encryptionKey,tokens:indexTokens,position:sequence-1});
 const record=await journal.encrypted({owner:vaultId,id:eventId});
 if(!record)throw Error('Committed event not readable');
 const segment=await codec.buildSegment({vaultId,frames:[{sequence,eventId,envelope:record.envelope}]});
 const manifest=await codec.buildManifest({vaultId,generation:current.generation+1,
  previousCommitment:current.commitment,segments:[segment]});
 const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 await head.commitObjects({vaultId,expected:current,segment,manifest,segmentTag,manifestTag,commitmentKey});
 await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
 return {localCommitted:local.committed,replicaConfirmed:false,segment,manifest,segmentTag,manifestTag};
}
async function appendNextAndStage(args){
 const locks=root.navigator?.locks;
 if(!locks||typeof locks.request!=='function')throw Error('Cross-tab write lock unavailable');
 if(typeof args?.vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(args.vaultId))
  throw Error('Invalid vault');
 return locks.request('medcontrol-t046-chain-'+args.vaultId,{mode:'exclusive'},()=>appendNextAndStageLocked(args));
}
/* Unified admission path for disposable T-046 vaults. The same cross-tab lock
 * protects genesis and successors. A reservation is checked before mutation.
 * This is local durability only; remote replica status remains unconfirmed.
 */
async function append({vaultId,eventId,kind,body,encryptionKey,indexTokens=[],commitmentKey,capacityGateway=null,reservationBytes=null}){
 const locks=root.navigator?.locks,head=root.MedControlT046ManifestHead;
 if(!locks||typeof locks.request!=='function'||!head)throw Error('Unified vault prerequisites missing');
 if(typeof vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(vaultId))throw Error('Invalid vault');
 return locks.request('medcontrol-t046-chain-'+vaultId,{mode:'exclusive'},async()=>{
  if(capacityGateway!==null){
   if(typeof capacityGateway.reserve!=='function'||!Number.isSafeInteger(reservationBytes)||reservationBytes<1)
    throw Error('Invalid capacity reservation prerequisites');
   const reservation=await capacityGateway.reserve(vaultId+':'+eventId,reservationBytes);
   if(!reservation||reservation.reserved!==true)throw Error('Capacity reservation not committed');
  }
  const current=await head.read(vaultId);
  if(!current)return appendAndStage({vaultId,eventId,kind,body,encryptionKey,indexTokens,commitmentKey});
  return appendNextAndStageLocked({vaultId,eventId,kind,body,encryptionKey,indexTokens,commitmentKey,expectedHead:current});
 });
}
/* Atomically publish a bounded batch of already encrypted, contiguous frames.
 * Each batch is authenticated and committed as one manifest generation; the
 * manifest head and every segment share one IndexedDB transaction.
 * Caller retains responsibility for atomic journal/index admission.
 */
async function stageEncryptedBatch({vaultId,frames,commitmentKey,capacityGateway,reservationBytes}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment,
  head=root.MedControlT046ManifestHead,queue=root.MedControlT046ReplicaQueue,locks=root.navigator?.locks;
 if(!codec||!auth||!head||!queue||!locks||typeof locks.request!=='function'||
    typeof vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(vaultId)||
    !Array.isArray(frames)||frames.length<1||!commitmentKey||
    !capacityGateway||typeof capacityGateway.reserve!=='function'||
    !Number.isSafeInteger(reservationBytes)||reservationBytes<1)
  throw Error('Batch staging prerequisites missing');
 return locks.request('medcontrol-t046-chain-'+vaultId,{mode:'exclusive'},async()=>{
  const current=await head.read(vaultId);
  const first=current?current.generation+1:1;
  const previous=current?await head.object(vaultId,current.commitment):null;
  if(current&&(!previous||previous.type!=='manifest'||
    !await codec.verifyManifest(previous.object)||
    !await auth.verify(commitmentKey,vaultId,'manifest',previous.object.commitment,previous.tag)))
   throw Error('Unauthenticated predecessor');
  const nextSequence=previous?previous.object.committedThrough+1:1;
  if(frames[0].sequence!==nextSequence)throw Error('Batch sequence discontinuity');
  // Never authenticate a batch that has no matching durable encrypted journal entries.
  // This is a consistency gate, not a cross-database atomicity guarantee.
  const journal=root.MedControlT046Journal;
  if(!journal||typeof journal.encrypted!=='function')throw Error('Encrypted journal unavailable');
  for(let i=0;i<frames.length;i++){
   const frame=frames[i];
   if(!frame||!Number.isSafeInteger(frame.sequence)||frame.sequence!==nextSequence+i||
      typeof frame.eventId!=='string')throw Error('Invalid batch event sequence');
   const stored=await journal.encrypted({owner:vaultId,id:frame.eventId});
   if(!stored||JSON.stringify(stored.envelope)!==JSON.stringify(frame.envelope))
    throw Error('Batch event not durably committed in encrypted journal');
  }
  const segments=await codec.buildSegments({vaultId,frames});
  if(segments.length>1024)throw Error('Batch exceeds manifest segment capacity');
  const manifest=await codec.buildManifest({vaultId,generation:first,
   previousCommitment:current?.commitment||null,segments});
  const segmentTags=[];
  for(const segment of segments)segmentTags.push(await auth.sign(commitmentKey,vaultId,'segment',segment.commitment));
  const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
  const encodedBytes=new TextEncoder().encode(JSON.stringify({segments,manifest,segmentTags,manifestTag})).byteLength;
  if(!Number.isSafeInteger(encodedBytes)||reservationBytes<encodedBytes)
   throw Error('Capacity reservation understates authenticated batch bytes');
  const reservation=await capacityGateway.reserve(vaultId+':manifest:'+manifest.commitment,reservationBytes);
  if(!reservation||reservation.reserved!==true)throw Error('Capacity reservation not committed');
  await head.commitObjects({vaultId,expected:current,segments,segmentTags,manifest,manifestTag,commitmentKey});
  await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
  return {localCommitted:true,replicaConfirmed:false,segmentCount:segments.length,
   eventCount:manifest.eventCount,manifestCommitment:manifest.commitment};
 });
}
/* Bounded staging directly from the durable encrypted journal.
 * The journal snapshot supplies event envelopes and position evidence together.
 */
async function stageJournalRange({vaultId,startSequence,count,commitmentKey,capacityGateway,reservationBytes}){
 const journal=root.MedControlT046Journal;
 if(!journal||typeof journal.encryptedRange!=='function'||
    !Number.isSafeInteger(startSequence)||startSequence<1||
    !Number.isSafeInteger(count)||count<1||count>1024)
  throw Error('Invalid journal batch request');
 const frames=await journal.encryptedRange({owner:vaultId,start:startSequence-1,limit:count});
 return stageEncryptedBatch({vaultId,frames,commitmentKey,capacityGateway,reservationBytes});
}
/* Admission for bounded batches. Lock covers journal mutation and authenticated
 * publication; a failed publication leaves durable orphan events for recovery.
 * Never claim a cross-database atomic commit. */
async function appendBatch({vaultId,entries,encryptionKey,commitmentKey,capacityGateway,reservationBytes}){
 const journal=root.MedControlT046Journal,head=root.MedControlT046ManifestHead,
  locks=root.navigator?.locks,codec=root.MedControlT046SegmentCodec;
 if(!journal||!head||!codec||!locks||typeof locks.request!=='function'||
    typeof vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(vaultId)||
    !Array.isArray(entries)||entries.length<1||entries.length>1024||
    !capacityGateway||typeof capacityGateway.reserve!=='function'||
    !Number.isSafeInteger(reservationBytes)||reservationBytes<1)
  throw Error('Invalid integrated batch prerequisites');
 return locks.request('medcontrol-t046-chain-'+vaultId,{mode:'exclusive'},async()=>{
  const current=await head.read(vaultId);
  const previous=current?await head.object(vaultId,current.commitment):null;
  if(current&&(!previous||previous.type!=='manifest'||
     !await codec.verifyManifest(previous.object)))throw Error('Invalid predecessor');
  const auth=root.MedControlT046AuthenticatedCommitment,queue=root.MedControlT046ReplicaQueue;
  if(!auth||!queue||!commitmentKey||!encryptionKey||
     typeof auth.sign!=='function'||typeof auth.verify!=='function')
   throw Error('Integrated batch authentication unavailable');
  if(previous&&!await auth.verify(commitmentKey,vaultId,'manifest',previous.object.commitment,previous.tag))
   throw Error('Unauthenticated predecessor');
  const start=previous?previous.object.committedThrough:0;
  if(!Number.isSafeInteger(start+entries.length))throw Error('Batch sequence overflow');
  const seen=new Set();
  for(const entry of entries){
   if(!entry||typeof entry.eventId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(entry.eventId)||
      seen.has(entry.eventId)||typeof entry.kind!=='string'||!entry.kind||
      !Array.isArray(entry.indexTokens)||entry.indexTokens.length>16)
    throw Error('Invalid integrated batch entry');
   seen.add(entry.eventId);
  }
  const prepared=entries.map(e=>({id:e.eventId,kind:e.kind,body:e.body,key:encryptionKey,tokens:e.indexTokens}));
  const reserve=await capacityGateway.reserve(vaultId+':journal-batch:'+start+':'+prepared[0].id,reservationBytes);
  if(!reserve||reserve.reserved!==true)throw Error('Capacity reservation not committed');
  await journal.appendBatch({owner:vaultId,entries:prepared,startPosition:start});
  const frames=await journal.encryptedRange({owner:vaultId,start,limit:prepared.length});
  // The same cross-tab lock is already held; avoid nested navigator.locks.
  const segments=await codec.buildSegments({vaultId,frames});
  const manifest=await codec.buildManifest({vaultId,generation:current?current.generation+1:1,
   previousCommitment:current?.commitment||null,segments});
  const segmentTags=[];
  for(const part of segments)segmentTags.push(await auth.sign(commitmentKey,vaultId,'segment',part.commitment));
  const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
  const encodedBytes=new TextEncoder().encode(JSON.stringify({segments,manifest,segmentTags,manifestTag})).byteLength;
  if(encodedBytes>reservationBytes)throw Error('Insufficient authenticated batch reservation');
  await head.commitObjects({vaultId,expected:current,segments,segmentTags,manifest,manifestTag,commitmentKey});
  await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
  return {localCommitted:true,replicaConfirmed:false,eventCount:frames.length,manifestCommitment:manifest.commitment};
 });
}
/* Incrementally rebuild delivery queue from atomically persisted intents.
 * A bounded page avoids traversing every historical manifest on startup.
 * Cursor advances only after every job on that page is durably enqueued. */
async function recoverReplicaIntentPage({vaultId,afterGeneration=0,limit=100,commitmentKey}){
 const head=root.MedControlT046ManifestHead,queue=root.MedControlT046ReplicaQueue,
  auth=root.MedControlT046AuthenticatedCommitment,codec=root.MedControlT046SegmentCodec;
 if(!head||typeof head.replicaIntentPage!=='function'||!queue||typeof queue.enqueue!=='function'||
    !auth||!codec||!commitmentKey)
  throw Error('Replica intent recovery prerequisites missing');
 const intents=await head.replicaIntentPage({vaultId,afterGeneration,limit});
 let cursor=afterGeneration;
 for(const intent of intents){
  if(intent.vaultId!==vaultId||!Number.isSafeInteger(intent.generation)||intent.generation<=cursor||
     typeof intent.manifestCommitment!=='string'||!/^[a-f0-9]{64}$/.test(intent.manifestCommitment))
   throw Error('Corrupt durable replica intent');
  const manifest=await head.object(vaultId,intent.manifestCommitment);
  if(!manifest||manifest.type!=='manifest'||manifest.object.commitment!==intent.manifestCommitment||
     manifest.object.generation!==intent.generation)throw Error('Replica intent manifest missing');
  if(!await codec.verifyManifest(manifest.object)||
     !await auth.verify(commitmentKey,vaultId,'manifest',manifest.object.commitment,manifest.tag))
   throw Error('Replica intent manifest authentication failed');
  // Verify every immutable segment before allowing a replica delivery job.
  // A signed manifest alone does not prove its referenced payload still exists.
  for(const descriptor of manifest.object.segments){
   const stored=await head.object(vaultId,descriptor.commitment);
   if(!stored||stored.type!=='segment'||stored.object.commitment!==descriptor.commitment||
      stored.object.firstSequence!==descriptor.firstSequence||
      stored.object.lastSequence!==descriptor.lastSequence||
      stored.object.eventCount!==descriptor.eventCount||
      !await codec.verifySegment(stored.object)||
      !await auth.verify(commitmentKey,vaultId,'segment',stored.object.commitment,stored.tag))
    throw Error('Replica intent segment authentication failed');
  }
  await queue.enqueue({vaultId,generation:intent.generation,manifestCommitment:intent.manifestCommitment});
  cursor=intent.generation;
 }
 return {recovered:intents.length,nextGeneration:cursor,hasMore:intents.length===limit};
}
/* Resume replication-intent recovery page by page without unbounded history scans.
 * This does not delete or rewrite encrypted medical records. */
async function recoverAllReplicaIntents({vaultId,commitmentKey,afterGeneration=0,pageSize=100,maxPages=1}){
 if(!Number.isSafeInteger(afterGeneration)||afterGeneration<0||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000||
    !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>1000)
  throw Error('Invalid recovery work budget');
 let recovered=0,hasMore=false;
 for(let page=0;page<maxPages;page++){
  const result=await recoverReplicaIntentPage({vaultId,commitmentKey,afterGeneration,limit:pageSize});
  if(result.nextGeneration<afterGeneration||result.recovered>pageSize)
   throw Error('Replica intent recovery cursor regression');
  recovered+=result.recovered;
  afterGeneration=result.nextGeneration;
  hasMore=result.hasMore;
  if(!hasMore)break;
 }
 return {recovered,nextGeneration:afterGeneration,hasMore};
}
/* Crash recovery for a journal batch committed before its manifest.
 * Existing ciphertext is never rewritten; a conflicting committed head fails closed.
 * The caller must supply the original batch sequence and authenticated vault key. */
async function recoverOrphanBatch({vaultId,startSequence,count,commitmentKey,capacityGateway,reservationBytes}){
 const journal=root.MedControlT046Journal,head=root.MedControlT046ManifestHead;
 if(!journal||!head||!Number.isSafeInteger(startSequence)||startSequence<1||
    !Number.isSafeInteger(count)||count<1||count>1024||
    !Number.isSafeInteger(startSequence+count-1))throw Error('Invalid orphan batch');
 const current=await head.read(vaultId);
 const predecessor=current?await head.object(vaultId,current.commitment):null;
 if(current&&(!predecessor||predecessor.type!=='manifest'))throw Error('Unresolved committed head');
 const expected=predecessor?predecessor.object.committedThrough+1:1;
 if(expected!==startSequence)throw Error('Orphan batch does not follow committed history');
 // stageJournalRange authenticates and commits a new generation without
 // modifying any journal ciphertext. It rechecks the head under its write lock.
 return stageJournalRange({vaultId,startSequence,count,commitmentKey,capacityGateway,reservationBytes});
}
/* Versioned storage boundary for disposable T-046 vaults. This is an opt-in
 * integration of the atomic journal, encrypted index, authenticated manifest
 * and durable replica intent. Existing Modular-3 medical data is untouched.
 * No remote protection is claimed by a successful local transaction. */
function openUnifiedVault({vaultId,encryptionKey,commitmentKey,capacityGateway,reservationBytes,primary=null,recovery=null}){
 const store=root.MedControlT046UnifiedStore;
 if(!store||typeof store.appendEncryptedBatch!=='function'||
    typeof store.readDecryptedAt!=='function'||typeof store.replicaPage!=='function'||
    !encryptionKey||!commitmentKey||!capacityGateway||
    typeof capacityGateway.reserve!=='function'||
    !Number.isSafeInteger(reservationBytes)||reservationBytes<1)
  throw Error('Unified vault prerequisites unavailable');
 const base={vaultId,encryptionKey,commitmentKey,capacityGateway,reservationBytes};
 return Object.freeze({
  version:1,
  async append(entries){
   const expectedHead=await store.readHead(vaultId);
   const receipt=await store.appendEncryptedBatch({...base,entries,expectedHead});
   return Object.freeze({localReceipt:receipt,protectionState:'LOCAL_DURABLE',independentReplicaVerified:false});
  },
  async getByPosition(position){return store.readDecryptedAt({vaultId,position,encryptionKey,commitmentKey});},
  async getHead(){return store.readHead(vaultId);},
  async getReplicaIntentPage(afterGeneration=0,limit=100){return store.replicaPage(vaultId,afterGeneration,limit);},
  async verifyGeneration(generation){return store.verifyGeneration({vaultId,generation,commitmentKey});},
  async sync({afterGeneration=null,maxGenerations=16}={}){
   if(!primary||!recovery)throw Error('Managed archive endpoints unavailable');
   let cursor=afterGeneration;
   if(cursor===null){
    const [a,b]=await Promise.all([primary.getHead(),recovery.getHead()]);
    if((a&&a.vaultId!==vaultId)||(b&&b.vaultId!==vaultId))
     throw Error('Archive vault identity mismatch');
    if((a?.generation??0)===(b?.generation??0)){
     if((a?.commitment??null)!==(b?.commitment??null))
      throw Error('Archive split-brain at matching generation');
     cursor=a?.generation??0;
    }else{
     const advanced=(a?.generation??0)>(b?.generation??0)?a:b;
     const behind=advanced===a?b:a;
     // A one-generation lag can be repaired only when the newer authenticated
     // manifest names the exact older commitment. Otherwise fail closed.
     if(behind?.generation){
      if(advanced.generation!==behind.generation+1)
       throw Error('Archive divergence requires authenticated ancestry proof');
      const advancedAdapter=advanced===a?primary:recovery;
      const stored=await advancedAdapter.getManifest(advanced.commitment);
      const codec=root.MedControlT046SegmentCodec;
      const auth=root.MedControlT046AuthenticatedCommitment;
      if(!stored||stored.manifest?.commitment!==advanced.commitment||
         stored.manifest?.vaultId!==vaultId||
         stored.manifest?.generation!==advanced.generation||
         stored.manifest?.previousCommitment!==behind.commitment||
         !await codec.verifyManifest(stored.manifest)||
         !await auth.verify(commitmentKey,vaultId,'manifest',advanced.commitment,stored.tag))
       throw Error('Archive ancestry authentication failed');
      cursor=behind.generation;
     }else cursor=0;
    }
   }
   return reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,
    afterGeneration:cursor,maxGenerations});
  },
  async restoreGeneration(generation){
   if(!primary||!recovery)throw Error('Managed archive endpoints unavailable');
   return retrieveUnifiedArchiveGeneration({vaultId,generation,commitmentKey,primary,recovery});
  },
  async getProtectionStatus(){
   const head=await store.readHead(vaultId);
   return Object.freeze({lastLocalGeneration:head?.generation??0,independentReplicaVerified:false,
    protectionState:head?'LOCAL_DURABLE':'EMPTY'});
  }
 });
}
/* End-to-end archive delivery for one authenticated local generation.
 * Both adapters must have independent failure domains in a real deployment.
 * The local receipt is never promoted to dual protection on partial success.
 * Retry is idempotent: immutable objects are content addressed, head CAS is
 * accepted only when the already committed head matches exactly. */
async function deliverUnifiedGeneration({vaultId,generation,commitmentKey,primary,recovery}){
 const store=root.MedControlT046UnifiedStore;
 if(!store||!primary||!recovery||primary===recovery||
    !Number.isSafeInteger(generation)||generation<1)
  throw Error('Two distinct archive adapters and valid generation required');
 const required=['putSegment','getSegment','putManifest','getManifest','getHead','compareAndSwapHead'];
 for(const adapter of [primary,recovery])
  if(required.some(method=>typeof adapter[method]!=='function'))
   throw Error('Archive adapter missing immutable/CAS protocol');
 const bundle=await store.exportVerifiedGeneration({vaultId,generation,commitmentKey});
 const manifest=bundle.manifest.object;
 const commitment=manifest.commitment;
 const previous=manifest.previousCommitment??null;
 const canonical=x=>{if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';};
 const publish=async adapter=>{
  for(const segment of bundle.segments){
   const object={segment:segment.object,tag:segment.tag};
   await adapter.putSegment(segment.object.commitment,object);
   const back=await adapter.getSegment(segment.object.commitment);
   if(canonical(back)!==canonical(object))throw Error('Archive segment readback mismatch');
  }
  const object={manifest,tag:bundle.manifest.tag};
  await adapter.putManifest(commitment,object);
  const back=await adapter.getManifest(commitment);
  if(canonical(back)!==canonical(object))throw Error('Archive manifest readback mismatch');
  const current=await adapter.getHead();
  if(current?.generation===generation&&current?.commitment===commitment&&current?.vaultId===vaultId)
   return;
  if((current?.generation??0)!==generation-1||(current?.commitment??null)!==previous)
   throw Error('Archive head predecessor conflict');
  const next={vaultId,generation,commitment};
  if(!await adapter.compareAndSwapHead(generation-1,previous,next))
   throw Error('Archive head compare-and-swap failed');
  const confirmed=await adapter.getHead();
  if(confirmed?.generation!==generation||confirmed?.commitment!==commitment||
     confirmed?.vaultId!==vaultId)throw Error('Archive head readback mismatch');
 };
 await publish(primary);
 await publish(recovery);
 /* A pair of in-memory adapters is not an independent durable backup.
  * Require explicit, distinct, independently certified failure domains before
  * emitting a real protection receipt. Otherwise expose simulation status. */
 const primaryDomain=primary.failureDomain,recoveryDomain=recovery.failureDomain;
 const independentlyDurable=primary.durable===true&&recovery.durable===true&&
  typeof primaryDomain==='string'&&primaryDomain.length>0&&
  typeof recoveryDomain==='string'&&recoveryDomain.length>0&&
  primaryDomain!==recoveryDomain;
 return Object.freeze({vaultId,generation,manifestCommitment:commitment,
  protectionState:independentlyDurable?'DUAL_VERIFIED':'SIMULATED_DUAL_READBACK',
  independentReplicaVerified:independentlyDurable});
}
/* Bounded end-to-end reconciliation of local durable outbox into both archive
 * domains. Resume with the returned cursor; never scan the full medical
 * history or delete intents as a substitute for independent protection. */
async function reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,
 afterGeneration=0,maxGenerations=16}){
 const store=root.MedControlT046UnifiedStore;
 if(!store||!Number.isSafeInteger(afterGeneration)||afterGeneration<0||
    !Number.isSafeInteger(maxGenerations)||maxGenerations<1||maxGenerations>100)
  throw Error('Invalid unified reconciliation work budget');
 const page=await store.replicaPage(vaultId,afterGeneration,maxGenerations);
 let nextGeneration=afterGeneration;
 const receipts=[];
 for(const job of page.jobs){
  if(job.generation!==nextGeneration+1)
   throw Error('Missing contiguous archive generation');
  const receipt=await deliverUnifiedGeneration({
   vaultId,generation:job.generation,commitmentKey,primary,recovery
  });
  receipts.push(receipt);
  nextGeneration=job.generation;
 }
 return Object.freeze({nextGeneration,processed:receipts.length,
  hasMore:page.jobs.length===maxGenerations,receipts});
}
/* Authenticated restore of one archived generation, with explicit independent
 * fallback. No source or patient vault mutation; caller controls migration. */
async function retrieveUnifiedArchiveGeneration({vaultId,generation,commitmentKey,primary,recovery}){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!codec||!auth||!commitmentKey||!Number.isSafeInteger(generation)||generation<1)
  throw Error('Invalid archive recovery prerequisites');
 const failures=[];
 for(const adapter of [primary,recovery]){
  if(!adapter||typeof adapter.getHead!=='function'||
     typeof adapter.getManifest!=='function'||typeof adapter.getSegment!=='function')continue;
  try{
   const head=await adapter.getHead();
   if(!head||head.vaultId!==vaultId||head.generation<generation)
    throw Error('Requested generation unavailable');
   // Recovering a historical generation requires an authenticated checkpoint
   // or immutable manifest identifier; never guess it from the latest head.
   if(head.generation!==generation)throw Error('Historical checkpoint required');
   const stored=await adapter.getManifest(head.commitment);
   if(!stored||stored.manifest?.commitment!==head.commitment||
      stored.manifest?.vaultId!==vaultId||stored.manifest?.generation!==generation||
      !await codec.verifyManifest(stored.manifest)||
      !await auth.verify(commitmentKey,vaultId,'manifest',head.commitment,stored.tag))
    throw Error('Archive manifest authentication failed');
   const segments=[];
   for(const descriptor of stored.manifest.segments){
    const segment=await adapter.getSegment(descriptor.commitment);
    if(!segment||segment.segment?.commitment!==descriptor.commitment||
       !await codec.verifySegment(segment.segment)||
       !await auth.verify(commitmentKey,vaultId,'segment',descriptor.commitment,segment.tag))
     throw Error('Archive segment authentication failed');
    segments.push(segment);
   }
   return Object.freeze({vaultId,generation,manifest:stored,segments,
    source:adapter===primary?'primary':'recovery'});
  }catch(error){failures.push(error);}
 }
 throw Error('No authenticated archive recovery source available: '+failures.length+' failed');
}
root.MedControlT046IntegratedVault=Object.freeze({openUnifiedVault,deliverUnifiedGeneration,reconcileUnifiedArchive,retrieveUnifiedArchiveGeneration,append,appendBatch,recoverOrphanBatch,recoverAllReplicaIntents,recoverReplicaIntentPage,stageEncryptedBatch,stageJournalRange,appendAndStage,appendNextAndStage,recoverReplicaQueue,recoverOrphanEvent,recoverNextOrphanEvent});
})(typeof window!=='undefined'?window:globalThis);
