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
  const directConfirmExposed=typeof q.confirm==='function';
  let forgedRejected=false;
  try{await q.confirmVerified(j,{},null,null,null,null,null);}catch{forgedRejected=true;}
  const stillPending=await q.pending();
  return {before:before.length,directConfirmExposed,forgedRejected,stillPending:stillPending.length};
 },job);
 expect(result).toEqual({before:1,directConfirmExposed:false,forgedRejected:true,stillPending:1});
});
