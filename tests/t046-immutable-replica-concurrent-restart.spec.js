'use strict';
const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('T-046 immutable replica concurrent tabs and restart preserve single committed head',async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'t046-immutable-concurrent-'));
 const url='http://127.0.0.1:8765/t046-indexed-test.html';
 const script=path.resolve(__dirname,'../js/modular3-t046-immutable-replica.js');
 const database='t046-immutable-concurrent-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const first='a'.repeat(64),second='b'.repeat(64);
 let context;
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true});
  const pages=[await context.newPage(),await context.newPage()];
  for(const page of pages){await page.goto(url);await page.addScriptTag({path:script});}
  const attempts=await Promise.all(pages.map((page,index)=>page.evaluate(async ({database,id})=>{
   const f=window.MedControlT046ImmutableReplica,db=await f.open(database),adapter=f.create(db);
   await adapter.putManifest(id,{manifest:{commitment:id},tag:'auth-'+id[0]});
   const won=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:id});
   const observed=await adapter.getHead();db.close();
   return {won,observed};
  },{database,id:index===0?first:second})));
  expect(attempts.filter(x=>x.won)).toHaveLength(1);
  const winner=attempts.find(x=>x.won).observed.commitment;
  await context.close();context=null;
  context=await chromium.launchPersistentContext(profile,{headless:true});
  const page=context.pages()[0]||await context.newPage();
  await page.goto(url);await page.addScriptTag({path:script});
  const recovered=await page.evaluate(async ({database,first,second})=>{
   const f=window.MedControlT046ImmutableReplica,db=await f.open(database),adapter=f.create(db);
   const head=await adapter.getHead(),manifest=await adapter.getManifest(head.commitment);
   const stale=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:head.commitment===first?second:first});
   const unchanged=await adapter.getHead();db.close();
   return {head,manifest,stale,unchanged};
  },{database,first,second});
  expect(recovered.head.commitment).toBe(winner);
  expect(recovered.manifest.manifest.commitment).toBe(winner);
  expect(recovered.stale).toBe(false);
  expect(recovered.unchanged).toEqual(recovered.head);
 }finally{
  if(context)await context.close();
  fs.rmSync(profile,{recursive:true,force:true});
 }
});
