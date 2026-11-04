/* T-046 authenticated gateway for isolated atomic experiment only.
 * No production vault access. Authentication key is supplied by caller.
 */
(function(root){
'use strict';
async function check(key,segment,manifest,segmentTag,manifestTag){
 const auth=root.MedControlT046AuthenticatedCommitment;
 const codec=root.MedControlT046SegmentCodec;
 if(!auth||!codec||!key||!segment||!manifest)throw Error('Missing authentication prerequisites');
 if(!await codec.verifySegment(segment)||!await codec.verifyManifest(manifest))throw Error('Invalid commitments');
 if(segment.vaultId!==manifest.vaultId)throw Error('Vault mismatch');
 if(!await auth.verify(key,segment.vaultId,'segment',segment.commitment,segmentTag))throw Error('Unauthenticated segment');
 if(!await auth.verify(key,manifest.vaultId,'manifest',manifest.commitment,manifestTag))throw Error('Unauthenticated manifest');
}
async function commitAuthenticated(key,segment,manifest,expectedGeneration,segmentTag,manifestTag){
 await check(key,segment,manifest,segmentTag,manifestTag);
 return root.MedControlT046AtomicExperiment.commit(segment,manifest,expectedGeneration);
}
async function restoreAuthenticated(key,segment,segmentTag){
 const auth=root.MedControlT046AuthenticatedCommitment;
 const codec=root.MedControlT046SegmentCodec;
 if(!auth||!codec||!key||!segment||!await codec.verifySegment(segment)||
    !await auth.verify(key,segment.vaultId,'segment',segment.commitment,segmentTag))throw Error('Unauthenticated recovery segment');
 return root.MedControlT046AtomicExperiment.restoreSegmentFromCopy(segment);
}
root.MedControlT046AuthenticatedGateway=Object.freeze({commitAuthenticated,restoreAuthenticated});
})(typeof window!=='undefined'?window:globalThis);
