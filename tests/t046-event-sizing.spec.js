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
 const allocatedBytes=dir=>{
  if(!fs.existsSync(dir))return 0;
  return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{
   const p=path.join(dir,e.name);
   return sum+(e.isDirectory()?allocatedBytes(p):e.isFile()?(fs.statSync(p).blocks||0)*512:0);
  },0);
 };
 const rows=[];
 try{
  for(const tokenCount of [4,4,4,1,0]){
   const replicate=rows.filter(x=>x.tokenCount===tokenCount).length;
   const dir=path.join(root,'profile-'+tokenCount+'-'+replicate);
   let context=await chromium.launchPersistentContext(dir,{headless:true});
   let page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await context.close();
   const baseline=diskBytes(path.join(dir,'Default','IndexedDB'));
   context=await chromium.launchPersistentContext(dir,{headless:true});
   page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
   const owner='disk-'+tokenCount+'-'+Date.now();
   const writeBatch=async(start,count)=>page.evaluate(async({tokenCount,owner,start,count})=>{
    const j=window.MedControlT046Journal;
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
    const tokens=[];
    for(let i=0;i<tokenCount;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
    for(let i=start;i<start+count;i++)await j.append({owner,id:'event-'+String(i).padStart(6,'0'),kind:'intake',
     body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}},key,tokens});
   },{tokenCount,owner,start,count});
   await writeBatch(0,60);
   await context.close();
   const at60=diskBytes(path.join(dir,'Default','IndexedDB'));
   const allocatedAt60=allocatedBytes(path.join(dir,'Default','IndexedDB'));
   context=await chromium.launchPersistentContext(dir,{headless:true});
   page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
   await writeBatch(60,9940);
   await context.close();
   const final=diskBytes(path.join(dir,'Default','IndexedDB'));
   const allocatedFinal=allocatedBytes(path.join(dir,'Default','IndexedDB'));
   rows.push({tokenCount,replicate,baselineBytes:baseline,bytesAt60:at60,bytesAt10000:final,allocatedAt60,allocatedAt10000:allocatedFinal,allocatedMarginalBytesPerEvent:(allocatedFinal-allocatedAt60)/9940,initialBytesPerEvent:(at60-baseline)/60,marginalBytesPerEvent:(final-at60)/9940,deltaBytes:final-baseline});
  }
  for(const row of rows)expect(row.deltaBytes).toBeGreaterThan(0);
  console.log('T046_INDEXEDDB_DISK_SAMPLE '+JSON.stringify(rows));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test('A01 measure physical IndexedDB growth across intake correction and course events',async()=>{
 const {chromium}=require('@playwright/test');
 const fs=require('node:fs'),os=require('node:os');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'t046-a01-kinds-'));
 const diskBytes=dir=>!fs.existsSync(dir)?0:fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,e)=>{
  const p=path.join(dir,e.name);
  return sum+(e.isDirectory()?diskBytes(p):e.isFile()?fs.statSync(p).size:0);
 },0);
 const kinds=[
  {kind:'intake',body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}}},
  {kind:'correction',body:{courseId:'course-01',corrects:'intake-001',reason:'mistake',correctedAt:'2026-11-04T09:07:00+04:00',note:'wrong scheduled time'}},
  {kind:'course',body:{courseId:'course-01',medicine:'Example medication',manufacturer:'Example manufacturer',schedule:{frequency:'daily',time:'09:00'},start:'2026-11-04',end:'2027-11-04'}}
 ];
 const rows=[];
 try{
  for(const item of kinds){
   const dir=path.join(root,item.kind);
   let context=await chromium.launchPersistentContext(dir,{headless:true});
   let page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await context.close();
   const before=diskBytes(path.join(dir,'Default','IndexedDB'));
   context=await chromium.launchPersistentContext(dir,{headless:true});
   page=await context.newPage();
   await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
   const stats=await page.evaluate(async(item)=>{
    const j=window.MedControlT046Journal,owner='a01-kind-'+crypto.randomUUID();
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
    const tokens=[];
    for(let i=0;i<4;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
    const sizes=[];
    for(let i=0;i<1000;i++){
     const id='event-'+String(i).padStart(8,'0');
     await j.append({owner,id,kind:item.kind,body:item.body,key,tokens});
    }
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_journal_v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const rows=await new Promise((resolve,reject)=>{
     const tx=db.transaction(['events','tokens'],'readonly');
     const e=tx.objectStore('events').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
     const t=tx.objectStore('tokens').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
     let events,indexes;
     e.onsuccess=()=>{events=e.result;};t.onsuccess=()=>{indexes=t.result;};
     tx.oncomplete=()=>resolve({events,indexes});tx.onerror=()=>reject(tx.error);
    });
    db.close();
    const size=v=>new TextEncoder().encode(JSON.stringify(v)).length;
    const tokenSizes=new Map();
    for(const t of rows.indexes)tokenSizes.set(t.id,(tokenSizes.get(t.id)||0)+size(t));
    for(const e of rows.events)sizes.push(size(e)+(tokenSizes.get(e.id)||0));
    sizes.sort((a,b)=>a-b);
    return {eventCount:rows.events.length,indexCount:rows.indexes.length,serializedP50Bytes:sizes[499],serializedP95Bytes:sizes[949],serializedMaxBytes:sizes[999]};
   },item);
   await context.close();
   const after=diskBytes(path.join(dir,'Default','IndexedDB'));
   const serializedTotal=stats.serializedP50Bytes*stats.eventCount;
   rows.push({kind:item.kind,...stats,physicalDeltaBytes:after-before,
    physicalBytesPerEvent:(after-before)/1000,
    physicalToSerializedRatio:+((after-before)/serializedTotal).toFixed(4),
    physicalAmplificationPct:+(100*((after-before)/serializedTotal-1)).toFixed(2),
    physicalAt500MProjectedGiB:+(((after-before)/1000)*500_000_000/(1024**3)).toFixed(1),
    physicalAt500MPlus20PctReserveGiB:+(((after-before)/1000)*500_000_000*1.2/(1024**3)).toFixed(1),
    caveat:'Physical LevelDB growth includes baseline and compaction variability; ratio is observational, not an upper bound'});
  }
  for(const row of rows){
   expect(row.eventCount).toBe(1000);
   expect(row.indexCount).toBe(4000);
   expect(row.physicalDeltaBytes).toBeGreaterThan(0);
   expect(row.serializedMaxBytes).toBeGreaterThanOrEqual(row.serializedP95Bytes);
  }
  console.log('T046_A01_EVENT_KIND_PHYSICAL_SAMPLE '+JSON.stringify(rows));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});



