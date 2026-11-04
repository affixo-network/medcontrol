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


test('T-046 recovery after interrupted second queue preserves linked third generation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const first=await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),
   kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const expectedHead=await window.MedControlT046ManifestHead.read(vaultId);
  const queue=window.MedControlT046ReplicaQueue;
  window.MedControlT046ReplicaQueue=Object.freeze({...queue,enqueue:async()=>{throw Error('Injected queue interruption');}});
  let interrupted=false;
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),
   kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead});}
  catch(e){interrupted=/Injected queue interruption/.test(e.message);}
  window.MedControlT046ReplicaQueue=queue;
  const secondHead=await window.MedControlT046ManifestHead.read(vaultId);
  return {vaultId,interrupted,firstCommitment:first.manifest.commitment,secondHead,
   encryption:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',encryptionKey))),
   commitment:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 expect(prepared.interrupted).toBe(true);
 expect(prepared.secondHead.generation).toBe(2);
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async setup=>{
  const encryptionKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.encryption),'AES-GCM',false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.commitment),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const recovery=await api.recoverReplicaQueue({vaultId:setup.vaultId,commitmentKey});
  const third=await api.appendNextAndStage({vaultId:setup.vaultId,
   eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:3},
   encryptionKey,commitmentKey,expectedHead:setup.secondHead});
  const head=window.MedControlT046ManifestHead;
  const final=await head.read(setup.vaultId);
  const second=await head.object(setup.vaultId,setup.secondHead.commitment);
  const thirdStored=await head.object(setup.vaultId,final.commitment);
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===setup.vaultId);
  return {recovery,third,final,second:second.object,thirdStored:thirdStored.object,
   pending,firstCommitment:setup.firstCommitment,
   validSecond:await window.MedControlT046SegmentCodec.verifyManifest(second.object),
   validThird:await window.MedControlT046SegmentCodec.verifyManifest(thirdStored.object)};
 },prepared);
 expect(result.recovery).toEqual({recovered:true,generation:2,replicaConfirmed:false});
 expect(result.final.generation).toBe(3);
 expect(result.second.previousCommitment).toBe(result.firstCommitment);
 expect(result.thirdStored.previousCommitment).toBe(prepared.secondHead.commitment);
 expect(result.thirdStored.committedThrough).toBe(3);
 expect(result.validSecond).toBe(true);
 expect(result.validThird).toBe(true);
 expect(result.third.replicaConfirmed).toBe(false);
 expect(result.pending).toHaveLength(3);
 expect(result.pending.map(x=>x.generation).sort()).toEqual([1,2,3]);
});


test('T-046 recovery rebuilds every missing generation queue entry from authenticated chain',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const prepared=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  let expectedHead=await window.MedControlT046ManifestHead.read(vaultId);
  const queue=window.MedControlT046ReplicaQueue;
  window.MedControlT046ReplicaQueue=Object.freeze({...queue,enqueue:async()=>{throw Error('Injected queue failure');}});
  for(let dose=2;dose<=3;dose++){
   try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose},encryptionKey,commitmentKey,expectedHead});}
   catch(e){if(!/Injected queue failure/.test(e.message))throw e;}
   expectedHead=await window.MedControlT046ManifestHead.read(vaultId);
  }
  window.MedControlT046ReplicaQueue=queue;
  const pending=(await queue.pending()).filter(x=>x.vaultId===vaultId);
  return {vaultId,head:expectedHead,pending:pending.length,key:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
 });
 expect(prepared.head.generation).toBe(3);
 expect(prepared.pending).toBe(1);
 await page.reload();
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async({vaultId,key})=>{
  const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const first=await window.MedControlT046IntegratedVault.recoverReplicaQueue({vaultId,commitmentKey});
  const second=await window.MedControlT046IntegratedVault.recoverReplicaQueue({vaultId,commitmentKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {first,second,pending};
 },prepared);
 expect(result.first.recovered).toBe(true);
 expect(result.second.recovered).toBe(true);
 expect(result.pending.map(x=>x.generation).sort()).toEqual([1,2,3]);
 expect(result.pending.every(x=>x.status==='pending')).toBe(true);
});


