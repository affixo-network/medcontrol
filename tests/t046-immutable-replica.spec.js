'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 immutable adapter rejects conflicting content and preserves committed objects',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-immutable-replica.js')});
 const result=await page.evaluate(async()=>{
  const factory=window.MedControlT046ImmutableReplica;
  const db=await factory.open('t046-immutable-'+crypto.randomUUID());
  const adapter=factory.create(db),id='a'.repeat(64),manifestId='b'.repeat(64);
  const first={segment:{commitment:id},tag:'original'},changed={segment:{commitment:id},tag:'tampered'};
  await adapter.putSegment(id,first);
  const repeats=await Promise.allSettled([adapter.putSegment(id,first),adapter.putSegment(id,changed)]);
  await adapter.putManifest(manifestId,{manifest:{commitment:manifestId},tag:'original'});
  const manifestChange=await Promise.allSettled([adapter.putManifest(manifestId,{manifest:{commitment:manifestId},tag:'tampered'})]);
  const headSuccess=await adapter.compareAndSwapHead(0,null,{generation:1,commitment:manifestId});
  const stale=await adapter.compareAndSwapHead(0,null,{generation:1,commitment:id});
  const snapshot={repeats:repeats.map(x=>x.status),manifestChange:manifestChange[0].status,
   segment:await adapter.getSegment(id),manifest:await adapter.getManifest(manifestId),
   head:await adapter.getHead(),headSuccess,stale};
  db.close();return snapshot;
 });
 expect(result.repeats.sort()).toEqual(['fulfilled','rejected']);
 expect(result.manifestChange).toBe('rejected');
 expect(result.segment.tag).toBe('original');
 expect(result.manifest.tag).toBe('original');
 expect(result.headSuccess).toBe(true);
 expect(result.stale).toBe(false);
 expect(result.head.commitment).toBe('b'.repeat(64));
});
