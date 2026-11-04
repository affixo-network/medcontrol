'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 integrated disposable vault commits real ciphertext and stages authenticated replica',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_integrated_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const body={medication:'test medicine',dose:'1 tablet',time:'2030-01-01T10:00:00Z'};
  const result=await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,kind:'intake',body,encryptionKey,commitmentKey});
  const journal=window.MedControlT046Journal,codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment;
  const record=await journal.get({owner:vaultId,id:eventId,key:encryptionKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).find(x=>x.vaultId===vaultId);
  return {localCommitted:result.localCommitted,replicaConfirmed:result.replicaConfirmed,
   body:record.body,ciphertext:result.segment.frames[0].envelope.ciphertext,
   segmentValid:await codec.verifySegment(result.segment),manifestValid:await codec.verifyManifest(result.manifest),
   segmentAuthenticated:await auth.verify(commitmentKey,vaultId,'segment',result.segment.commitment,result.segmentTag),
   manifestAuthenticated:await auth.verify(commitmentKey,vaultId,'manifest',result.manifest.commitment,result.manifestTag),
   queued:pending?.manifestCommitment===result.manifest.commitment};
 });
 expect(result.localCommitted).toBe(true);
 expect(result.replicaConfirmed).toBe(false);
 expect(result.body).toEqual({medication:'test medicine',dose:'1 tablet',time:'2030-01-01T10:00:00Z'});
 expect(result.ciphertext).not.toContain('test medicine');
 expect(result.segmentValid).toBe(true);
 expect(result.manifestValid).toBe(true);
 expect(result.segmentAuthenticated).toBe(true);
 expect(result.manifestAuthenticated).toBe(true);
 expect(result.queued).toBe(true);
});
