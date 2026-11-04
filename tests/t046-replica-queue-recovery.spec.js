'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 restart recovers missing replica queue only from authenticated durable objects',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const journal=window.MedControlT046Journal,codec=window.MedControlT046SegmentCodec,
   auth=window.MedControlT046AuthenticatedCommitment,head=window.MedControlT046ManifestHead;
  await journal.append({owner:vaultId,id:eventId,kind:'intake',body:{dose:'1'},key:encryptionKey,tokens:[]});
  const record=await journal.encrypted({owner:vaultId,id:eventId});
  const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId,envelope:record.envelope}]});
  const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
  const segmentTag=await auth.sign(commitmentKey,vaultId,'segment',segment.commitment);
  const manifestTag=await auth.sign(commitmentKey,vaultId,'manifest',manifest.commitment);
  await head.commitObjects({vaultId,segment,manifest,segmentTag,manifestTag,commitmentKey});
  return {vaultId,manifestCommitment:manifest.commitment,key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const recovered=await page.evaluate(async({vaultId,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const first=await window.MedControlT046IntegratedVault.recoverReplicaQueue({vaultId,commitmentKey});
  const second=await window.MedControlT046IntegratedVault.recoverReplicaQueue({vaultId,commitmentKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {first,second,pending};
 },prepared);
 expect(recovered.first).toEqual({recovered:true,generation:1,replicaConfirmed:false});
 expect(recovered.second.recovered).toBe(true);
 expect(recovered.pending).toHaveLength(1);
 expect(recovered.pending[0].manifestCommitment).toBe(prepared.manifestCommitment);
});


test('T-046 crash after second manifest commit restores missing queue without false replica confirmation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),
   kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const expectedHead=await window.MedControlT046ManifestHead.read(vaultId);
  const queue=window.MedControlT046ReplicaQueue;
  window.MedControlT046ReplicaQueue=Object.freeze({...queue,enqueue:async()=>{throw Error('Injected interruption after manifest commit');}});
  let interrupted=false;
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),
   kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead});}
  catch(e){interrupted=/Injected interruption/.test(e.message);}
  window.MedControlT046ReplicaQueue=queue;
  const current=await window.MedControlT046ManifestHead.read(vaultId);
  const pending=(await queue.pending()).filter(x=>x.vaultId===vaultId);
  return {vaultId,interrupted,generation:current.generation,commitment:current.commitment,
   pending:pending.length,key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 expect(prepared.interrupted).toBe(true);
 expect(prepared.generation).toBe(2);
 expect(prepared.pending).toBe(1);
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const recovered=await page.evaluate(async({vaultId,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),
   {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const result=await api.recoverReplicaQueue({vaultId,commitmentKey});
  const repeat=await api.recoverReplicaQueue({vaultId,commitmentKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {result,repeat,pending};
 },prepared);
 expect(recovered.result).toEqual({recovered:true,generation:2,replicaConfirmed:false});
 expect(recovered.repeat.recovered).toBe(true);
 expect(recovered.pending).toHaveLength(2);
 expect(recovered.pending.some(x=>x.generation===2&&x.manifestCommitment===prepared.commitment)).toBe(true);
});
