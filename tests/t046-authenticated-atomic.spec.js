'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 authenticated atomic v2 rejects invalid key and concurrent stale writer',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','authenticated-atomic']){
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 }
 const r=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment;
  const store=window.MedControlT046AuthenticatedAtomic;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const wrong=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await auth.sign(key,vaultId,'segment',segment.commitment);
  const mt=await auth.sign(key,vaultId,'manifest',manifest.commitment);
  let invalidRejected=false;
  try{await store.commitAuthenticated(wrong,segment,manifest,0,st,mt);}catch{invalidRejected=true;}
  const empty=(await store.inspect()).head===null;
  const results=await Promise.allSettled([
   store.commitAuthenticated(key,segment,manifest,0,st,mt),
   store.commitAuthenticated(key,segment,manifest,0,st,mt)
  ]);
  const persisted=await store.inspect();
  return {invalidRejected,empty,successes:results.filter(x=>x.status==='fulfilled').length,
   failures:results.filter(x=>x.status==='rejected').length,
   generation:persisted.head?.generation,manifestMatches:persisted.manifest?.manifest?.commitment===manifest.commitment,
   unauthenticatedWriteExposed:typeof store.commit==='function'};
 });
 expect(r).toEqual({invalidRejected:true,empty:true,successes:1,failures:1,generation:1,manifestMatches:true,unauthenticatedWriteExposed:false});
});
