'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 replica publishes only after segment and manifest readback',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const r=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,p=window.MedControlT046ReplicaProtocol;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const state={segments:new Map(),manifests:new Map(),head:null,order:[]};
  const adapter={
   async putSegment(id,value){state.order.push('segment');state.segments.set(id,value);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,value){state.order.push('manifest');state.manifests.set(id,value);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    state.order.push('head');
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;return true;
   },
   async getHead(){return state.head;}
  };
  const good=await p.publish(adapter,key,segment,manifest,st,mt,0);
  let replayRejected=false;
  try{await p.publish(adapter,key,segment,manifest,st,mt,0);}catch{replayRejected=true;}
  const bad={...adapter,async getSegment(){return null;}};
  let readbackRejected=false;
  try{await p.publish(bad,key,segment,manifest,st,mt,0);}catch{readbackRejected=true;}
  return {good,replayRejected,readbackRejected,order:state.order.slice(0,3),head:state.head.generation};
 });
 expect(r).toEqual({good:{replicaConfirmed:true,generation:1},replayRejected:true,readbackRejected:true,order:['segment','manifest','head'],head:1});
});
