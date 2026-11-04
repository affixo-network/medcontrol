'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 recover orphan encrypted event after restart; refuse conflicting replay',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  await window.MedControlT046Journal.append({owner:vaultId,id:eventId,kind:'intake',body:{dose:'1'},key:encryptionKey});
  return {vaultId,eventId,key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async({vaultId,eventId,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const integrated=window.MedControlT046IntegratedVault;
  const first=await integrated.recoverOrphanEvent({vaultId,eventId,commitmentKey});
  const head=await window.MedControlT046ManifestHead.read(vaultId);
  const stored=await window.MedControlT046ManifestHead.object(vaultId,first.manifestCommitment);
  let refused=false;
  try{await integrated.recoverOrphanEvent({vaultId,eventId,commitmentKey});}catch(e){refused=/reconciliation/.test(String(e.message));}
  const queued=await integrated.recoverReplicaQueue({vaultId,commitmentKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {first,head,stored,refused,queued,pending};
 },prepared);
 expect(result.first.recovered).toBe(true);
 expect(result.first.replicaConfirmed).toBe(false);
 expect(result.head.commitment).toBe(result.first.manifestCommitment);
 expect(result.stored.type).toBe('manifest');
 expect(result.refused).toBe(true);
 expect(result.queued.recovered).toBe(true);
 expect(result.pending).toHaveLength(1);
});
