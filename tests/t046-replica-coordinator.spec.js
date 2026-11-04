'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 queue confirms only after verified replica publication',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol','replica-queue','replica-coordinator'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment;
  const q=window.MedControlT046ReplicaQueue,coordinator=window.MedControlT046ReplicaCoordinator;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const job={vaultId,generation:1,manifestCommitment:manifest.commitment};
  await q.enqueue(job);
  const state={segments:new Map(),manifests:new Map(),head:null,fail:true};
  const adapter={
   async putSegment(id,v){state.segments.set(id,v);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,v){state.manifests.set(id,v);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    if(state.fail)throw Error('offline');
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;return true;
   },
   async getHead(){return state.head;}
  };
  let rejected=false;
  try{await coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0);}catch{rejected=true;}
  const pendingAfterFailure=(await q.pending()).length;
  state.fail=false;
  const success=await coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0);
  const pendingAfterSuccess=(await q.pending()).length;
  return {rejected,pendingAfterFailure,success,pendingAfterSuccess};
 });
 expect(result).toEqual({rejected:true,pendingAfterFailure:1,success:{replicaConfirmed:true,generation:1},pendingAfterSuccess:0});
});


test('T-046 coordinator uses keyed lookup and rejects absent jobs without scanning queue',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['replica-protocol','replica-queue','replica-coordinator'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const q=window.MedControlT046ReplicaQueue;
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  for(let generation=1;generation<=215;generation++)
   await q.enqueue({vaultId,generation,manifestCommitment:generation.toString(16).padStart(64,'0')});
  let keyedReads=0,fullReads=0,pageReads=0;
  window.MedControlT046ReplicaQueue={
   pending:async()=>{fullReads++;throw Error('Full queue read forbidden');},
   pendingPage:async()=>{pageReads++;throw Error('Queue scan forbidden');},
   pendingJob:async job=>{keyedReads++;return q.pendingJob(job);}
  };
  const missing={vaultId,generation:216,manifestCommitment:'f'.repeat(64)};
  let error='';
  try{
   await window.MedControlT046ReplicaCoordinator.replicate(
    missing,{},null,{vaultId},{vaultId,generation:216,commitment:missing.manifestCommitment},null,null,215
   );
  }catch(e){error=e.message;}
  window.MedControlT046ReplicaQueue=q;
  return {keyedReads,pageReads,fullReads,error};
 });
 expect(result.fullReads).toBe(0);
 expect(result.keyedReads).toBe(1);
 expect(result.pageReads).toBe(0);
 expect(result.error).toBe('No pending replication job');
});


test('T-046 verified replica is not replayed after confirmation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol','replica-queue','replica-coordinator'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment;
  const q=window.MedControlT046ReplicaQueue,coordinator=window.MedControlT046ReplicaCoordinator;
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const job={vaultId,generation:1,manifestCommitment:manifest.commitment};
  await q.enqueue(job);
  const state={segments:new Map(),manifests:new Map(),head:null,headWrites:0};
  const adapter={
   async putSegment(id,v){state.segments.set(id,v);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,v){state.manifests.set(id,v);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;state.headWrites++;return true;
   },
   async getHead(){return state.head;}
  };
  const first=await coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0);
  let replayError='';
  try{await coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0);}
  catch(e){replayError=e.message;}
  const pending=await q.pendingJob(job);
  return {first,replayError,headWrites:state.headWrites,pending:pending!==null};
 });
 expect(result).toEqual({
  first:{replicaConfirmed:true,generation:1},
  replayError:'No pending replication job',
  headWrites:1,
  pending:false
 });
});


test('T-046 concurrent replica workers publish only one durable head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol','replica-queue','replica-coordinator'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment;
  const q=window.MedControlT046ReplicaQueue,coordinator=window.MedControlT046ReplicaCoordinator;
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const job={vaultId,generation:1,manifestCommitment:manifest.commitment};
  await q.enqueue(job);
  const state={segments:new Map(),manifests:new Map(),head:null,headWrites:0};
  const adapter={
   async putSegment(id,v){state.segments.set(id,v);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,v){state.manifests.set(id,v);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;state.headWrites++;return true;
   },
   async getHead(){return state.head;}
  };
  const results=await Promise.allSettled([
   coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0),
   coordinator.replicate(job,adapter,key,segment,manifest,st,mt,0)
  ]);
  return {headWrites:state.headWrites,head:state.head,results:results.map(x=>x.status),pending:await q.pendingJob(job)};
 });
 expect(result.headWrites).toBe(1);
 expect(result.head.generation).toBe(1);
 expect(result.head.vaultId).toMatch(/^vault_/);
 expect(result.pending).toBeNull();
 expect(result.results.every(x=>x==='fulfilled'||x==='rejected')).toBe(true);
});


