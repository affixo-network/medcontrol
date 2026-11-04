'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 resumes persisted replica publication after browser restart',async({page})=>{
 const load=async()=>{
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  for(const name of ['segment-codec','authenticated-commitment','replica-protocol'])
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 };
 await load();
 await page.evaluate(async()=>{
  const c=window.MedControlT046SegmentCodec,a=window.MedControlT046AuthenticatedCommitment,p=window.MedControlT046ReplicaProtocol;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vaultId='vault_0123456789abcdef';
  const segment=await c.buildSegment({vaultId,frames:[{sequence:1,eventId:'event_0000000000000001',envelope:{v:1,alg:'AES-GCM',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AQIDBAUGBwgJCgsMDQ4PEA=='}}]});
  const manifest=await c.buildManifest({vaultId,generation:1,segments:[segment]});
  const st=await a.sign(key,vaultId,'segment',segment.commitment),mt=await a.sign(key,vaultId,'manifest',manifest.commitment);
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-replica-restart-test',1);
   req.onupgradeneeded=()=>{const d=req.result;d.createObjectStore('segments');d.createObjectStore('manifests');d.createObjectStore('head');d.createObjectStore('keys');};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const adapter={
   async putSegment(id,v){await put('segments',id,v);},
   async getSegment(id){return get('segments',id);},
   async putManifest(id,v){await put('manifests',id,v);},
   async getManifest(id){return get('manifests',id);},
   async compareAndSwapHead(expected,previous,next){
    const head=await get('head','current');
    if((head?.generation||0)!==expected||(head?.commitment||null)!==previous)return false;
    await put('head','current',next);return true;
   },
   async getHead(){return get('head','current');}
  };
  function get(store,id){return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function put(store,id,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  await put('keys','key',key);
  await put('keys','input',{segment,manifest,st,mt});
  await p.publish(adapter,key,segment,manifest,st,mt,0);
  db.close();
 });
 await load();
 const result=await page.evaluate(async()=>{
  const p=window.MedControlT046ReplicaProtocol;
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('t046-replica-restart-test',1);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  function get(store,id){return new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function put(store,id,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  const key=await get('keys','key'),{segment,manifest,st,mt}=await get('keys','input');
  let writes=0;
  const adapter={
   async putSegment(id,v){await put('segments',id,v);},
   async getSegment(id){return get('segments',id);},
   async putManifest(id,v){await put('manifests',id,v);},
   async getManifest(id){return get('manifests',id);},
   async compareAndSwapHead(expected,previous,next){writes++;return false;},
   async getHead(){return get('head','current');}
  };
  const confirmed=await p.resume(adapter,key,segment,manifest,st,mt,0);
  const head=await get('head','current');
  db.close();
  return {confirmed,writes,generation:head.generation};
 });
 expect(result).toEqual({confirmed:{replicaConfirmed:true,generation:1,alreadyPublished:true},writes:0,generation:1});
});
