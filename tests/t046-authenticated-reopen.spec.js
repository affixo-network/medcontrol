'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 verifies authenticated persisted records after reload',async({page})=>{
 const load=async()=>{
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  for(const name of ['segment-codec','authenticated-commitment','authenticated-atomic'])
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 };
 await load();
 await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,s=window.MedControlT046AuthenticatedAtomic;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  window.__testKey=key;
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  await s.commitAuthenticated(key,segment,manifest,0,await a.sign(key,vaultId,'segment',segment.commitment),await a.sign(key,vaultId,'manifest',manifest.commitment));
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-authenticated-key-test',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('keys');
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('keys','readwrite');
   tx.objectStore('keys').put(key,'key');
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
 });
 await load();
 const result=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-authenticated-key-test',1);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const key=await new Promise((resolve,reject)=>{
   const tx=db.transaction('keys','readonly');
   const req=tx.objectStore('keys').get('key');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  db.close();
  const s=window.MedControlT046AuthenticatedAtomic;
  const valid=await s.verifyPersisted(key);
  const other=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const invalid=await s.verifyPersisted(other);
  return {valid,invalid};
 });
 expect(result).toEqual({valid:{valid:true,empty:false,generation:1},invalid:{valid:false,reason:'invalid-manifest'}});
});
