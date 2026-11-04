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
 const local=await journal.append({owner:vaultId,id:eventId,kind,body,key:encryptionKey,tokens:indexTokens});
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
 const stored=await head.object(vaultId,current.commitment);
 if(!stored||stored.type!=='manifest'||stored.object.commitment!==current.commitment||
    stored.object.generation!==current.generation||
    !await codec.verifyManifest(stored.object)||
    !await auth.verify(commitmentKey,vaultId,'manifest',stored.object.commitment,stored.tag))
  throw Error('Committed manifest authentication failed');
 for(const descriptor of stored.object.segments){
  const segment=await head.object(vaultId,descriptor.commitment);
  if(!segment||segment.type!=='segment'||!await codec.verifySegment(segment.object)||
     !await auth.verify(commitmentKey,vaultId,'segment',segment.object.commitment,segment.tag))
   throw Error('Committed segment authentication failed');
 }
 await queue.enqueue({vaultId,generation:current.generation,manifestCommitment:current.commitment});
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
 const local=await journal.append({owner:vaultId,id:eventId,kind,body,key:encryptionKey,tokens:indexTokens});
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
root.MedControlT046IntegratedVault=Object.freeze({appendAndStage,appendNextAndStage,recoverReplicaQueue,recoverOrphanEvent,recoverNextOrphanEvent});
})(typeof window!=='undefined'?window:globalThis);
