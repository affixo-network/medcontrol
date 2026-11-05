'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('unified atomic store publishes a complete genesis and rejects duplicates',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_unified_'+crypto.randomUUID().replaceAll('-','');
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const envelope={v:1,alg:'AES-GCM',iv:btoa('123456789012'),ciphertext:btoa('opaque ciphertext')};
  const args={vaultId,frames:[{sequence:1,eventId:'event_unified_00000001',envelope}],entries:[{id:'event_unified_00000001',kind:'intake',tokens:[]}],commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const store=window.MedControlT046UnifiedStore;
  const committed=await store.commitBatch(args);
  let duplicateRejected=false;
  try{await store.commitBatch(args);}catch{duplicateRejected=true;}
  return {generation:(await store.readHead(vaultId)).generation,committed:committed.committed,duplicateRejected,event:(await store.readAt(vaultId,0)).id,jobs:(await store.replicaPage(vaultId)).jobs.length};
 });
 expect(result).toEqual({generation:1,committed:true,duplicateRejected:true,event:'event_unified_00000001',jobs:1});
});

test('unified encrypted append authenticates ciphertext and rolls back duplicate batch',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_unified_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  const args={vaultId,encryptionKey,commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const first=await store.appendEncryptedBatch({...args,entries:[{id:'event_unified_00000001',kind:'intake',body:{medicine:'private'},tokens:[]}]});
  let rejected=false;
  try{await store.appendEncryptedBatch({...args,expectedHead:first,entries:[{id:'event_unified_00000001',kind:'intake',body:{medicine:'duplicate'},tokens:[]}]});}catch{rejected=true;}
  const head=await store.readHead(vaultId),record=await store.readAt(vaultId,0),next=await store.readAt(vaultId,1);
  const authenticated=await store.readDecryptedAt({vaultId,position:0,encryptionKey});
  let wrongKeyRejected=false;
  const wrongKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  try{await store.readDecryptedAt({vaultId,position:0,encryptionKey:wrongKey});}catch{wrongKeyRejected=true;}
  const aad=new TextEncoder().encode(JSON.stringify([1,vaultId,record.id,record.kind]));
  const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.envelope.iv),additionalData:aad},encryptionKey,decode(record.envelope.ciphertext));
  return {rejected,generation:head.generation,next,body:JSON.parse(new TextDecoder().decode(plaintext)),authenticated:authenticated.body,wrongKeyRejected,jobs:(await store.replicaPage(vaultId)).jobs.length};
 });
 expect(result).toEqual({rejected:true,generation:1,next:null,body:{medicine:'private'},authenticated:{medicine:'private'},wrongKeyRejected:true,jobs:1});
});

test('unified vault rejects insufficient capacity before any durable mutation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_capacity_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  let calls=0,rejected=false;
  try{await store.appendEncryptedBatch({vaultId,encryptionKey,commitmentKey,
   entries:[{id:'event_capacity_00000001',kind:'intake',body:{medicine:'confidential'},tokens:[]}],
   capacityGateway:{reserve:async()=>{calls++;return {reserved:true};}},reservationBytes:1});}
  catch{rejected=true;}
  return {rejected,calls,head:await store.readHead(vaultId),event:await store.readAt(vaultId,0),jobs:(await store.replicaPage(vaultId)).jobs.length};
 });
 expect(result).toEqual({rejected:true,calls:0,head:null,event:null,jobs:0});
});

test('unified vault commits two generations with contiguous authenticated history',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_chain_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  const args={vaultId,encryptionKey,commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const first=await store.appendEncryptedBatch({...args,entries:[{id:'event_chain_00000001',kind:'intake',body:{step:1},tokens:[]}]});
  const second=await store.appendEncryptedBatch({...args,expectedHead:first,entries:[{id:'event_chain_00000002',kind:'intake',body:{step:2},tokens:[]}]});
  const one=await store.readDecryptedAt({vaultId,position:0,encryptionKey,commitmentKey});
  const two=await store.readDecryptedAt({vaultId,position:1,encryptionKey,commitmentKey});
  const jobs=await store.replicaPage(vaultId);
  const firstVerified=await store.verifyGeneration({vaultId,generation:1,commitmentKey});
  const secondVerified=await store.verifyGeneration({vaultId,generation:2,commitmentKey});
  const wrongKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const wrongKeyRejected=!await store.verifyGeneration({vaultId,generation:2,commitmentKey:wrongKey});
  let wrongReadRejected=false;
  try{await store.readDecryptedAt({vaultId,position:1,encryptionKey,commitmentKey:wrongKey});}catch{wrongReadRejected=true;}
  return {firstVerified,secondVerified,wrongKeyRejected,wrongReadRejected,generation:(await store.readHead(vaultId)).generation,first:first.generation,second:second.generation,
   one:one.body.step,two:two.body.step,jobs:jobs.jobs.map(x=>x.generation)};
 });
 expect(result).toEqual({firstVerified:true,secondVerified:true,wrongKeyRejected:true,wrongReadRejected:true,generation:2,first:1,second:2,one:1,two:2,jobs:[1,2]});
});

