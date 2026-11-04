'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 pending queue survives page restart and retry starts automatically',async({page})=>{
 const load=async()=>{
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  for(const name of ['replica-queue','replica-retry'])
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 };
 await load();
 const vaultId='vault_restart_'+Date.now();
 await page.evaluate(async vaultId=>{
  await window.MedControlT046ReplicaQueue.enqueue({
   vaultId,generation:1,manifestCommitment:'a'.repeat(64)
  });
 },vaultId);
 await load();
 const outcome=await page.evaluate(async vaultId=>{
  const queue=window.MedControlT046ReplicaQueue;
  let calls=0,seen=false;
  window.MedControlT046ReplicaDrain={drain:async()=>{
   calls++;
   seen=(await queue.pending()).some(j=>j.vaultId===vaultId);
   return {confirmed:0,failed:1,remaining:1};
  }};
  const controller=window.MedControlT046ReplicaRetry.create(async()=>{throw Error('offline');});
  controller.start();
  for(let i=0;i<100&&!calls;i++)await new Promise(r=>setTimeout(r,10));
  controller.dispose();
  return {calls,seen,pending:(await queue.pending()).some(j=>j.vaultId===vaultId)};
 },vaultId);
 expect(outcome).toEqual({calls:1,seen:true,pending:true});
});
