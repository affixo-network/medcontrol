'use strict';
const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('T-046 persisted queue resumes processing after full Chromium process restart',async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'t046-profile-'));
 const vaultId='vault_process_restart_'+Date.now();
 const url='http://127.0.0.1:8765/t046-indexed-test.html';
 const script=path.resolve(__dirname,'../js/modular3-t046-replica-queue.js');
 let context;
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true});
  let page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  await page.evaluate(async vaultId=>{
   await window.MedControlT046ReplicaQueue.enqueue({
    vaultId,generation:1,manifestCommitment:'b'.repeat(64)
   });
  },vaultId);
  expect(await page.evaluate(async vaultId=>(await window.MedControlT046ReplicaQueue.pending()).some(j=>j.vaultId===vaultId),vaultId)).toBe(true);
  await context.close();context=null;
  context=await chromium.launchPersistentContext(profile,{headless:true});
  page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-retry.js')});
  const result=await page.evaluate(async vaultId=>{
   const queue=window.MedControlT046ReplicaQueue;
   let attempts=0,observed=false;
   window.MedControlT046ReplicaDrain={drain:async()=>{
    attempts++;
    observed=(await queue.pending()).some(j=>j.vaultId===vaultId);
    return {confirmed:0,failed:1,remaining:1};
   }};
   const retry=window.MedControlT046ReplicaRetry.create(async()=>{throw Error('replica unavailable');});
   retry.start();
   for(let i=0;i<100&&!attempts;i++)await new Promise(resolve=>setTimeout(resolve,10));
   retry.dispose();
   const jobs=await queue.pending();
   return {jobs:jobs.filter(j=>j.vaultId===vaultId).map(j=>({generation:j.generation,status:j.status})),attempts,observed};
  },vaultId);
  expect(result).toEqual({jobs:[{generation:1,status:'pending'}],attempts:1,observed:true});
 }finally{
  if(context)await context.close();
  fs.rmSync(profile,{recursive:true,force:true});
 }
});
