'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 authenticated atomic v2 abort preserves committed head and manifest',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['segment-codec','authenticated-commitment','authenticated-atomic']){
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 }
 const r=await page.evaluate(async()=>{
  const codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment,store=window.MedControlT046AuthenticatedAtomic;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await codec.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await codec.buildManifest({vaultId,generation:1,segments:[segment]});
  await store.commitAuthenticated(key,segment,manifest,0,await auth.sign(key,vaultId,'segment',segment.commitment),await auth.sign(key,vaultId,'manifest',manifest.commitment));
  const before=await store.inspect();
  const aborted=await new Promise((resolve,reject)=>{
   const open=indexedDB.open('t046-authenticated-atomic-v2',1);
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
    const db=open.result,tx=db.transaction(['segments','manifests','head'],'readwrite');
    tx.objectStore('segments').put({segment:{corrupt:true},tag:'invalid'},'uncommitted');
    tx.objectStore('manifests').put({manifest:{corrupt:true},tag:'invalid'},2);
    tx.objectStore('head').put({generation:2,commitment:'invalid',vaultId},'current');
    tx.abort();
    tx.onabort=()=>{db.close();resolve(true);};
    tx.oncomplete=()=>{db.close();resolve(false);};
   };
  });
  const after=await store.inspect();
  return {aborted,beforeGeneration:before.head.generation,afterGeneration:after.head.generation,
   unchangedHead:JSON.stringify(before.head)===JSON.stringify(after.head),
   unchangedManifest:JSON.stringify(before.manifest)===JSON.stringify(after.manifest)};
 });
 expect(r).toEqual({aborted:true,beforeGeneration:1,afterGeneration:1,unchangedHead:true,unchangedManifest:true});
});