test('A01 compare physical IndexedDB growth at 1000 and 3000 intake events',async()=>{
 const {chromium}=require('@playwright/test');
 const fs=require('node:fs'),os=require('node:os');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t046-a01-scale-'));
 const diskBytes=p=>!fs.existsSync(p)?0:fs.readdirSync(p,{withFileTypes:true}).reduce((n,e)=>{
  const child=path.join(p,e.name);
  return n+(e.isDirectory()?diskBytes(child):e.isFile()?fs.statSync(child).size:0);
 },0);
 const dbDir=path.join(dir,'Default','IndexedDB');
 const rows=[];
 try{
  for(const target of [0,1000,3000]){
   const context=await chromium.launchPersistentContext(dir,{headless:true});
   try{
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
    if(target){
     await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
     await page.evaluate(async({start,target})=>{
      const j=window.MedControlT046Journal,owner='a01-scale-owner';
      const raw=new Uint8Array(32).fill(7);
      const key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
      const hmac=await crypto.subtle.importKey('raw',new Uint8Array(32).fill(9),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const tokens=[];
      for(let i=0;i<4;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
      for(let i=start;i<target;i++){
       await j.append({owner,id:'event-'+String(i).padStart(8,'0'),kind:'intake',
        body:{courseId:'course-01',scheduledAt:'2026-11-04T09:00:00+04:00',takenAt:'2026-11-04T09:03:00+04:00',status:'accepted',dose:{amount:1,unit:'tablet'}},
        key,tokens});
      }
     },{start:target===1000?0:1000,target});
    }
   }finally{await context.close();}
   rows.push({eventCount:target,physicalBytes:diskBytes(dbDir)});
  }
  const first=rows[1].physicalBytes-rows[0].physicalBytes;
  const second=rows[2].physicalBytes-rows[1].physicalBytes;
  const peakPhysicalBytes=Math.max(...rows.map(row=>row.physicalBytes));
  const report={rows,peakPhysicalBytes,
   first1000BytesPerEvent:first/1000,
   next2000ObservedDiskDeltaBytes:second,
   next2000ObservedDiskDeltaPerEvent:second/2000,
   negativeDeltaMeansCompaction:second<0,
   caveat:'Observed disk delta may be negative due to LevelDB compaction; never interpret it as negative per-event storage cost or a proven capacity upper bound'};
  expect(first).toBeGreaterThan(0);
  expect(rows[2].physicalBytes).toBeGreaterThan(rows[0].physicalBytes);
  console.log('T046_A01_PHYSICAL_SCALE_SAMPLE '+JSON.stringify(report));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('A01 measure variable-length correction notes with four index tokens',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const rows=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal;
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const size=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const results=[];
  for(const noteLength of [0,128,1024,8192]){
   const owner='a01-note-'+noteLength+'-'+crypto.randomUUID();
   const tokens=[];
   for(let i=0;i<4;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
   for(let i=0;i<100;i++){
    await j.append({owner,id:'correction-'+String(i).padStart(6,'0'),kind:'correction',
     body:{courseId:'course-01',corrects:'intake-001',reason:'mistake',
      correctedAt:'2026-11-04T09:07:00+04:00',note:'x'.repeat(noteLength)},key,tokens});
   }
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_journal_v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const records=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['events','tokens'],'readonly');
    const e=tx.objectStore('events').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
    const t=tx.objectStore('tokens').getAll(IDBKeyRange.bound([owner,''],[owner,'\uffff']));
    let events,indexes;
    e.onsuccess=()=>{events=e.result;};t.onsuccess=()=>{indexes=t.result;};
    tx.oncomplete=()=>resolve({events,indexes});tx.onerror=()=>reject(tx.error);
   });
   db.close();
   const byId=new Map();
   for(const token of records.indexes)byId.set(token.id,(byId.get(token.id)||0)+size(token));
   const sizes=records.events.map(event=>size(event)+(byId.get(event.id)||0)).sort((a,b)=>a-b);
   results.push({noteLength,eventCount:records.events.length,indexCount:records.indexes.length,
    serializedP50Bytes:sizes[49],serializedP95Bytes:sizes[94],serializedMaxBytes:sizes[99]});
  }
  return results;
 });
 for(const row of rows){expect(row.eventCount).toBe(100);expect(row.indexCount).toBe(400);}
 for(let i=1;i<rows.length;i++)expect(rows[i].serializedP95Bytes).toBeGreaterThan(rows[i-1].serializedP95Bytes);
 console.log('T046_A01_VARIABLE_CORRECTION_SIZE_SAMPLE '+JSON.stringify({
  rows,caveat:'Synthetic note lengths are sensitivity measurements, not a validated maximum medical-event size or physical 500M capacity guarantee'
 }));
});


