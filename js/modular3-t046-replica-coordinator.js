/* T-046 isolated queue-to-replica coordinator.
 * Caller provides independently implemented durable replica adapter and key.
 * No medical vault or real remote service is connected.
 */
(function(root){
'use strict';
async function replicate(job,adapter,key,segment,manifest,segmentTag,manifestTag,expectedGeneration){
 const queue=root.MedControlT046ReplicaQueue,protocol=root.MedControlT046ReplicaProtocol;
 if(!queue||!protocol||!job||!manifest||!segment)throw Error('Missing replication prerequisites');
 if(job.vaultId!==manifest.vaultId||job.vaultId!==segment.vaultId||
    job.generation!==manifest.generation||job.manifestCommitment!==manifest.commitment)throw Error('Queue job mismatch');
 if(typeof queue.pendingJob!=='function')throw Error('Keyed queue lookup required');
 const found=await queue.pendingJob(job);
 if(!found)throw Error('No pending replication job');
 const proof=await protocol.resume(adapter,key,segment,manifest,segmentTag,manifestTag,expectedGeneration);
 if(proof.replicaConfirmed!==true||proof.generation!==job.generation)throw Error('Replica not verified');
 // Only this coordinator accepts the protocol's verified result. Queue.confirm
 // remains a lower-level prototype API and is NOT a production security boundary.
 await queue.confirmVerified(job,adapter,key,segment,manifest,segmentTag,manifestTag);
 return {replicaConfirmed:true,generation:job.generation};
}
root.MedControlT046ReplicaCoordinator=Object.freeze({replicate});
})(typeof window!=='undefined'?window:globalThis);
