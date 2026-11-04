'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 isolated atomic commit, stale writer and reopen',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-segment-codec.js')});
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-atomic-prototype.js')});
 const result=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec,db=window.MedControlT046AtomicExperiment;
  const vaultId='vault_0123456789abcdef';
  const frame=n=>({sequence:n,eventId:'event_'+String(n).padStart(16,'0'),envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}});
  const s1=await codec.buildSegment({vaultId,frames:[frame(1)]});
  const m1=await codec.buildManifest({vaultId,generation:1,segments:[s1]});
  const first=await db.commit(s1,m1,0);
  const initial=await db.inspect();
  let staleRejected=false;
  try{await db.commit(s1,m1,0);}catch{staleRejected=true;}
  const s2=await codec.buildSegment({vaultId,frames:[frame(2)]});
  const m2=await codec.buildManifest({vaultId,generation:2,previousCommitment:m1.commitment,segments:[s1,s2]});
  const second=await db.commit(s2,m2,1);
  const final=await db.inspect();
  return {first,staleRejected,initialGeneration:initial.head?.generation,initialSegments:initial.segments.length,second,finalGeneration:final.head?.generation,finalSegments:final.segments.length,allPresent:final.segments.every(Boolean)};
 });
 expect(result).toEqual({first:true,staleRejected:true,initialGeneration:1,initialSegments:1,second:true,finalGeneration:2,finalSegments:2,allPresent:true});
});


test('T-046 competing writers: exactly one commit survives restart',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 const codecPath=path.resolve(__dirname,'../js/modular3-t046-segment-codec.js');
 const atomicPath=path.resolve(__dirname,'../js/modular3-t046-atomic-prototype.js');
 await page.addScriptTag({path:codecPath});
 await page.addScriptTag({path:atomicPath});
 const result=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec;
  const a=window.MedControlT046AtomicExperiment;
  const vaultId='vault_0123456789abcdef';
  const frame=n=>({sequence:n,eventId:'event_'+String(n).padStart(16,'0'),envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}});
  const s1=await c.buildSegment({vaultId,frames:[frame(1)]});
  const s2=await c.buildSegment({vaultId,frames:[frame(2)]});
  const m1=await c.buildManifest({vaultId,generation:1,segments:[s1]});
  const m2=await c.buildManifest({vaultId,generation:1,segments:[s2]});
  const outcomes=await Promise.allSettled([a.commit(s1,m1,0),a.commit(s2,m2,0)]);
  const before=await a.inspect();
  return {fulfilled:outcomes.filter(x=>x.status==='fulfilled').length,rejected:outcomes.filter(x=>x.status==='rejected').length,head:before.head,manifest:before.manifest,segments:before.segments};
 });
 expect(result.fulfilled).toBe(1);
 expect(result.rejected).toBe(1);
 expect(result.head.generation).toBe(1);
 expect(result.segments).toHaveLength(1);
 expect(result.segments[0].commitment).toBe(result.manifest.segments[0].commitment);
 await page.reload();
 await page.addScriptTag({path:codecPath});
 await page.addScriptTag({path:atomicPath});
 const recovered=await page.evaluate(()=>window.MedControlT046AtomicExperiment.inspect());
 expect(recovered.head).toEqual(result.head);
 expect(recovered.manifest).toEqual(result.manifest);
 expect(recovered.segments).toEqual(result.segments);
});
