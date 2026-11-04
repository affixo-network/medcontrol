'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 interrupted replica stages never acknowledge protection',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,p=window.MedControlT046ReplicaProtocol;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment);
  const mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const stages=['putSegment','getSegment','putManifest','getManifest','compareAndSwapHead','getHead'];
  const results=[];
  for(const failure of stages){
   const state={segments:new Map(),manifests:new Map(),head:null};
   const fail=name=>{if(failure===name)throw Error('Simulated outage: '+name);};
   const adapter={
    async putSegment(id,v){fail('putSegment');state.segments.set(id,v);},
    async getSegment(id){fail('getSegment');return state.segments.get(id);},
    async putManifest(id,v){fail('putManifest');state.manifests.set(id,v);},
    async getManifest(id){fail('getManifest');return state.manifests.get(id);},
    async compareAndSwapHead(expected,previous,next){
     fail('compareAndSwapHead');
     if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
     state.head=next;return true;
    },
    async getHead(){fail('getHead');return state.head;}
   };
   let acknowledged=false;
   try{await p.publish(adapter,key,segment,manifest,st,mt,0);acknowledged=true;}catch{}
   results.push({failure,acknowledged,headGeneration:state.head?.generation||0});
  }
  return results;
 });
 expect(result).toEqual([
  {failure:'putSegment',acknowledged:false,headGeneration:0},
  {failure:'getSegment',acknowledged:false,headGeneration:0},
  {failure:'putManifest',acknowledged:false,headGeneration:0},
  {failure:'getManifest',acknowledged:false,headGeneration:0},
  {failure:'compareAndSwapHead',acknowledged:false,headGeneration:0},
  {failure:'getHead',acknowledged:false,headGeneration:1}
 ]);
});
