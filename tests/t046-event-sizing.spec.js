'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 measure real AES-GCM journal record sizes (isolated sample)',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const report=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal,owner='sizing-'+crypto.randomUUID();
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const token=await j.tokenFor(hmac,owner,'course-01');
  const payloads=[
   {kind:'intake',body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}}},
   {kind:'correction',body:{courseId:'course-01',corrects:'intake-001',reason:'mistake',correctedAt:'2026-11-04T09:07:00+04:00',note:'wrong scheduled time'}},
   {kind:'course',body:{courseId:'course-01',medicine:'Example medication',manufacturer:'Example manufacturer',schedule:{frequency:'daily',time:'09:00'},start:'2026-11-04',end:'2027-11-04'}}
  ];
  const ids=[];
  for(let i=0;i<60;i++){
   const p=payloads[i%payloads.length],id='event-'+String(i).padStart(6,'0');
   await j.append({owner,id,kind:p.kind,body:p.body,key,tokens:[token]});
   ids.push(id);
  }
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_journal_v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const records=await new Promise((resolve,reject)=>{
   const tx=db.transaction(['events','tokens'],'readonly');
   const e=tx.objectStore('events').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
   const t=tx.objectStore('tokens').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
   let events,tokens;
   e.onsuccess=()=>{events=e.result;};t.onsuccess=()=>{tokens=t.result;};
   tx.oncomplete=()=>resolve({events,tokens});
   tx.onerror=()=>reject(tx.error);
  });db.close();
  const size=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const perKind={};
  const sizes=records.events.map(r=>size(r)+records.tokens.filter(t=>t.id===r.id).reduce((s,t)=>s+size(t),0)).sort((a,b)=>a-b);
  const percentile=p=>sizes[Math.ceil(p*sizes.length)-1];
  for(const r of records.events){
   const item=perKind[r.kind]||(perKind[r.kind]={count:0,plaintextBytes:0,recordJsonBytes:0,envelopeJsonBytes:0});
   item.count++;
   item.recordJsonBytes+=size(r);
   item.envelopeJsonBytes+=size(r.envelope);
  }
  for(let i=0;i<payloads.length;i++){
   const p=payloads[i],entry=perKind[p.kind];
   entry.plaintextBytes=size(p.body)*entry.count;
  }
  const eventJsonBytes=records.events.reduce((s,r)=>s+size(r),0);
  const indexJsonBytes=records.tokens.reduce((s,r)=>s+size(r),0);
  return {count:records.events.length,indexCount:records.tokens.length,eventJsonBytes,indexJsonBytes,averageSerializedBytes:(eventJsonBytes+indexJsonBytes)/records.events.length,serializedP50Bytes:percentile(.5),serializedP95Bytes:percentile(.95),serializedMaxBytes:sizes[sizes.length-1],projected500mSerializedBytes:Math.ceil((eventJsonBytes+indexJsonBytes)/records.events.length*500000000),projectionCaveat:'JSON serialization proxy only; excludes IndexedDB physical B-tree/page overhead, segment/manifest overhead, encryption key backups and replica capacity; not a 500M acceptance measurement',perKind,storageEstimate:await navigator.storage.estimate()};
 });
 expect(report.count).toBe(60);
 expect(report.indexCount).toBe(60);
 expect(report.averageSerializedBytes).toBeGreaterThan(0);
 expect(report.serializedP50Bytes).toBeGreaterThan(0);
 expect(report.serializedP95Bytes).toBeGreaterThanOrEqual(report.serializedP50Bytes);
 expect(report.serializedMaxBytes).toBeGreaterThanOrEqual(report.serializedP95Bytes);
 console.log('T046_ENCRYPTED_SIZE_SAMPLE '+JSON.stringify(report));
});