test('unified vault rejects stale concurrent writer without modifying committed history',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_race_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  const base={vaultId,encryptionKey,commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const first=await store.appendEncryptedBatch({...base,entries:[{id:'event_race_00000001',kind:'intake',body:{n:1},tokens:[]}]});
  const results=await Promise.allSettled([2,3].map(n=>store.appendEncryptedBatch({...base,expectedHead:first,
   entries:[{id:'event_race_0000000'+n,kind:'intake',body:{n},tokens:[]}]})));
  const head=await store.readHead(vaultId);
  const present=await store.readDecryptedAt({vaultId,position:1,encryptionKey});
  const jobs=await store.replicaPage(vaultId);
  return {fulfilled:results.filter(x=>x.status==='fulfilled').length,rejected:results.filter(x=>x.status==='rejected').length,
   generation:head.generation,position:present.body.n,jobs:jobs.jobs.length};
 });
 expect(result.fulfilled).toBe(1);
 expect(result.rejected).toBe(1);
 expect(result.generation).toBe(2);
 expect([2,3]).toContain(result.position);
 expect(result.jobs).toBe(2);
});

test('unified authenticated read fails closed when stored ciphertext is tampered',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_tamper_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  await store.appendEncryptedBatch({vaultId,encryptionKey,commitmentKey,
   entries:[{id:'event_tamper_00000001',kind:'intake',body:{n:1},tokens:[]}],
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  const before=await store.readDecryptedAt({vaultId,position:0,encryptionKey,commitmentKey});
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_unified_v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction('events','readwrite');
  const key=[vaultId,'event_tamper_00000001'];
  const original=await new Promise((resolve,reject)=>{const r=tx.objectStore('events').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  tx.objectStore('events').put({...original,envelope:{...original.envelope,ciphertext:btoa('tampered ciphertext')}},key);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});db.close();
  let rejected=false;
  try{await store.readDecryptedAt({vaultId,position:0,encryptionKey,commitmentKey});}catch{rejected=true;}
  return {before:before.body.n,rejected,generation:(await store.readHead(vaultId)).generation};
 });
 expect(result).toEqual({before:1,rejected:true,generation:1});
});

test('unified transaction aborts every store when event ID collides after CAS',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store'])await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_abort_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const store=window.MedControlT046UnifiedStore;
  const base={vaultId,encryptionKey,commitmentKey,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000};
  const first=await store.appendEncryptedBatch({...base,entries:[{id:'event_abort_00000001',kind:'intake',body:{n:1},tokens:[]}]});
  let rejected=false;
  try{await store.appendEncryptedBatch({...base,expectedHead:first,entries:[{id:'event_abort_00000001',kind:'intake',body:{n:999},tokens:[]}]});}
  catch{rejected=true;}
  const head=await store.readHead(vaultId);
  const preserved=await store.readDecryptedAt({vaultId,position:0,encryptionKey,commitmentKey});
  const phantom=await store.readAt(vaultId,1);
  const jobs=await store.replicaPage(vaultId);
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_unified_v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction(['manifests','segments'],'readonly');
  const get=(store,key)=>new Promise((resolve,reject)=>{const r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const phantomManifest=await get('manifests',[vaultId,2]);
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  return {rejected,generation:head.generation,preserved:preserved.body.n,phantom,phantomManifest:phantomManifest??null,jobs:jobs.jobs.length};
 });
 expect(result).toEqual({rejected:true,generation:1,preserved:1,phantom:null,phantomManifest:null,jobs:1});
});