test('A01 verify UTF-8 encrypted correction sizing and Unicode round-trip',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const rows=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal;
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const size=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const results=[];
  for(const sample of [{label:'ascii',note:'A'.repeat(1024)},{label:'cyrillic',note:'Ж'.repeat(1024)},{label:'emoji',note:'💊'.repeat(1024)}]){
   const owner='a01-utf8-'+sample.label+'-'+crypto.randomUUID(),id='correction-000001';
   const tokens=[];
   for(let i=0;i<4;i++)tokens.push(await j.tokenFor(hmac,owner,'index-'+i));
   const body={courseId:'course-01',corrects:'intake-001',reason:'mistake',note:sample.note};
   await j.append({owner,id,kind:'correction',body,key,tokens});
   const restored=await j.get({owner,id,key});
   const record=await j.encrypted({owner,id});
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_journal_v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const indexRows=await new Promise((resolve,reject)=>{
    const tx=db.transaction('tokens','readonly'),req=tx.objectStore('tokens').getAll();
    req.onsuccess=()=>resolve(req.result.filter(v=>v.owner===owner&&v.id===id));
    req.onerror=()=>reject(req.error);
   });
   db.close();
   results.push({label:sample.label,utf8NoteBytes:new TextEncoder().encode(sample.note).length,
    serializedEventBytes:size(record),serializedIndexBytes:indexRows.reduce((sum,r)=>sum+size(r),0),
    indexCount:indexRows.length,roundTripExact:restored.body.note===sample.note});
  }
  return results;
 });
 for(const row of rows){expect(row.roundTripExact).toBe(true);expect(row.indexCount).toBe(4);}
 expect(rows[1].utf8NoteBytes).toBeGreaterThan(rows[0].utf8NoteBytes);
 expect(rows[2].utf8NoteBytes).toBeGreaterThan(rows[1].utf8NoteBytes);
 expect(rows[1].serializedEventBytes).toBeGreaterThan(rows[0].serializedEventBytes);
 expect(rows[2].serializedEventBytes).toBeGreaterThan(rows[1].serializedEventBytes);
 console.log('T046_A01_UNICODE_SIZE_SAMPLE '+JSON.stringify(rows));
});


