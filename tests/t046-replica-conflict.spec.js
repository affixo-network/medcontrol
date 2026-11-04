'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 concurrent conflicting replica heads accept exactly one generation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','replica-protocol'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,p=window.MedControlT046ReplicaProtocol;
  const vaultId='vault_0123456789abcdef';
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const make=async(seq)=>{
   const segment=await c.buildSegment({vaultId,frames:[{sequence:seq,eventId:'event_'+String(seq).padStart(16,'0'),envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
   const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
   return {segment,manifest,st:await a.sign(key,vaultId,'segment',segment.commitment),mt:await a.sign(key,vaultId,'manifest',manifest.commitment)};
  };
  const first=await make(1),second=await make(2);
  const state={segments:new Map(),manifests:new Map(),head:null,writes:0};
  const adapter={
   async putSegment(id,value){state.segments.set(id,value);},
   async getSegment(id){return state.segments.get(id);},
   async putManifest(id,value){state.manifests.set(id,value);},
   async getManifest(id){return state.manifests.get(id);},
   async compareAndSwapHead(expected,previous,next){
    if((state.head?.generation||0)!==expected||(state.head?.commitment||null)!==previous)return false;
    state.head=next;state.writes++;return true;
   },
   async getHead(){return state.head;}
  };
  const attempts=await Promise.allSettled([first,second].map(x=>p.publish(adapter,key,x.segment,x.manifest,x.st,x.mt,0)));
  const winner=attempts.findIndex(x=>x.status==='fulfilled');
  const loser=1-winner;
  let staleRejected=false;
  try{const x=[first,second][loser];await p.resume(adapter,key,x.segment,x.manifest,x.st,x.mt,0);}catch{staleRejected=true;}
  return {statuses:attempts.map(x=>x.status),winner,staleRejected,writes:state.writes,head:state.head?.commitment,
   expected:[first,second][winner]?.manifest.commitment,
   storedManifest:state.manifests.get(1)?.manifest.commitment,
   storedSegment:state.segments.has([first,second][winner]?.segment.commitment),
   manifestValid:await c.verifyManifest(state.manifests.get(1)?.manifest),
   manifestAuthenticated:await a.verify(key,vaultId,'manifest',state.manifests.get(1)?.manifest.commitment,state.manifests.get(1)?.tag)};
 });
 expect(result.winner).toBeGreaterThanOrEqual(0);
 expect(result.statuses.sort()).toEqual(['fulfilled','rejected']);
 expect(result.staleRejected).toBe(true);
 expect(result.writes).toBe(1);
 expect(result.head).toBe(result.expected);
 expect(result.storedManifest).toBe(result.expected);
 expect(result.storedSegment).toBe(true);
 expect(result.manifestValid).toBe(true);
 expect(result.manifestAuthenticated).toBe(true);
});
