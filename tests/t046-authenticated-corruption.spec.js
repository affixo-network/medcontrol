'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 detects modified encrypted segment after reload',async({page})=>{
 const load=async()=>{
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  for(const name of ['segment-codec','authenticated-commitment','authenticated-atomic'])
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 };
 await load();
 const r=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment,store=window.MedControlT046AuthenticatedAtomic;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
  await store.commitAuthenticated(key,segment,manifest,0,await auth.sign(key,vaultId,'segment',segment.commitment),await auth.sign(key,vaultId,'manifest',manifest.commitment));
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-authenticated-atomic-v2',1);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('segments','readwrite');
   const objectStore=tx.objectStore('segments');
   objectStore.get(segment.commitment).onsuccess=e=>{
    const value=e.target.result;
    value.segment.frames[0].envelope.ciphertext='AAAAAAAA';
    objectStore.put(value,segment.commitment);
   };
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
  return {key};
 });
 // Retain the non-extractable test key only across the page reload via a
 // separate IndexedDB key store. This is test scaffolding, not key management.
 await page.evaluate(async(key)=>{
  const open=indexedDB.open('t046-corruption-test-key',1);
  await new Promise((resolve,reject)=>{
   open.onupgradeneeded=()=>open.result.createObjectStore('keys');
   open.onsuccess=()=>resolve();open.onerror=()=>reject(open.error);
  });
  const db=open.result;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('keys','readwrite');
   tx.objectStore('keys').put(key,'key');
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
 },r.key);
 await load();
 const result=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-corruption-test-key',1);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const key=await new Promise((resolve,reject)=>{
   const req=db.transaction('keys','readonly').objectStore('keys').get('key');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  db.close();
  return window.MedControlT046AuthenticatedAtomic.verifyPersisted(key);
 });
 expect(result).toEqual({valid:false,reason:'invalid-segment'});
});
