'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 isolated segment and manifest: integrity, gap, predecessor',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-segment-codec.js')});
 const r=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec;
  const vaultId='vault_0123456789abcdef';
  const frame=n=>({sequence:n,eventId:'event_'+String(n).padStart(16,'0'),envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}});
  const s1=await c.buildSegment({vaultId,frames:[frame(1),frame(2)]});
  const s2=await c.buildSegment({vaultId,frames:[frame(3)]});
  const m1=await c.buildManifest({vaultId,generation:1,segments:[s1,s2]});
  const m2=await c.buildManifest({vaultId,generation:2,previousCommitment:m1.commitment,segments:[s1,s2]});
  const tampered=structuredClone(s1);tampered.frames[0].envelope.ciphertext='AAAAAAAAAAAA';
  let gapRejected=false;try{await c.buildManifest({vaultId,generation:1,segments:[s1,{...s2,firstSequence:4}]});}catch{gapRejected=true;}
  return {segment:await c.verifySegment(s1),tampered:await c.verifySegment(tampered),manifest:await c.verifyManifest(m1),successor:await c.verifyManifest(m2,m1),gapRejected};
 });
 expect(r).toEqual({segment:true,tampered:false,manifest:true,successor:true,gapRejected:true});
});


test('T-046 A01 batches 2050 contiguous encrypted frames into bounded authenticated segments',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:require('node:path').resolve(__dirname,'../js/modular3-t046-segment-codec.js')});
 const result=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec;
  const vaultId='vault_0123456789abcdef';
  const frames=Array.from({length:2050},(_,i)=>({sequence:i+1,eventId:'event_'+String(i+1).padStart(16,'0'),envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}));
  const segments=await codec.buildSegments({vaultId,frames});
  return {counts:segments.map(s=>s.eventCount),valid:await Promise.all(segments.map(s=>codec.verifySegment(s))),first:segments[0].firstSequence,last:segments.at(-1).lastSequence};
 });
 expect(result).toEqual({counts:[1024,1024,2],valid:[true,true,true],first:1,last:2050});
});
