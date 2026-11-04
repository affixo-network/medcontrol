'use strict';
const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('T-046 immutable replica survives full Chromium process restart',async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'t046-immutable-profile-'));
 const url='http://127.0.0.1:8765/t046-indexed-test.html';
 const script=path.resolve(__dirname,'../js/modular3-t046-immutable-replica.js');
 const database='t046-immutable-process-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const segmentId='e'.repeat(64),manifestId='f'.repeat(64);
 let context;
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true});
  let page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  const saved=await page.evaluate(async ({database,segmentId,manifestId})=>{
   const factory=window.MedControlT046ImmutableReplica,db=await factory.open(database),adapter=factory.create(db);
   await adapter.putSegment(segmentId,{segment:{commitment:segmentId},tag:'original-segment'});
   await adapter.putManifest(manifestId,{manifest:{commitment:manifestId},tag:'original-manifest'});
   const committed=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:manifestId});
   db.close();return committed;
  },{database,segmentId,manifestId});
  expect(saved).toBe(true);
  await context.close();context=null;
  context=await chromium.launchPersistentContext(profile,{headless:true});
  page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  const recovered=await page.evaluate(async ({database,segmentId,manifestId})=>{
   const factory=window.MedControlT046ImmutableReplica,db=await factory.open(database),adapter=factory.create(db);
   const before={segment:await adapter.getSegment(segmentId),manifest:await adapter.getManifest(manifestId),head:await adapter.getHead()};
   const attempts=await Promise.allSettled([
    adapter.putSegment(segmentId,{segment:{commitment:segmentId},tag:'forged'}),
    adapter.putManifest(manifestId,{manifest:{commitment:manifestId},tag:'forged'})
   ]);
   const stale=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:segmentId});
   const after={segment:await adapter.getSegment(segmentId),manifest:await adapter.getManifest(manifestId),head:await adapter.getHead()};
   db.close();return {before,after,attempts:attempts.map(x=>x.status),stale};
  },{database,segmentId,manifestId});
  expect(recovered.before.segment.tag).toBe('original-segment');
  expect(recovered.before.manifest.tag).toBe('original-manifest');
  expect(recovered.before.head.commitment).toBe(manifestId);
  expect(recovered.attempts).toEqual(['rejected','rejected']);
  expect(recovered.stale).toBe(false);
  expect(recovered.after).toEqual(recovered.before);
 }finally{
  if(context)await context.close();
  fs.rmSync(profile,{recursive:true,force:true});
 }
});