test('T-046 two browser tabs cannot overwrite a queued generation with conflicting commitment',async({context})=>{
 const pages=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const page of pages){
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-queue.js')});
  }
  const vaultId='vault_'+require('node:crypto').randomUUID().replaceAll('-','');
  const jobs=[
   {vaultId,generation:1,manifestCommitment:'a'.repeat(64)},
   {vaultId,generation:1,manifestCommitment:'b'.repeat(64)}
  ];
  const attempts=await Promise.allSettled(pages.map((page,i)=>page.evaluate(job=>
   window.MedControlT046ReplicaQueue.enqueue(job),jobs[i])));
  const stored=await Promise.all(pages.map(page=>page.evaluate(job=>
   window.MedControlT046ReplicaQueue.pendingJob(job),jobs[0])));
  const other=await pages[1].evaluate(job=>
   window.MedControlT046ReplicaQueue.pendingJob(job),jobs[1]);
  expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(attempts.filter(x=>x.status==='rejected')).toHaveLength(1);
  expect(stored[0]!==null||other!==null).toBe(true);
  expect(stored[0]!==null&&other!==null).toBe(false);
  expect(stored[0]).toEqual(stored[1]);
 }finally{await Promise.all(pages.map(p=>p.close()));}
});


test('T-046 two tabs concurrently confirm the same authenticated replica without queue corruption',async({context})=>{
 const pages=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const page of pages){
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   for(const name of ['segment-codec','authenticated-commitment','replica-queue'])
    await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
  }
  const fixture=await pages[0].evaluate(async()=>{
   const codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment;
   const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
   const raw=crypto.getRandomValues(new Uint8Array(32));
   const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
   const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
   const segmentTag=await auth.sign(key,vaultId,'segment',segment.commitment);
   const manifestTag=await auth.sign(key,vaultId,'manifest',manifest.commitment);
   const job={vaultId,generation:1,manifestCommitment:manifest.commitment};
   await window.MedControlT046ReplicaQueue.enqueue(job);
   return {raw:Array.from(raw),job,segment,manifest,segmentTag,manifestTag};
  });
  const attempts=await Promise.allSettled(pages.map(page=>page.evaluate(async data=>{
   const key=await crypto.subtle.importKey('raw',new Uint8Array(data.raw),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const adapter={
    async getHead(){return {vaultId:data.job.vaultId,generation:1,commitment:data.manifest.commitment};},
    async getSegment(){return {segment:data.segment,tag:data.segmentTag};},
    async getManifest(){return {manifest:data.manifest,tag:data.manifestTag};}
   };
   return window.MedControlT046ReplicaQueue.confirmVerified(data.job,adapter,key,data.segment,data.manifest,data.segmentTag,data.manifestTag);
  },fixture)));
  expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(2);
  const states=await Promise.all(pages.map(page=>page.evaluate(job=>
   window.MedControlT046ReplicaQueue.pendingJob(job),fixture.job)));
  expect(states).toEqual([null,null]);
 }finally{await Promise.all(pages.map(p=>p.close()));}
});


test('T-046 closing one tab mid-confirmation leaves durable pending job for survivor',async({context})=>{
 const [closing,survivor]=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const page of [closing,survivor]){
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   for(const name of ['segment-codec','authenticated-commitment','replica-queue'])
    await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
  }
  const fixture=await survivor.evaluate(async()=>{
   const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment;
   const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
   const raw=crypto.getRandomValues(new Uint8Array(32));
   const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
   const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
   const segmentTag=await a.sign(key,vaultId,'segment',segment.commitment);
   const manifestTag=await a.sign(key,vaultId,'manifest',manifest.commitment);
   const job={vaultId,generation:1,manifestCommitment:manifest.commitment};
   await window.MedControlT046ReplicaQueue.enqueue(job);
   return {raw:Array.from(raw),job,segment,manifest,segmentTag,manifestTag};
  });
  await closing.evaluate(data=>{
   window.__confirmationPaused=false;
   const keyPromise=crypto.subtle.importKey('raw',new Uint8Array(data.raw),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const adapter={
    async getHead(){window.__confirmationPaused=true;return new Promise(()=>{});},
    async getSegment(){throw Error('Should not reach readback');},
    async getManifest(){throw Error('Should not reach readback');}
   };
   keyPromise.then(key=>window.MedControlT046ReplicaQueue.confirmVerified(
    data.job,adapter,key,data.segment,data.manifest,data.segmentTag,data.manifestTag
   )).catch(()=>{});
  },fixture);
  await expect.poll(()=>closing.evaluate(()=>window.__confirmationPaused)).toBe(true);
  await closing.close();
  const before=await survivor.evaluate(job=>window.MedControlT046ReplicaQueue.pendingJob(job),fixture.job);
  expect(before).not.toBeNull();
  const confirmed=await survivor.evaluate(async data=>{
   const key=await crypto.subtle.importKey('raw',new Uint8Array(data.raw),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const adapter={
    async getHead(){return {vaultId:data.job.vaultId,generation:1,commitment:data.manifest.commitment};},
    async getSegment(){return {segment:data.segment,tag:data.segmentTag};},
    async getManifest(){return {manifest:data.manifest,tag:data.manifestTag};}
   };
   await window.MedControlT046ReplicaQueue.confirmVerified(
    data.job,adapter,key,data.segment,data.manifest,data.segmentTag,data.manifestTag
   );
   return window.MedControlT046ReplicaQueue.pendingJob(data.job);
  },fixture);
  expect(confirmed).toBeNull();
 }finally{await context.close();}
});
