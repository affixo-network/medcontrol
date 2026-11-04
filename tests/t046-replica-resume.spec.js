'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 retry reconciles lost acknowledgement without duplicating head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,p=window.MedControlT046ReplicaProtocol;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const state={segments:new Map(),manifests:new Map(),head:null,writes:0,failOnce:true};
  const adapter={
   async putSegment(id,value){state.segments.set(id,value);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,value){state.manifests.set(id,value);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;state.writes++;return true;
   },
   async getHead(){if(state.failOnce){state.failOnce=false;throw Error('lost acknowledgement');}return state.head;}
  };
  let firstRejected=false;
  try{await p.publish(adapter,key,segment,manifest,st,mt,0);}catch{firstRejected=true;}
  const recovered=await p.resume(adapter,key,segment,manifest,st,mt,0);
  const repeated=await p.resume(adapter,key,segment,manifest,st,mt,0);
  return {firstRejected,recovered,repeated,writes:state.writes,generation:state.head.generation};
 });
 expect(result).toEqual({firstRejected:true,recovered:{replicaConfirmed:true,generation:1,alreadyPublished:true},repeated:{replicaConfirmed:true,generation:1,alreadyPublished:true},writes:1,generation:1});
});