test('versioned integrated vault commits encrypted medical history atomically and exposes pending replica work',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_interface_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vault=window.MedControlT046IntegratedVault.openUnifiedVault({
   vaultId,encryptionKey,commitmentKey,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000
  });
  const a=await vault.append([{id:'event_interface_00000001',kind:'course',body:{course:'A'},tokens:[]}]);
  const b=await vault.append([{id:'event_interface_00000002',kind:'correction',body:{corrects:'event_interface_00000001'},tokens:[]}]);
  const head=await vault.getHead();
  const first=await vault.getByPosition(0),second=await vault.getByPosition(1);
  const jobs=await vault.getReplicaIntentPage(0,10);
  const status=await vault.getProtectionStatus();
  const exported=await window.MedControlT046UnifiedStore.exportVerifiedGeneration({vaultId,generation:2,commitmentKey});
  return {a:a.protectionState,b:b.protectionState,generation:head.generation,
   first:first.body.course,correction:second.body.corrects,jobs:jobs.jobs.length,
   status:status.protectionState,replicaVerified:status.independentReplicaVerified,
   manifestGeneration:exported.manifest.object.generation,
   segmentCount:exported.segments.length,intentGeneration:exported.intent.generation};
 });
 expect(result).toEqual({a:'LOCAL_DURABLE',b:'LOCAL_DURABLE',generation:2,first:'A',
  correction:'event_interface_00000001',jobs:2,status:'LOCAL_DURABLE',
  replicaVerified:false,manifestGeneration:2,segmentCount:1,intentGeneration:2});
});

test('integrated dual archive verifies both independent readbacks and idempotent retry',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_dual_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vault=window.MedControlT046IntegratedVault.openUnifiedVault({
   vaultId,encryptionKey,commitmentKey,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000
  });
  await vault.append([{id:'event_dual_00000001',kind:'intake',body:{n:1},tokens:[]}]);
  const make=()=>{const segments=new Map(),manifests=new Map();let head=null;return {
   async putSegment(k,v){if(segments.has(k)&&JSON.stringify(segments.get(k))!==JSON.stringify(v))throw Error('immutable');segments.set(k,v);},
   async getSegment(k){return segments.get(k)||null;},
   async putManifest(k,v){if(manifests.has(k)&&JSON.stringify(manifests.get(k))!==JSON.stringify(v))throw Error('immutable');manifests.set(k,v);},
   async getManifest(k){return manifests.get(k)||null;},
   async getHead(){return head;},
   async compareAndSwapHead(g,p,n){if((head?.generation??0)!==g||(head?.commitment??null)!==p)return false;head=n;return true;}
  };};
  const primary=make(),recovery=make();
  const args={vaultId,generation:1,commitmentKey,primary,recovery};
  const a=await window.MedControlT046IntegratedVault.deliverUnifiedGeneration(args);
  const b=await window.MedControlT046IntegratedVault.deliverUnifiedGeneration(args);
  return {a:a.protectionState,b:b.protectionState,verified:a.independentReplicaVerified,primary:(await primary.getHead()).generation,
   recovery:(await recovery.getHead()).generation};
 });
 expect(result).toEqual({a:'SIMULATED_DUAL_READBACK',b:'SIMULATED_DUAL_READBACK',verified:false,primary:1,recovery:1});
});

test('bounded dual archive reconciliation restores authenticated generation from recovery when primary fails',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_recovery_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const vault=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  await vault.append([{id:'event_recovery_00000001',kind:'intake',body:{n:1},tokens:[]}]);
  await vault.append([{id:'event_recovery_00000002',kind:'correction',body:{n:2},tokens:[]}]);
  const make=()=>{const segments=new Map(),manifests=new Map();let head=null;return {
   async putSegment(k,v){segments.set(k,v);},async getSegment(k){return segments.get(k)||null;},
   async putManifest(k,v){manifests.set(k,v);},async getManifest(k){return manifests.get(k)||null;},
   async getHead(){return head;},async compareAndSwapHead(g,p,n){
    if((head?.generation??0)!==g||(head?.commitment??null)!==p)return false;head=n;return true;}
  };};
  const primary=make(),recovery=make();
  const first=await api.reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,maxGenerations:1});
  const second=await api.reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,
   afterGeneration:first.nextGeneration,maxGenerations:1});
  const broken={getHead:async()=>{throw Error('primary unavailable');},
   getManifest:primary.getManifest,getSegment:primary.getSegment};
  const restored=await api.retrieveUnifiedArchiveGeneration({vaultId,generation:2,commitmentKey,
   primary:broken,recovery});
  return {first:first.processed,second:second.processed,cursor:second.nextGeneration,
   source:restored.source,frames:restored.segments[0].segment.frames.length};
 });
 expect(result).toEqual({first:1,second:1,cursor:2,source:'recovery',frames:1});
});

