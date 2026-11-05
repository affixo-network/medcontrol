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
root.MedControlT046IntegratedVault=Object.freeze({append,appendBatch,recoverReplicaIntentPage,stageEncryptedBatch,stageJournalRange,appendAndStage,appendNextAndStage,recoverReplicaQueue,recoverOrphanEvent,recoverNextOrphanEvent});
})(typeof window!=='undefined'?window:globalThis);