test('A01 project 500M-event capacity scenarios with explicit reserves and copies',()=>{
 const count=500_000_000,GiB=1024**3;
 const scenarios=[
  {label:'measured-4-index-1KiB-ascii',recordBytes:1675,indexBytes:652},
  {label:'measured-4-index-1KiB-cyrillic',recordBytes:3042,indexBytes:664},
  {label:'measured-4-index-1KiB-emoji',recordBytes:5771,indexBytes:652},
  {label:'measured-4-index-8KiB-ascii',combinedBytes:12213}
 ];
 const rows=scenarios.map(s=>{
  const perEventBytes=s.combinedBytes??(s.recordBytes+s.indexBytes);
  const baseBytes=perEventBytes*count;
  const reserveBytes=Math.ceil(baseBytes*0.2);
  const localRequiredBytes=baseBytes+reserveBytes;
  const withTwoFullCopiesBytes=localRequiredBytes+2*baseBytes;
  return {scenario:s.label,perEventBytes,baseGiB:+(baseBytes/GiB).toFixed(1),
   reserve20PercentGiB:+(reserveBytes/GiB).toFixed(1),
   localRequiredGiB:+(localRequiredBytes/GiB).toFixed(1),
   withTwoFullCopiesGiB:+(withTwoFullCopiesBytes/GiB).toFixed(1),
   indexMeasured:true,measurementBasis:s.combinedBytes!==undefined?'combined-event-and-index':'separate-event-and-index'};
 });
 for(const r of rows){
  expect(r.baseGiB).toBeGreaterThan(0);
  expect(r.localRequiredGiB).toBeGreaterThan(r.baseGiB);
  expect(r.withTwoFullCopiesGiB).toBeGreaterThan(r.localRequiredGiB);
 }
 expect(rows[2].localRequiredGiB).toBeGreaterThan(rows[1].localRequiredGiB);
 expect(rows[1].localRequiredGiB).toBeGreaterThan(rows[0].localRequiredGiB);
 console.log('T046_A01_CAPACITY_SCENARIOS '+JSON.stringify({count,rows,
  assumptions:'All 500M events have the sampled size; 20% reserve; two full backup copies; decimal-free GiB reporting',
  exclusions:'Physical IndexedDB/LevelDB overhead, compaction peaks, manifests, recovery logs, quota, device space, metadata growth; 8KiB sample already includes four index tokens',
  status:'Sensitivity projection only; NOT an acceptance proof of 500M-event capacity'}));
});