test('integrated browser vault archives through PostgreSQL and disk adapters with authenticated fallback',async({page})=>{
 const {Pool}=require('pg');
 const fs=require('node:fs/promises'),os=require('node:os'),pathNode=require('node:path');
 const {createPostgresReplica}=require('./helpers/t046-postgres-replica.cjs');
 const {createDiskReplica}=require('./helpers/t046-disk-replica.cjs');
 const vaultId='vault_bridge_'+require('node:crypto').randomUUID().replaceAll('-','');
 const directory=await fs.mkdtemp(pathNode.join(os.tmpdir(),'t046-bridge-'));
 const pool=new Pool({connectionString:process.env.T046_POSTGRES_URL});
 const primary=createPostgresReplica(pool,vaultId),recovery=createDiskReplica(directory);
 const adapters={primary,recovery};
 try{
  await page.exposeFunction('t046ArchiveCall',async({domain,method,args})=>{
   if(!Object.prototype.hasOwnProperty.call(adapters,domain)||
      !['putSegment','getSegment','putManifest','getManifest','getHead','compareAndSwapHead'].includes(method))
    throw Error('Invalid archive bridge operation');
   return adapters[domain][method](...args);
  });
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
  const result=await page.evaluate(async vaultId=>{
   const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const api=window.MedControlT046IntegratedVault;
   const vault=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,
    capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
   await vault.append([{id:'event_bridge_00000001',kind:'course',body:{n:1},tokens:[]}]);
   await vault.append([{id:'event_bridge_00000002',kind:'correction',body:{n:2},tokens:[]}]);
   const adapter=domain=>Object.fromEntries(
    ['putSegment','getSegment','putManifest','getManifest','getHead','compareAndSwapHead']
    .map(method=>[method,(...args)=>window.t046ArchiveCall({domain,method,args})]));
   const primary=adapter('primary'),recovery=adapter('recovery');
   const drained=await api.reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,maxGenerations:4});
   const retried=await api.reconcileUnifiedArchive({vaultId,commitmentKey,primary,recovery,afterGeneration:drained.nextGeneration,maxGenerations:4});
   const unavailable={...primary,getHead:async()=>{throw Error('Primary outage');}};
   const restored=await api.retrieveUnifiedArchiveGeneration({vaultId,generation:2,commitmentKey,
    primary:unavailable,recovery});
   const second=await vault.getByPosition(1);
   return {processed:drained.processed,retried:retried.processed,
    cursor:drained.nextGeneration,source:restored.source,
    eventCount:restored.manifest.manifest.eventCount,
    correction:second.body.n,protection:drained.receipts[1].protectionState};
  },vaultId);
  expect(result).toEqual({processed:2,retried:0,cursor:2,source:'recovery',
   eventCount:1,correction:2,protection:'SIMULATED_DUAL_READBACK'});
  expect((await primary.getHead()).generation).toBe(2);
  expect((await recovery.getHead()).generation).toBe(2);
 }finally{await pool.end();await fs.rm(directory,{recursive:true,force:true});}
});

test('automatic archive resume rejects split brain and preserves local history',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_conflict_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const make=()=>{const segments=new Map(),manifests=new Map();let head=null;return {
   async putSegment(k,v){segments.set(k,v);},async getSegment(k){return segments.get(k)||null;},
   async putManifest(k,v){manifests.set(k,v);},async getManifest(k){return manifests.get(k)||null;},
   async getHead(){return head;},async compareAndSwapHead(g,p,n){
    if((head?.generation??0)!==g||(head?.commitment??null)!==p)return false;head=n;return true;},
   setHead(next){head=next;}
  };};
  const primary=make(),recovery=make();
  const vault=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,primary,recovery,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  await vault.append([{id:'event_conflict_00000001',kind:'intake',body:{n:1},tokens:[]}]);
  const first=await vault.sync();
  const second=await vault.sync();
  primary.setHead({vaultId,generation:1,commitment:'a'.repeat(64)});
  let rejected=false;
  try{await vault.sync();}catch(e){rejected=/split-brain/.test(e.message);}
  const local=await vault.getByPosition(0);
  const backup=await recovery.getHead();
  return {first:first.processed,second:second.processed,rejected,
   local:local.body.n,backupGeneration:backup.generation,
   backupCommitmentUnchanged:backup.commitment!=='a'.repeat(64)};
 });
 expect(result).toEqual({first:1,second:0,rejected:true,local:1,
  backupGeneration:1,backupCommitmentUnchanged:true});
});

