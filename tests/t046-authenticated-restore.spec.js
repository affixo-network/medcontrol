'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 authenticated damaged-segment restoration rejects forged copy',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','authenticated-atomic'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment,store=window.MedControlT046AuthenticatedAtomic;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
  const tag=await auth.sign(key,vaultId,'segment',segment.commitment);
  await store.commitAuthenticated(key,segment,manifest,0,tag,await auth.sign(key,vaultId,'manifest',manifest.commitment));
  const db=await new Promise((resolve,reject)=>{
   const open=indexedDB.open('t046-authenticated-atomic-v2',1);
   open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('segments','readwrite');
   tx.objectStore('segments').put({segment:{...segment,frames:[]},tag:'bad'},segment.commitment);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
  const damaged=await store.verifyPersisted(key);
  let forgedRejected=false;
  try{await store.restoreAuthenticatedSegment(key,segment,'0'.repeat(64));}catch{forgedRejected=true;}
  const stillDamaged=await store.verifyPersisted(key);
  const restored=await store.restoreAuthenticatedSegment(key,segment,tag);
  const verified=await store.verifyPersisted(key);
  return {damaged,forgedRejected,stillDamaged,restored,verified};
 });
 expect(result).toEqual({damaged:{valid:false,reason:'invalid-segment'},forgedRejected:true,stillDamaged:{valid:false,reason:'invalid-segment'},restored:true,verified:{valid:true,empty:false,generation:1}});
});