test('A01 mixed-event 500M capacity sensitivity uses exact integer byte arithmetic',()=>{
 const total=500_000_000n,GiB=1024n**3n;
 const samples=[
  {label:'ascii-1KiB',bytes:2327n},
  {label:'cyrillic-1KiB',bytes:3706n},
  {label:'emoji-1KiB',bytes:6423n},
  {label:'ascii-8KiB',bytes:12213n}
 ];
 const mixtures=[
  {label:'90pct-ascii-10pct-cyrillic',weights:[90n,10n,0n,0n]},
  {label:'70pct-ascii-20pct-cyrillic-10pct-long',weights:[70n,20n,0n,10n]},
  {label:'25pct-each',weights:[25n,25n,25n,25n]}
 ];
 const rows=mixtures.map(m=>{
  expect(m.weights.reduce((a,b)=>a+b,0n)).toBe(100n);
  const counts=m.weights.map(w=>total*w/100n);
  expect(counts.reduce((a,b)=>a+b,0n)).toBe(total);
  const baseBytes=counts.reduce((sum,n,i)=>sum+n*samples[i].bytes,0n);
  const reserveBytes=(baseBytes+4n)/5n;
  const localBytes=baseBytes+reserveBytes;
  const twoFullCopiesBytes=localBytes+2n*baseBytes;
  const toGiB=n=>Number(n*10n/GiB)/10;
  return {scenario:m.label,baseGiB:toGiB(baseBytes),reserveGiB:toGiB(reserveBytes),
   localGiB:toGiB(localBytes),withTwoFullCopiesGiB:toGiB(twoFullCopiesBytes),
   baseBytes:baseBytes.toString()};
 });
 for(const row of rows)expect(row.withTwoFullCopiesGiB).toBeGreaterThan(row.localGiB);
 console.log('T046_A01_MIXED_CAPACITY_SCENARIOS '+JSON.stringify({eventCount:total.toString(),rows,
  scope:'Exact integer arithmetic for synthetic distribution scenarios using previously measured serialized sample sizes',
  exclusions:'Physical storage overhead, journal and manifest, compaction, quota and recovery headroom; not a guarantee'}));
});


test('A01 account for physical amplification and temporary recovery headroom',()=>{
 const events=500_000_000n,GiB=1024n**3n;
 const sizes=[{label:'ascii-1KiB',bytes:2327n},{label:'cyrillic-1KiB',bytes:3706n},
  {label:'emoji-1KiB',bytes:6423n},{label:'ascii-8KiB',bytes:12213n}];
 // These are explicit hypothetical factors, NOT measured LevelDB bounds.
 const factors=[{label:'no-amplification',numerator:100n},
  {label:'plus-25pct',numerator:125n},{label:'plus-100pct',numerator:200n}];
 const rows=[];
 for(const sample of sizes)for(const factor of factors){
  const logical=events*sample.bytes;
  const physical=(logical*factor.numerator+99n)/100n;
  const localReserve=(physical+4n)/5n;
  const recoveryScratch=physical; // explicit conservative one-full-copy scenario
  const twoFullCopies=2n*physical;
  const required=physical+localReserve+recoveryScratch+twoFullCopies;
  const gib=n=>Number(n*10n/GiB)/10;
  expect(required).toBeGreaterThan(physical);
  rows.push({sample:sample.label,physicalAmplification:factor.label,
   physicalGiB:gib(physical),localReserveGiB:gib(localReserve),
   recoveryScratchGiB:gib(recoveryScratch),twoFullCopiesGiB:gib(twoFullCopies),
   totalGiB:gib(required)});
 }
 for(const sample of sizes){
  const values=rows.filter(r=>r.sample===sample.label);
  expect(values[2].totalGiB).toBeGreaterThan(values[1].totalGiB);
  expect(values[1].totalGiB).toBeGreaterThan(values[0].totalGiB);
 }
 console.log('T046_A01_PHYSICAL_OVERHEAD_SENSITIVITY '+JSON.stringify({
  eventCount:events.toString(),rows,
  status:'Hypothetical physical amplification and recovery-scratch sensitivity only, not measured bounds',
  excluded:'Manifests, real compaction peaks, filesystem quota, SSD free-space checks and backup deduplication'
 }));
});


