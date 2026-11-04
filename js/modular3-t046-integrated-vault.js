/* T-046 isolated integrated vault interface: local encrypted commit to authenticated
 * segment/manifest and durable replication queue. Never touches legacy vault.
 * Replication remains pending until an independently supplied adapter verifies it.
 */
(function(root){
'use strict';
async function appendAndStage({vaultId,eventId,kind,body,encryptionKey,indexTokens=[],commitmentKey,sequence=1}){
 const journal=root.MedControlT046Journal,codec=root.MedControlT046SegmentCodec,
  auth=root.MedControlT046AuthenticatedCommitment,queue=root.MedControlT046ReplicaQueue;
 if(!journal||!codec||!auth||!queue||!commitmentKey)throw Error('Integrated vault prerequisites missing');
 if(!Number.isSafeInteger(sequence)||sequence<1)throw Error('Invalid sequence');
 const local=await journal.append({owner:vaultId,id:eventId,kind,body,key:encryptionKey,tokens:indexTokens});
 const record=await journal.encrypted({owner:vaultId,id:eventId});
 if(!record)throw Error('Committed event not readable');
 const segment=await codec.buildSegment({vaultId,frames:[{sequence,eventId,envelope:record.envelope}]});
 const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
 const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
 const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
 await queue.enqueue({vaultId,generation:manifest.generation,manifestCommitment:manifest.commitment});
 return {localCommitted:local.committed,replicaConfirmed:false,segment,manifest,segmentTag,manifestTag};
}
root.MedControlT046IntegratedVault=Object.freeze({appendAndStage});
})(typeof window!=='undefined'?window:globalThis);
