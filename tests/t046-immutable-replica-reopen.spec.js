'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 immutable replica survives database reopen without allowing replacement',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-immutable-replica.js')});
 const result=await page.evaluate(async()=>{
  const factory=window.MedControlT046ImmutableReplica;
  const name='t046-immutable-reopen-'+crypto.randomUUID(),segmentId='c'.repeat(64),manifestId='d'.repeat(64);
  const originalSegment={segment:{commitment:segmentId},tag:'authenticated-segment'};
  const originalManifest={manifest:{commitment:manifestId},tag:'authenticated-manifest'};
  let db=await factory.open(name),adapter=factory.create(db);
  await adapter.putSegment(segmentId,originalSegment);
  await adapter.putManifest(manifestId,originalManifest);
  const committed=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:manifestId});
  db.close();
  db=await factory.open(name);adapter=factory.create(db);
  const recovered={segment:await adapter.getSegment(segmentId),manifest:await adapter.getManifest(manifestId),head:await adapter.getHead()};
  const attempts=await Promise.allSettled([
   adapter.putSegment(segmentId,{segment:{commitment:segmentId},tag:'forged'}),
   adapter.putManifest(manifestId,{manifest:{commitment:manifestId},tag:'forged'})
  ]);
  const idempotent=await Promise.allSettled([
   adapter.putSegment(segmentId,originalSegment),
   adapter.putManifest(manifestId,originalManifest)
  ]);
  const stale=await adapter.compareAndSwapHead(0,null,{vaultId:'vault_0123456789abcdef',generation:1,commitment:segmentId});
  const unchanged={segment:await adapter.getSegment(segmentId),manifest:await adapter.getManifest(manifestId),head:await adapter.getHead()};
  db.close();
  return {committed,recovered,attempts:attempts.map(x=>x.status),idempotent:idempotent.map(x=>x.status),stale,unchanged};
 });
 expect(result.committed).toBe(true);
 expect(result.recovered.segment.tag).toBe('authenticated-segment');
 expect(result.recovered.manifest.tag).toBe('authenticated-manifest');
 expect(result.recovered.head.commitment).toBe('d'.repeat(64));
 expect(result.attempts).toEqual(['rejected','rejected']);
 expect(result.idempotent).toEqual(['fulfilled','fulfilled']);
 expect(result.stale).toBe(false);
 expect(result.unchanged).toEqual(result.recovered);
});
