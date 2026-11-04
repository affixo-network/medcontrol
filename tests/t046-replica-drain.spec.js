'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 drain retains offline job and confirms it on reconnect without replay',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol','replica-queue','replica-coordinator','replica-drain'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment;
  const q=window.MedControlT046ReplicaQueue,drain=window.MedControlT046ReplicaDrain;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const segmentTag=await a.sign(key,vaultId,'segment',segment.commitment),manifestTag=await a.sign(key,vaultId,'manifest',manifest.commitment);
  await q.enqueue({vaultId,generation:1,manifestCommitment:manifest.commitment});
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
  const offline=await drain.drain(async()=>{throw Error('offline');});
  const online=await drain.drain(async()=>({adapter,key,segment,manifest,segmentTag,manifestTag}));
  const repeated=await drain.drain(async()=>{throw Error('Should not resolve confirmed job');});
  return {offline,online,repeated,headWrites:state.headWrites};
 });
 expect(result).toEqual({
  offline:{confirmed:0,failed:1,remaining:1},
  online:{confirmed:1,failed:0,remaining:0},
  repeated:{confirmed:0,failed:0,remaining:0},
  headWrites:1
 });
});