test('T-046 corrupted predecessor fails closed without staging newer replication jobs',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const predecessor=await window.MedControlT046ManifestHead.read(vaultId);
  const queue=window.MedControlT046ReplicaQueue;
  window.MedControlT046ReplicaQueue=Object.freeze({...queue,enqueue:async()=>{throw Error('Injected queue interruption');}});
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead:predecessor});}
  catch(e){if(!/Injected queue interruption/.test(e.message))throw e;}
  window.MedControlT046ReplicaQueue=queue;
  const head=window.MedControlT046ManifestHead;
  window.MedControlT046ManifestHead=Object.freeze({...head,object:async(vault,commitment)=>
   commitment===predecessor.commitment?null:head.object(vault,commitment)});
  let rejected=false;
  try{await api.recoverReplicaQueue({vaultId,commitmentKey});}catch(e){rejected=/predecessor|manifest/i.test(e.message);}
  window.MedControlT046ManifestHead=head;
  const pending=(await queue.pending()).filter(x=>x.vaultId===vaultId);
  const current=await head.read(vaultId);
  return {rejected,pending:pending.map(x=>x.generation),generation:current.generation};
 });
 expect(result.rejected).toBe(true);
 expect(result.generation).toBe(2);
 expect(result.pending).toEqual([1]);
});


test('T-046 altered authenticated predecessor blocks queue recovery without changing committed head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const scripts=['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'];
 for(const name of scripts)await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const predecessor=await window.MedControlT046ManifestHead.read(vaultId);
  const queue=window.MedControlT046ReplicaQueue;
  window.MedControlT046ReplicaQueue=Object.freeze({...queue,enqueue:async()=>{throw Error('Injected queue interruption');}});
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead:predecessor});}
  catch(e){if(!/Injected queue interruption/.test(e.message))throw e;}
  window.MedControlT046ReplicaQueue=queue;
  const head=window.MedControlT046ManifestHead;
  window.MedControlT046ManifestHead=Object.freeze({...head,object:async(vault,commitment)=>{
   const original=await head.object(vault,commitment);
   if(commitment!==predecessor.commitment||!original)return original;
   return {...original,object:{...original.object,committedThrough:999999}};
  }});
  let rejected=false;
  try{await api.recoverReplicaQueue({vaultId,commitmentKey});}
  catch(e){rejected=/authentication|manifest|commitment/i.test(e.message);}
  window.MedControlT046ManifestHead=head;
  const pending=(await queue.pending()).filter(x=>x.vaultId===vaultId);
  const current=await head.read(vaultId);
  return {rejected,pending:pending.map(x=>x.generation),generation:current.generation,commitment:current.commitment};
 });
 expect(result.rejected).toBe(true);
 expect(result.generation).toBe(2);
 expect(result.pending).toEqual([1]);
});


test('T-046 bounded recovery traverses long authenticated chain twice without retaining generation arrays',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const metrics=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const codec=window.MedControlT046SegmentCodec;
  const auth=window.MedControlT046AuthenticatedCommitment;
  const actualHead=window.MedControlT046ManifestHead;
  const actualQueue=window.MedControlT046ReplicaQueue;
  const objects=new Map(),jobs=new Map();
  const count=512;
  let previous=null;
  for(let generation=1;generation<=count;generation++){
   const segment=await codec.buildSegment({vaultId,frames:[{
    sequence:generation,eventId:'event_'+String(generation).padStart(16,'0'),
    envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}
   }]});
   const manifest=await codec.buildManifest({vaultId,generation,previousCommitment:previous?.commitment||null,segments:[segment]});
   objects.set(segment.commitment,{type:'segment',object:segment,tag:await auth.sign(key,vaultId,'segment',segment.commitment)});
   objects.set(manifest.commitment,{type:'manifest',object:manifest,tag:await auth.sign(key,vaultId,'manifest',manifest.commitment)});
   previous=manifest;
  }
  let reads=0;
  window.MedControlT046ManifestHead=Object.freeze({
   ...actualHead,
   read:async()=>({generation:count,commitment:previous.commitment}),
   object:async(_vault,commitment)=>{reads++;return objects.get(commitment)||null;}
  });
  window.MedControlT046ReplicaQueue=Object.freeze({
   ...actualQueue,
   enqueue:async job=>{jobs.set(job.generation,job.manifestCommitment);}
  });
  const start=performance.now();
  try{
   const result=await window.MedControlT046IntegratedVault.recoverReplicaQueue({vaultId,commitmentKey:key});
   return {result,count,jobs:jobs.size,first:jobs.has(1),last:jobs.has(count),reads,
    elapsedMs:Math.round(performance.now()-start)};
  }finally{
   window.MedControlT046ManifestHead=actualHead;
   window.MedControlT046ReplicaQueue=actualQueue;
  }
 });
 expect(metrics.result.recovered).toBe(true);
 expect(metrics.jobs).toBe(metrics.count);
 expect(metrics.first).toBe(true);
 expect(metrics.last).toBe(true);
 expect(metrics.reads).toBeLessThanOrEqual(metrics.count*5);
 console.log('T-046 recovery benchmark',JSON.stringify(metrics));
});
