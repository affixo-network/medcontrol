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
