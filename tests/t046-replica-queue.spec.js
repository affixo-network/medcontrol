'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 replica queue survives reload and retains unconfirmed work',async({page})=>{
 const load=async()=>{
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-queue.js')});
 };
 await load();
 const job={vaultId:'vault_0123456789abcdef',generation:1,manifestCommitment:'a'.repeat(64)};
 await page.evaluate(async j=>{await window.MedControlT046ReplicaQueue.enqueue(j);},job);
 await load();
 const result=await page.evaluate(async j=>{
  const q=window.MedControlT046ReplicaQueue;
  const before=await q.pending();
  let invalidRejected=false;
  try{await q.confirm(j,{replicaConfirmed:false,generation:1},async()=>false);}catch{invalidRejected=true;}
  const stillPending=await q.pending();
  await q.confirm(j,{replicaConfirmed:true,generation:1},async()=>true);
  return {before:before.length,invalidRejected,stillPending:stillPending.length,after:(await q.pending()).length};
 },job);
 expect(result).toEqual({before:1,invalidRejected:true,stillPending:1,after:0});
});
