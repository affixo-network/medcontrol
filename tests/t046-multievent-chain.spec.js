'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 two encrypted events form authenticated linked generations and reject stale head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault,head=window.MedControlT046ManifestHead;
  const first=await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const expectedHead=await head.read(vaultId);
  const second=await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead});
  const finalHead=await head.read(vaultId);
  const predecessor=await head.object(vaultId,second.manifest.previousCommitment);
  let staleRejected=false;
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:3},encryptionKey,commitmentKey,expectedHead});}
  catch(e){staleRejected=/conflict/.test(e.message);}
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {firstGeneration:first.manifest.generation,secondGeneration:second.manifest.generation,
   firstSequence:first.segment.firstSequence,secondSequence:second.segment.firstSequence,
   linked:second.manifest.previousCommitment===first.manifest.commitment,
   finalHead:finalHead.commitment,secondCommitment:second.manifest.commitment,
   predecessor:predecessor?.object.commitment,staleRejected,pending:pending.length};
 });
 expect(result.firstGeneration).toBe(1);
 expect(result.secondGeneration).toBe(2);
 expect(result.firstSequence).toBe(1);
 expect(result.secondSequence).toBe(2);
 expect(result.linked).toBe(true);
 expect(result.finalHead).toBe(result.secondCommitment);
 expect(result.predecessor).toBeTruthy();
 expect(result.staleRejected).toBe(true);
 expect(result.pending).toBe(2);
});
