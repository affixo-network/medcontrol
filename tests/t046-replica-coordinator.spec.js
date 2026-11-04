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
