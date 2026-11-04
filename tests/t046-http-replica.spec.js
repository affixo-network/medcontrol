'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 HTTPS replica adapter uses immutable transport and conditional head protocol',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-http-replica.js')});
 const result=await page.evaluate(async()=>{
  const calls=[],segments=new Map(),manifests=new Map();let head=null;
  const fetcher=async(url,options)=>{
   calls.push({url,method:options.method,authorization:options.headers.Authorization});
   const path=new URL(url).pathname;
   const body=options.body?JSON.parse(options.body):undefined;
   const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
   if(path==='/v1/head'&&options.method==='GET')return response(200,head);
   if(path==='/v1/head/compare-and-swap'){
    if((head?.generation||0)!==body.expectedGeneration||(head?.commitment||null)!==body.previousCommitment)return response(409,{error:'conflict'});
    head=body.next;return response(200,{committed:true});
   }
   const match=path.match(/^\/v1\/(segments|manifests)\/([a-f0-9]{64})$/);
   if(!match)return response(404,{});
   const store=match[1]==='segments'?segments:manifests,id=match[2];
   if(options.method==='GET')return response(store.has(id)?200:404,store.get(id));
   if(store.has(id)&&JSON.stringify(store.get(id))!==JSON.stringify(body))return response(409,{});
   store.set(id,body);return response(200,{ok:true});
  };
  const adapter=window.MedControlT046HttpReplica.create({baseUrl:'https://replica.example.test',authorization:async()=> 'test-token',fetcher});
  const id='a'.repeat(64),manifestId='b'.repeat(64);
  await adapter.putSegment(id,{ciphertext:'opaque'});
  await adapter.putManifest(manifestId,{manifest:'opaque'});
  const committed=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_test12345678',generation:1,commitment:manifestId});
  const stale=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_test12345678',generation:1,commitment:id});
  let rejected=false;
  try{await adapter.putSegment(id,{ciphertext:'tampered'});}catch{rejected=true;}
  return {committed,stale,rejected,head:await adapter.getHead(),segment:await adapter.getSegment(id),
   manifest:await adapter.getManifest(manifestId),calls};
 });
 expect(result.committed).toBe(true);
 expect(result.stale).toBe(false);
 expect(result.rejected).toBe(true);
 expect(result.head.commitment).toBe('b'.repeat(64));
 expect(result.segment.ciphertext).toBe('opaque');
 expect(result.manifest.manifest).toBe('opaque');
 expect(result.calls.every(x=>x.url.startsWith('https://replica.example.test/')&&x.authorization==='Bearer test-token')).toBe(true);
});