test('A01 validate exact 500M event capacity arithmetic and boundary overflow',()=>{
 const eventCount=500_000_000n;
 const eventsPerSegment=1024n;
 const segmentCount=(eventCount+eventsPerSegment-1n)/eventsPerSegment;
 expect(segmentCount).toBe(488282n);
 expect((segmentCount-1n)*eventsPerSegment).toBeLessThan(eventCount);
 expect(segmentCount*eventsPerSegment).toBeGreaterThanOrEqual(eventCount);
 const maxSegmentId=segmentCount-1n;
 const finalOffset=(eventCount-1n)%eventsPerSegment;
 expect(maxSegmentId).toBe(488281n);
 expect(finalOffset).toBe(255n);
 const payloadBytesPerEvent=8192n;
 const indexBytesPerEvent=1024n;
 const totalBytes=eventCount*(payloadBytesPerEvent+indexBytesPerEvent);
 const reserveBytes=(totalBytes+4n)/5n;
 expect(totalBytes).toBe(4608000000000n);
 expect(totalBytes+reserveBytes).toBe(5529600000000n);
 const beyondSafeInteger=9007199254740993n;
 expect(beyondSafeInteger+eventCount).toBe(9007199754740993n);
 console.log('T046_A01_EXACT_BOUNDARY '+JSON.stringify({
  eventCount:String(eventCount),eventsPerSegment:String(eventsPerSegment),
  segmentCount:String(segmentCount),lastSegmentId:String(maxSegmentId),lastOffset:String(finalOffset),
  assumedPayloadBytesPerEvent:String(payloadBytesPerEvent),
  assumedIndexBytesPerEvent:String(indexBytesPerEvent),
  assumedBaseBytes:String(totalBytes),assumedReserveBytes:String(reserveBytes),
  assumedTotalWithReserveBytes:String(totalBytes+reserveBytes),
  caveat:'Arithmetic proof only; byte assumptions are scenarios, not enforced record bounds or physical storage guarantees'
 }));
});


test('A01 prove segment addressing round trip at boundaries without bulk writes',()=>{
 const segmentSize=1024n;
 const capacity=500_000_000n;
 const locate=n=>({segment:n/segmentSize,offset:n%segmentSize});
 const restore=({segment,offset})=>segment*segmentSize+offset;
 const boundaries=[0n,1n,1023n,1024n,1025n,2047n,2048n,capacity-1025n,capacity-1024n,capacity-1023n,capacity-2n,capacity-1n];
 let state=0x12345678n;
 for(let i=0;i<10000;i++){
  state=(state*1664525n+1013904223n)%4294967296n;
  boundaries.push(state%capacity);
 }
 for(const n of boundaries){
  const a=locate(n);
  expect(a.offset).toBeGreaterThanOrEqual(0n);
  expect(a.offset).toBeLessThan(segmentSize);
  expect(restore(a)).toBe(n);
  expect(a.segment).toBeLessThan(488282n);
 }
 expect(locate(capacity-1n)).toEqual({segment:488281n,offset:255n});
 expect(locate(capacity)).toEqual({segment:488281n,offset:256n});
 console.log('T046_A01_ADDRESS_INVARIANT '+JSON.stringify({
  testedAddresses:boundaries.length,capacity:String(capacity),segmentSize:String(segmentSize),
  lastAddress:String(capacity-1n),lastSegment:'488281',lastOffset:'255',
  caveat:'Pure arithmetic model verification, not an implemented segment store or storage endurance test'
 }));
});


test('A01 persist encrypted events at real boundary positions across reopen',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const result=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal,owner='a01-physical-position-'+crypto.randomUUID();
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const positions=[0,1023,1024,499999999];
  for(const position of positions){
   await j.append({owner,id:'event-'+position,position,kind:'intake',body:{position,courseId:'test-course',status:'accepted'},key});
  }
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('medcontrol_t046_journal_v1');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const count=await new Promise((resolve,reject)=>{
   const tx=db.transaction('positions','readonly'),r=tx.objectStore('positions').count();
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  db.close();
  const results=[];
  for(const position of positions){
   const event=await j.getAt({owner,position,key});
   results.push({position,id:event.id,matched:event.body.position===position});
  }
  let duplicateRejected=false;
  try{await j.append({owner,id:'duplicate-id',position:1024,kind:'intake',body:{status:'duplicate'},key});}
  catch(e){duplicateRejected=true;}
  const absent=await j.getAt({owner,position:499999998,key});
  const orphan=await j.get({owner,id:'duplicate-id',key});
  return {results,count,duplicateRejected,absent:absent===null,orphanAbsent:orphan===null};
 });
 expect(result.count).toBeGreaterThanOrEqual(4);
 expect(result.results).toHaveLength(4);
 expect(result.results.every(x=>x.matched)).toBe(true);
 expect(result.duplicateRejected).toBe(true);
 expect(result.orphanAbsent).toBe(true);
 expect(result.absent).toBe(true);
 console.log('T046_A01_REAL_POSITION_STORAGE '+JSON.stringify(result));
});
