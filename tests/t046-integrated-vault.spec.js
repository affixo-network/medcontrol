'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 integrated disposable vault commits real ciphertext and stages authenticated replica',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_integrated_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const body={medication:'test medicine',dose:'1 tablet',time:'2030-01-01T10:00:00Z'};
  const result=await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,kind:'intake',body,encryptionKey,commitmentKey});
  const journal=window.MedControlT046Journal,codec=window.MedControlT046SegmentCodec,auth=window.MedControlT046AuthenticatedCommitment;
  const record=await journal.get({owner:vaultId,id:eventId,key:encryptionKey});
  const pending=(await window.MedControlT046ReplicaQueue.pending()).find(x=>x.vaultId===vaultId);
  return {localCommitted:result.localCommitted,replicaConfirmed:result.replicaConfirmed,
   body:record.body,ciphertext:result.segment.frames[0].envelope.ciphertext,
   segmentValid:await codec.verifySegment(result.segment),manifestValid:await codec.verifyManifest(result.manifest),
   segmentAuthenticated:await auth.verify(commitmentKey,vaultId,'segment',result.segment.commitment,result.segmentTag),
   manifestAuthenticated:await auth.verify(commitmentKey,vaultId,'manifest',result.manifest.commitment,result.manifestTag),
   queued:pending?.manifestCommitment===result.manifest.commitment,
   durableHead:(await window.MedControlT046ManifestHead.read(vaultId))?.commitment===result.manifest.commitment,
   durableSegment:(await window.MedControlT046ManifestHead.object(vaultId,result.segment.commitment))?.type==='segment'};
 });
 expect(result.localCommitted).toBe(true);
 expect(result.replicaConfirmed).toBe(false);
 expect(result.body).toEqual({medication:'test medicine',dose:'1 tablet',time:'2030-01-01T10:00:00Z'});
 expect(result.ciphertext).not.toContain('test medicine');
 expect(result.segmentValid).toBe(true);
 expect(result.manifestValid).toBe(true);
 expect(result.segmentAuthenticated).toBe(true);
 expect(result.manifestAuthenticated).toBe(true);
 expect(result.queued).toBe(true);
 expect(result.durableHead).toBe(true);
 expect(result.durableSegment).toBe(true);
});

test('T-046 integrated vault rejects unreserved writes before journal mutation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_capacity_'+crypto.randomUUID().replaceAll('-','');
  const eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  let failed=false;
  try{await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,kind:'intake',body:{dose:'1'},encryptionKey,commitmentKey,capacityGateway:{reserve:async()=>({reserved:false})},reservationBytes:1024});}
  catch(error){failed=error.message==='Capacity reservation not committed';}
  const record=await window.MedControlT046Journal.encrypted({owner:vaultId,id:eventId});
  return {failed,untouched:record==null};
 });
 expect(result).toEqual({failed:true,untouched:true});
});

test('T-046 reserved encrypted write is queued for replication',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_reserved_'+crypto.randomUUID().replaceAll('-',''),eventId='event_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  let reservation=null;
  const committed=await window.MedControlT046IntegratedVault.appendAndStage({
   vaultId,eventId,kind:'intake',body:{dose:'1 tablet'},encryptionKey,commitmentKey,reservationBytes:4096,
   capacityGateway:{reserve:async(id,bytes)=>{reservation={id,bytes};return {reserved:true};}}
  });
  const saved=await window.MedControlT046Journal.get({owner:vaultId,id:eventId,key:encryptionKey});
  const queued=(await window.MedControlT046ReplicaQueue.pending()).some(x=>x.vaultId===vaultId&&x.manifestCommitment===committed.manifest.commitment);
  return {reservation,committed:committed.localCommitted,replicaConfirmed:committed.replicaConfirmed,body:saved.body,queued};
 });
 expect(result.reservation.bytes).toBe(4096);
 expect(result.committed).toBe(true);
 expect(result.replicaConfirmed).toBe(false);
 expect(result.body).toEqual({dose:'1 tablet'});
 expect(result.queued).toBe(true);
});

