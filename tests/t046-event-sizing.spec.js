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

test('A01.4 measure indexed encryption overhead at 0, 1 and 4 tokens',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const result=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal;
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const size=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const results=[];
  for(const tokenCount of [0,1,4]){
   const owner='sizing-tokens-'+tokenCount+'-'+crypto.randomUUID();
   const tokens=[];
   for(let i=0;i<tokenCount;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
   for(let i=0;i<60;i++){
    await j.append({owner,id:'event-'+String(i).padStart(6,'0'),kind:'intake',
     body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}},
     key,tokens});
   }
   const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('medcontrol_t046_journal_v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   const rows=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['events','tokens'],'readonly');
    const e=tx.objectStore('events').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
    const t=tx.objectStore('tokens').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
    let events,indexes;
    e.onsuccess=()=>{events=e.result;};t.onsuccess=()=>{indexes=t.result;};
    tx.oncomplete=()=>resolve({events,indexes});tx.onerror=()=>reject(tx.error);
   });db.close();
   const recordBytes=rows.events.reduce((s,v)=>s+size(v),0);
   const indexBytes=rows.indexes.reduce((s,v)=>s+size(v),0);
   results.push({tokenCount,count:rows.events.length,indexCount:rows.indexes.length,
    averageEventBytes:recordBytes/60,averageIndexBytes:indexBytes/60,
    averageTotalBytes:(recordBytes+indexBytes)/60,storageEstimate:await navigator.storage.estimate()});
  }
  return results;
 });
 for(const r of result){expect(r.count).toBe(60);expect(r.indexCount).toBe(60*r.tokenCount);}
 expect(result[0].averageTotalBytes).toBeLessThan(result[1].averageTotalBytes);
 expect(result[1].averageTotalBytes).toBeLessThan(result[2].averageTotalBytes);
 console.log('T046_TOKEN_OVERHEAD_SAMPLE '+JSON.stringify(result));
});

test('A01.4 isolated physical IndexedDB usage by token count',async({browser})=>{
 const rows=[];
 for(const tokenCount of [0,1,4]){
  const context=await browser.newContext();
  try{
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
   const row=await page.evaluate(async(tokenCount)=>{
    const j=window.MedControlT046Journal,owner='isolated-'+crypto.randomUUID();
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
    const before=await navigator.storage.estimate();
    const tokens=[];
    for(let i=0;i<tokenCount;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
    let usageAt60=null;
    for(let i=0;i<300;i++){await j.append({owner,id:'event-'+String(i).padStart(6,'0'),kind:'intake',
     body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}},key,tokens});
     if(i===59)usageAt60=(await navigator.storage.estimate()).usage;
    }
    const after=await navigator.storage.estimate();
    return {tokenCount,beforeUsage:before.usage,afterUsage:after.usage,deltaBytes:after.usage-before.usage,deltaPerEventBytes:(after.usage-before.usage)/300,usageAt60,marginalBytesPerEvent:(after.usage-usageAt60)/240,
     caveat:'Browser quota estimate, not SSD physical allocation; context isolation must be verified; 300-event sample'};
   },tokenCount);
   rows.push(row);
  }finally{await context.close();}
 }
 for(const row of rows)expect(row.deltaBytes).toBeGreaterThan(0);
 console.log('T046_ISOLATED_USAGE_SAMPLE '+JSON.stringify(rows));
});

test('A01.4 measure Chromium IndexedDB files on disk',async()=>{
 const {chromium}=require('@playwright/test');
 const fs=require('node:fs'),os=require('node:os');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'t046-disk-'));
 const diskBytes=dir=>{
  if(!fs.existsSync(dir))return 0;
  return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{
   const p=path.join(dir,e.name);
   return sum+(e.isDirectory()?diskBytes(p):e.isFile()?fs.statSync(p).size:0);
  },0);
 };
 const rows=[];
 try{
  for(const tokenCount of [0,1,4]){
   const dir=path.join(root,'profile-'+tokenCount);
   let context=await chromium.launchPersistentContext(dir,{headless:true});
   let page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await context.close();
   const baseline=diskBytes(path.join(dir,'Default','IndexedDB'));
   context=await chromium.launchPersistentContext(dir,{headless:true});
   page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
   await page.evaluate(async(tokenCount)=>{
    const j=window.MedControlT046Journal,owner='disk-'+crypto.randomUUID();
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
    const tokens=[];
    for(let i=0;i<tokenCount;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
    for(let i=0;i<300;i++)await j.append({owner,id:'event-'+String(i).padStart(6,'0'),kind:'intake',
     body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}},key,tokens});
   },tokenCount);
   await context.close();
   const final=diskBytes(path.join(dir,'Default','IndexedDB'));
   rows.push({tokenCount,baselineBytes:baseline,finalBytes:final,deltaBytes:final-baseline,deltaPerEventBytes:(final-baseline)/300});
  }
  for(const row of rows)expect(row.deltaBytes).toBeGreaterThan(0);
  console.log('T046_INDEXEDDB_DISK_SAMPLE '+JSON.stringify(rows));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