test('one-generation archive lag is repaired only after authenticated ancestry proof',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_lag_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const make=()=>{const segments=new Map(),manifests=new Map();let head=null;return {
   async putSegment(k,v){segments.set(k,v);},async getSegment(k){return segments.get(k)||null;},
   async putManifest(k,v){manifests.set(k,v);},async getManifest(k){return manifests.get(k)||null;},
   async getHead(){return head;},async compareAndSwapHead(g,p,n){
    if((head?.generation??0)!==g||(head?.commitment??null)!==p)return false;head=n;return true;},
   corrupt(k){const v=manifests.get(k);manifests.set(k,{...v,tag:'tampered'});}
  };};
  const primary=make(),recovery=make();
  const vault=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,primary,recovery,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  await vault.append([{id:'event_lag_00000001',kind:'intake',body:{n:1},tokens:[]}]);
  await vault.sync();
  await vault.append([{id:'event_lag_00000002',kind:'correction',body:{n:2},tokens:[]}]);
  const advanced=await api.deliverUnifiedGeneration({vaultId,generation:2,commitmentKey,
   primary,recovery:{...recovery,compareAndSwapHead:async()=>{throw Error('Replica outage');}}})
   .then(()=>false,()=>true);
  const headBefore=await primary.getHead();
  const forged={...primary,getManifest:async id=>{
   const stored=await primary.getManifest(id);
   return {...stored,tag:'forged-authentication-tag'};
  }};
  const guarded=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,primary:forged,recovery,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  let rejected=false;
  try{await guarded.sync();}catch(error){rejected=/authentication failed/.test(error.message);}
  const untouched=(await recovery.getHead()).generation===1&&
   (await primary.getHead()).commitment===headBefore.commitment;
  const repaired=await vault.sync();
  const head=await primary.getHead();
  const after=await recovery.getHead();
  return {advanced,rejected,untouched,repaired:repaired.processed,primary:head.generation,recovery:after.generation};
 });
 expect(result).toEqual({advanced:true,rejected:true,untouched:true,repaired:1,primary:2,recovery:2});
});

test('multi-generation archive repair validates entire ancestry and rejects corrupted middle link',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const n of ['segment-codec','authenticated-commitment','unified-store','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+n+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_chain_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault;
  const make=()=>{const segments=new Map(),manifests=new Map();let head=null;return {
   async putSegment(k,v){segments.set(k,v);},async getSegment(k){return segments.get(k)||null;},
   async putManifest(k,v){manifests.set(k,v);},async getManifest(k){return manifests.get(k)||null;},
   async getHead(){return head;},async compareAndSwapHead(g,p,n){
    if((head?.generation??0)!==g||(head?.commitment??null)!==p)return false;head=n;return true;},
   corrupt(k){const v=manifests.get(k);manifests.set(k,{...v,tag:'forged'});},
   snapshot(){return head;}
  };};
  const primary=make(),recovery=make();
  const vault=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,primary,recovery,
   capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  await vault.append([{id:'event_chain_00000001',kind:'course',body:{n:1},tokens:[]}]);
  await vault.sync();
  for(let n=2;n<=4;n++){
   await vault.append([{id:'event_chain_0000000'+n,kind:'intake',body:{n},tokens:[]}]);
   await api.deliverUnifiedGeneration({vaultId,generation:n,commitmentKey,primary,
    recovery:{...recovery,compareAndSwapHead:async()=>{throw Error('offline');}}})
    .then(()=>{},()=>{});
  }
  const original=primary.snapshot(),behind=recovery.snapshot();
  const corrupted={...primary,getManifest:async commitment=>{
   const stored=await primary.getManifest(commitment);
   if(stored?.manifest?.generation===3)return {...stored,tag:'corrupted-middle-link'};
   return stored;
  }};
  const guarded=api.openUnifiedVault({vaultId,encryptionKey,commitmentKey,
   primary:corrupted,recovery,capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:1000000});
  let rejected=false;
  try{await guarded.sync();}catch(error){rejected=/authentication failed/.test(error.message);}
  const intact=(await recovery.getHead()).generation===1&&
   (await primary.getHead()).commitment===original.commitment;
  const repaired=await vault.sync();
  const recovered=recovery.snapshot();
  const missing=await vault.getByPosition(3);
  return {lag:original.generation-behind.generation,rejected,intact,processed:repaired.processed,
   recovery:recovered.generation,local:missing.body.n};
 });
 expect(result).toEqual({lag:3,rejected:true,intact:true,processed:3,recovery:4,local:4});
});
