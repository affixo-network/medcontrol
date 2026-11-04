'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 integrated encrypted event replicates to immutable store with verified head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','replica-protocol','replica-coordinator','immutable-replica','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_integrated_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const staged=await window.MedControlT046IntegratedVault.appendAndStage({
   vaultId,eventId,kind:'intake',body:{medicine:'sample',dose:'1 tablet'},encryptionKey,commitmentKey
  });
  const db=await window.MedControlT046ImmutableReplica.open('t046-integrated-'+crypto.randomUUID());
  const adapter=window.MedControlT046ImmutableReplica.create(db);
  const job={vaultId,generation:staged.manifest.generation,manifestCommitment:staged.manifest.commitment};
  const proof=await window.MedControlT046ReplicaCoordinator.replicate(
   job,adapter,commitmentKey,staged.segment,staged.manifest,staged.segmentTag,staged.manifestTag,0
  );
  const [head,storedSegment,storedManifest]=await Promise.all([
   adapter.getHead(),adapter.getSegment(staged.segment.commitment),adapter.getManifest(staged.manifest.commitment)
  ]);
  const pending=(await window.MedControlT046ReplicaQueue.pending()).some(x=>x.vaultId===vaultId);
  const decrypted=await window.MedControlT046Journal.get({owner:vaultId,id:eventId,key:encryptionKey});
  db.close();
  return {localCommitted:staged.localCommitted,initialReplicaConfirmed:staged.replicaConfirmed,
   replicaConfirmed:proof.replicaConfirmed,pending,head:head?.commitment,
   manifest:storedManifest?.manifest.commitment,segment:storedSegment?.segment.commitment,
   expectedManifest:staged.manifest.commitment,expectedSegment:staged.segment.commitment,
   decrypted:decrypted.body};
 });
 expect(result.localCommitted).toBe(true);
 expect(result.initialReplicaConfirmed).toBe(false);
 expect(result.replicaConfirmed).toBe(true);
 expect(result.pending).toBe(false);
 expect(result.head).toBe(result.expectedManifest);
 expect(result.manifest).toBe(result.expectedManifest);
 expect(result.segment).toBe(result.expectedSegment);
 expect(result.decrypted).toEqual({medicine:'sample',dose:'1 tablet'});
});