test('T-046 unsupported second sequence fails before journal mutation',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_sequence_'+crypto.randomUUID().replaceAll('-',''),eventId='event_'+crypto.randomUUID().replaceAll('-','');
  let rejected=false;
  try{await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,sequence:2});}
  catch(e){rejected=e.message==='Integrated vault prerequisites missing'||e.message==='Multi-event manifest chain not implemented';}
  const stored=await window.MedControlT046Journal.encrypted({owner:vaultId,id:eventId});
  return {rejected,untouched:stored==null};
 });
 expect(result).toEqual({rejected:true,untouched:true});
});


test('T-046 unified vault append links encrypted writes, indexed reads, replica staging and recovery',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:require('node:path').resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const r=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const journal=window.MedControlT046Journal,api=window.MedControlT046IntegratedVault;
  const indexKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const token=await journal.tokenFor(indexKey,vaultId,'course-test');
  const ids=[];for(let i=0;i<3;i++){
   const eventId='event_'+crypto.randomUUID().replaceAll('-');ids.push(eventId);
   const result=await api.append({vaultId,eventId,kind:'intake',body:{ordinal:i},encryptionKey,commitmentKey,indexTokens:[token],capacityGateway:{reserve:async()=>({reserved:true})},reservationBytes:4096});
   if(!result.localCommitted||result.replicaConfirmed)throw Error('Incorrect local status');
  }
  const pageResult=await journal.page({owner:vaultId,token,key:encryptionKey});
  const positions=[];for(let i=0;i<3;i++)positions.push((await journal.getAt({owner:vaultId,position:i,key:encryptionKey}))?.body.ordinal);
  const head=await window.MedControlT046ManifestHead.read(vaultId);
  const recovered=await api.recoverReplicaQueue({vaultId,commitmentKey});
  const jobs=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {generation:head.generation,positions,ordinals:pageResult.rows.map(x=>x.body.ordinal).sort(),recovered:recovered.recovered,queue:jobs.length,ids:pageResult.rows.map(x=>x.id).sort(),expected:ids.sort()};
 });
 expect(r.generation).toBe(3);
 expect(r.positions).toEqual([0,1,2]);
 expect(r.ordinals).toEqual([0,1,2]);
 expect(r.recovered).toBe(true);
 expect(r.queue).toBe(3);
 expect(r.ids).toEqual(r.expected);
});

test('T-046 durable journal batch commits two authenticated events and rejects an absent third',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_batch_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const journal=window.MedControlT046Journal,integrated=window.MedControlT046IntegratedVault;
  for(let i=0;i<2;i++)await journal.append({owner:vaultId,id:'event_batch_000000'+i,kind:'intake',body:{i},key:encryptionKey,position:i});
  const capacityGateway={reserve:async()=>({reserved:true})};
  const committed=await integrated.stageJournalRange({vaultId,startSequence:1,count:2,commitmentKey,capacityGateway,reservationBytes:100000});
  const head=await window.MedControlT046ManifestHead.read(vaultId);
  const manifest=await window.MedControlT046ManifestHead.object(vaultId,head.commitment);
  let missingRejected=false;
  try{await integrated.stageJournalRange({vaultId,startSequence:3,count:1,commitmentKey,capacityGateway,reservationBytes:100000});}
  catch(e){missingRejected=/missing position/.test(e.message);}
  const after=await window.MedControlT046ManifestHead.read(vaultId);
  return {committed:committed.localCommitted,eventCount:committed.eventCount,segments:committed.segmentCount,
   through:manifest.object.committedThrough,missingRejected,headUnchanged:after.commitment===head.commitment};
 });
 expect(result).toEqual({committed:true,eventCount:2,segments:1,through:2,missingRejected:true,headUnchanged:true});
});
