'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('unified atomic store publishes a complete genesis and rejects duplicates',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_unified_'+crypto.randomUUID().replaceAll('-','');
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const envelope={v:1,alg:'AES-GCM',iv:btoa('123456789012'),ciphertext:btoa('opaque ciphertext')};
  const args={vaultId,frames:[{sequence:1,eventId:'event_unified_00000001',envelope}],entries:[{id:'event_unified_00000001',kind:'intake',tokens:[]}],commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const store=window.MedControlT046UnifiedStore;
  const committed=await store.commitBatch(args);
  let duplicateRejected=false;
  try{await store.commitBatch(args);}catch{duplicateRejected=true;}
  return {generation:(await store.readHead(vaultId)).generation,committed:committed.committed,duplicateRejected,event:(await store.readAt(vaultId,0)).id,jobs:(await store.replicaPage(vaultId)).jobs.length};
 });
 expect(result).toEqual({generation:1,committed:true,duplicateRejected:true,event:'event_unified_00000001',jobs:1});
});
