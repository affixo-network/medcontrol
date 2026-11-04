'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 manifest head persists and rejects competing generations',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-manifest-head.js')});
 const result=await page.evaluate(async()=>{
  const h=window.MedControlT046ManifestHead;
  const vaultId='vault_head_'+crypto.randomUUID().replaceAll('-','');
  const first={vaultId,generation:1,previousCommitment:null,commitment:'a'.repeat(64)};
  const before=await h.read(vaultId);
  const one=await h.advance({vaultId,next:first});
  const contenders=[
   {vaultId,generation:2,previousCommitment:first.commitment,commitment:'b'.repeat(64)},
   {vaultId,generation:2,previousCommitment:first.commitment,commitment:'c'.repeat(64)}
  ];
  const outcomes=await Promise.allSettled(contenders.map(next=>h.advance({vaultId,expected:first,next})));
  const final=await h.read(vaultId);
  return {before,one,successes:outcomes.filter(x=>x.status==='fulfilled').length,
   conflicts:outcomes.filter(x=>x.status==='rejected'&&x.reason.message==='Manifest head conflict').length,
   final,validWinner:contenders.some(x=>x.commitment===final.commitment)};
 });
 expect(result.before).toBeNull();
 expect(result.one.advanced).toBe(true);
 expect(result.successes).toBe(1);
 expect(result.conflicts).toBe(1);
 expect(result.final.generation).toBe(2);
 expect(result.validWinner).toBe(true);
 await page.reload();
 const persisted=await page.evaluate(async(vaultId)=>{
  const r=indexedDB.open('t046-manifest-head-v1',1);
  const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction('heads','readonly'),q=tx.objectStore('heads').get(vaultId);
   q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
 },result.final.vaultId);
 expect(persisted).toEqual(result.final);
});
