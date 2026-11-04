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


test('T-046 replica queue cursor batch bounds returned jobs and preserves pending work',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-queue.js')});
 const result=await page.evaluate(async()=>{
  const q=window.MedControlT046ReplicaQueue;
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  for(let generation=1;generation<=12;generation++)
   await q.enqueue({vaultId,generation,manifestCommitment:generation.toString(16).padStart(64,'0')});
  const batch=await q.pendingBatch(3);
  const full=(await q.pending()).filter(job=>job.vaultId===vaultId);
  let rejected=false;
  try{await q.pendingBatch(1001);}catch{rejected=true;}
  return {batchCount:batch.length,fullCount:full.length,rejected,
   allPending:batch.every(job=>job.status==='pending')};
 });
 expect(result).toEqual({batchCount:3,fullCount:12,rejected:true,allPending:true});
});


test('T-046 paginated replica queue traverses all pending jobs without repeats',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-queue.js')});
 const result=await page.evaluate(async()=>{
  const q=window.MedControlT046ReplicaQueue;
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const expected=[];
  for(let generation=1;generation<=13;generation++){
   const job={vaultId,generation,manifestCommitment:generation.toString(16).padStart(64,'0')};
   await q.enqueue(job);
   expected.push(vaultId+':'+generation);
  }
  const seen=[];
  let afterId=null,pages=0,finished=false;
  do{
   const page=await q.pendingPage({afterId,limit:4});
   seen.push(...page.jobs.filter(job=>job.vaultId===vaultId).map(job=>job.id));
   pages++;
   afterId=page.nextAfterId;
   if(afterId===null){finished=true;break;}
  }while(pages<20);
  let invalidRejected=false;
  try{await q.pendingPage({limit:1001});}catch{invalidRejected=true;}
  return {seen,expected,pages,finished,invalidRejected};
 });
 expect(result.finished).toBe(true);
 expect(result.invalidRejected).toBe(true);
 expect(result.seen).toHaveLength(13);
 expect(new Set(result.seen).size).toBe(13);
 expect(result.seen.slice().sort()).toEqual(result.expected.slice().sort());
 expect(result.pages).toBeGreaterThanOrEqual(4);
});
