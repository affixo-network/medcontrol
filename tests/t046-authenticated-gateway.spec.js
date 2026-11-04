'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 authenticated gateway rejects invalid tags before commit',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','atomic-prototype','authenticated-commitment','authenticated-gateway']){
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 }
 const r=await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec;
  const a=window.MedControlT046AuthenticatedCommitment;
  const g=window.MedControlT046AuthenticatedGateway;
  const store=window.MedControlT046AtomicExperiment;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const other=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment);
  const mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  let rejected=false;
  try{await g.commitAuthenticated(other,segment,manifest,0,st,mt);}catch{rejected=true;}
  const before=await store.inspect();
  const committed=await g.commitAuthenticated(key,segment,manifest,0,st,mt);
  const after=await store.verifyState();
  return {rejected,emptyBefore:before.head===null,committed,after};
 });
 expect(r).toEqual({rejected:true,emptyBefore:true,committed:true,after:{valid:true,empty:false,generation:1}});
});
