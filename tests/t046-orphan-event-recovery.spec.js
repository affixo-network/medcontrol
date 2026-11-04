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


test('T-046 restart reconciles second encrypted event interrupted between journal and manifest',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),
   kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const expectedHead=await window.MedControlT046ManifestHead.read(vaultId);
  const original=window.MedControlT046ManifestHead;
  window.MedControlT046ManifestHead=Object.freeze({...original,commitObjects:async()=>{throw Error('Injected crash before manifest commit');}});
  let interrupted=false;
  try{
   await api.appendNextAndStage({vaultId,eventId,kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead});
  }catch(e){interrupted=/Injected crash/.test(e.message);}
  window.MedControlT046ManifestHead=original;
  const orphan=await window.MedControlT046Journal.encrypted({owner:vaultId,id:eventId});
  const unchanged=await original.read(vaultId);
  return {vaultId,eventId,expectedHead,interrupted,orphanPresent:!!orphan,
   headUnchanged:unchanged.commitment===expectedHead.commitment,
   key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 expect(prepared.interrupted).toBe(true);
 expect(prepared.orphanPresent).toBe(true);
 expect(prepared.headUnchanged).toBe(true);
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async({vaultId,eventId,expectedHead,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),
   {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const recovered=await api.recoverNextOrphanEvent({vaultId,eventId,expectedHead,commitmentKey});
  const current=await window.MedControlT046ManifestHead.read(vaultId);
  const manifest=await window.MedControlT046ManifestHead.object(vaultId,current.commitment);
  const storedSegment=await window.MedControlT046ManifestHead.object(vaultId,manifest.object.segments[0].commitment);
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  let replayRejected=false;
  try{await api.recoverNextOrphanEvent({vaultId,eventId,expectedHead,commitmentKey});}
  catch(e){replayRejected=/conflict/.test(e.message);}
  return {recovered,current,manifest:manifest.object,segment:storedSegment.object,
   pending,replayRejected,
   valid:await window.MedControlT046SegmentCodec.verifySegment(storedSegment.object)&&
    await window.MedControlT046SegmentCodec.verifyManifest(manifest.object)};
 },prepared);
 expect(result.recovered.recovered).toBe(true);
 expect(result.recovered.replicaConfirmed).toBe(false);
 expect(result.current.generation).toBe(2);
 expect(result.manifest.previousCommitment).toBe(prepared.expectedHead.commitment);
 expect(result.manifest.committedThrough).toBe(2);
 expect(result.segment.frames[0].eventId).toBe(prepared.eventId);
 expect(result.valid).toBe(true);
 expect(result.pending).toHaveLength(2);
 expect(result.pending.some(x=>x.manifestCommitment===result.current.commitment)).toBe(true);
 expect(result.replayRejected).toBe(true);
});


test('T-046 interrupted first append preserves encrypted journal across reload and recovers once',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const original=window.MedControlT046ManifestHead;
  window.MedControlT046ManifestHead=Object.freeze({...original,commitObjects:async()=>{throw Error('Injected shutdown before head commit');}});
  let rejected=false;
  try{await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,kind:'intake',body:{dose:1},encryptionKey,commitmentKey});}
  catch(e){rejected=/Injected shutdown/.test(e.message);}
  window.MedControlT046ManifestHead=original;
  const orphan=await window.MedControlT046Journal.encrypted({owner:vaultId,id:eventId});
  const head=await original.read(vaultId);
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {vaultId,eventId,rejected,orphanPresent:!!orphan,head,pending:pending.length,
   key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 expect(prepared.rejected).toBe(true);
 expect(prepared.orphanPresent).toBe(true);
 expect(prepared.head).toBeNull();
 expect(prepared.pending).toBe(0);
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async({vaultId,eventId,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const recovered=await api.recoverOrphanEvent({vaultId,eventId,commitmentKey});
  await api.recoverReplicaQueue({vaultId,commitmentKey});
  await api.recoverReplicaQueue({vaultId,commitmentKey});
  const head=await window.MedControlT046ManifestHead.read(vaultId);
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  const orphan=await window.MedControlT046Journal.encrypted({owner:vaultId,id:eventId});
  return {recovered,head,pending,orphanPresent:!!orphan};
 },prepared);
 expect(result.recovered.recovered).toBe(true);
 expect(result.recovered.replicaConfirmed).toBe(false);
 expect(result.head.generation).toBe(1);
 expect(result.pending).toHaveLength(1);
 expect(result.orphanPresent).toBe(true);
});
