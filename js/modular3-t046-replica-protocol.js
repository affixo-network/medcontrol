/* T-046 experimental replica publication protocol.
 * Adapter represents an independent failure domain; no provider is configured.
 * All records are ciphertext-bearing immutable objects supplied by caller.
 */
(function(root){
'use strict';
async function publish(adapter,key,segment,manifest,segmentTag,manifestTag,expectedGeneration){
 const codec=root.MedControlT046SegmentCodec,auth=root.MedControlT046AuthenticatedCommitment;
 if(!adapter||!codec||!auth||!key||!segment||!manifest)throw Error('Missing prerequisites');
 if(!await codec.verifySegment(segment)||!await codec.verifyManifest(manifest)||
    segment.vaultId!==manifest.vaultId||
    !manifest.segments.some(x=>x.commitment===segment.commitment))throw Error('Invalid replica objects');
 if(!await auth.verify(key,segment.vaultId,'segment',segment.commitment,segmentTag)||
    !await auth.verify(key,manifest.vaultId,'manifest',manifest.commitment,manifestTag))throw Error('Unauthenticated replica objects');
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||manifest.generation!==expectedGeneration+1)throw Error('Invalid generation');
 // All operations are remote-adapter calls, with explicit read-back verification.
 await adapter.putSegment(segment.commitment,{segment,tag:segmentTag});
 const sr=await adapter.getSegment(segment.commitment);
 if(!sr||JSON.stringify(sr)!==JSON.stringify({segment,tag:segmentTag}))throw Error('Segment readback failed');
 await adapter.putManifest(manifest.generation,{manifest,tag:manifestTag});
 const mr=await adapter.getManifest(manifest.generation);
 if(!mr||JSON.stringify(mr)!==JSON.stringify({manifest,tag:manifestTag}))throw Error('Manifest readback failed');
 // The adapter must implement an atomic conditional head write in its own
 // durable store. A non-atomic adapter does NOT meet the production contract.
 const next={vaultId:manifest.vaultId,generation:manifest.generation,commitment:manifest.commitment};
 const ok=await adapter.compareAndSwapHead(expectedGeneration,manifest.previousCommitment,next);
 if(!ok)throw Error('Replica head conflict');
 const head=await adapter.getHead();
 if(JSON.stringify(head)!==JSON.stringify(next))throw Error('Replica head readback failed');
 return {replicaConfirmed:true,generation:next.generation};
}
root.MedControlT046ReplicaProtocol=Object.freeze({publish});
})(typeof window!=='undefined'?window:globalThis);
