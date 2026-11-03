'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 indexed encrypted event writes are atomic and owner scoped',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const result=await page.evaluate(async()=>{
  const api=MedControlT046IndexedEvents;
  const owner='synthetic-'+crypto.randomUUID();
  const token='a'.repeat(64),other='b'.repeat(64);
  await api.insert(owner,'event-001',{ciphertext:'synthetic-cipher-1'},[token]);
  await api.insert(owner,'event-002',{ciphertext:'synthetic-cipher-2'},[token,other]);
  let collisionRejected=false;
  try{await api.insert(owner,'event-001',{ciphertext:'should-not-appear'},[other]);}
  catch(_){collisionRejected=true;}
  const first=await api.page(owner,token,{limit:1});
  const second=await api.page(owner,token,{after:first.next,limit:1});
  const all=await api.page(owner,token,{limit:10});
  const secondary=await api.page(owner,other,{limit:10});
  const foreign=await api.page(owner+'-other',token,{limit:10});
  return {collisionRejected,first:first.rows.map(x=>x.id),second:second.rows.map(x=>x.id),
   all:all.rows.map(x=>x.id),secondary:secondary.rows.map(x=>x.id),
   foreign:foreign.rows.length,original:all.rows[0].envelope.ciphertext};
 });
 expect(result).toEqual({collisionRejected:true,first:['event-001'],second:['event-002'],
  all:['event-001','event-002'],secondary:['event-002'],foreign:0,original:'synthetic-cipher-1'});
});


test('T-046 revision replacement updates tokens atomically and rejects stale tab',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const result=await page.evaluate(async()=>{
  const api=MedControlT046IndexedEvents,owner='synthetic-'+crypto.randomUUID();
  const oldToken='c'.repeat(64),newToken='d'.repeat(64);
  await api.insert(owner,'event-1',{ciphertext:'before'},[oldToken]);
  const revision=await api.replaceIfRevision(owner,'event-1',1,{ciphertext:'after'},[newToken]);
  let staleRejected=false;
  try{await api.replaceIfRevision(owner,'event-1',1,{ciphertext:'stale'},[oldToken]);}
  catch(_){staleRejected=true;}
  const oldPage=await api.page(owner,oldToken);
  const newPage=await api.page(owner,newToken);
  return {revision,staleRejected,oldCount:oldPage.rows.length,newCount:newPage.rows.length,
   payload:newPage.rows[0]?.envelope.ciphertext,storedRevision:newPage.rows[0]?.revision};
 });
 expect(result).toEqual({revision:2,staleRejected:true,oldCount:0,newCount:1,payload:'after',storedRevision:2});
});


test('T-046 bounded batch and owner scan preserve atomicity',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const result=await page.evaluate(async()=>{
  const api=MedControlT046IndexedEvents,owner='batch-'+crypto.randomUUID(),token='e'.repeat(64);
  const records=Array.from({length:23},(_,i)=>({id:'event-'+String(i).padStart(3,'0'),
   envelope:{ciphertext:'synthetic-'+i},tokens:[token]}));
  const count=await api.insertBatch(owner,records);
  let rejected=false;
  try{await api.insertBatch(owner,[{id:'event-999',envelope:{ciphertext:'new'},tokens:[token]},records[0]]);}
  catch(_){rejected=true;}
  let after='',ids=[],pages=0;
  do{
   const page=await api.scanPage(owner,{after,limit:7});
   ids.push(...page.rows.map(row=>row.id));
   after=page.next||'';pages++;
   if(!page.next)break;
  }while(pages<10);
  const indexed=await api.page(owner,token,{limit:50});
  return {count,rejected,total:ids.length,unique:new Set(ids).size,pages,
   first:ids[0],last:ids.at(-1),indexed:indexed.rows.length,
   rollback:ids.includes('event-999')};
 });
 expect(result).toEqual({count:23,rejected:true,total:23,unique:23,pages:4,
  first:'event-000',last:'event-022',indexed:23,rollback:false});
});


test('T-046 synthetic 1000-event streaming benchmark uses bounded pages',async({page})=>{
 test.setTimeout(120000);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const metrics=await page.evaluate(async()=>{
  const api=MedControlT046IndexedEvents,owner='benchmark-'+crypto.randomUUID();
  const token='f'.repeat(64),size=1000,batchSize=100,pageSize=100;
  const start=performance.now();
  for(let offset=0;offset<size;offset+=batchSize){
   const batch=Array.from({length:batchSize},(_,j)=>{
    const n=offset+j;
    return {id:'event-'+String(n).padStart(7,'0'),
     envelope:{ciphertext:'synthetic-encrypted-placeholder-'+n},tokens:[token]};
   });
   await api.insertBatch(owner,batch);
  }
  const writeMs=performance.now()-start;
  const readStart=performance.now();
  let after='',total=0,pages=0,maxPage=0,ordered=true,previous='';
  while(true){
   const result=await api.scanPage(owner,{after,limit:pageSize});
   pages++;
   maxPage=Math.max(maxPage,result.rows.length);
   for(const row of result.rows){
    if(previous && row.id<=previous)ordered=false;
    previous=row.id;
    total++;
   }
   if(!result.next)break;
   after=result.next;
   if(pages>20)throw Error('Unexpected scan pagination loop');
  }
  const readMs=performance.now()-readStart;
  return {total,pages,maxPage,ordered,writeMs,readMs};
 });
 expect(metrics.total).toBe(1000);
 expect(metrics.pages).toBe(10);
 expect(metrics.maxPage).toBeLessThanOrEqual(100);
 expect(metrics.ordered).toBe(true);
 expect(metrics.writeMs).toBeGreaterThanOrEqual(0);
 expect(metrics.readMs).toBeGreaterThanOrEqual(0);
 console.log('T-046 synthetic 1000-event benchmark (not a 100M certification): '+JSON.stringify(metrics));
});


test('T-046 synthetic 10000-event bounded throughput and restart scan',async({page})=>{
 test.setTimeout(180000);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const owner='load-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const write=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  const token='f'.repeat(64);
  for(let offset=0;offset<10000;offset+=100){
   const batch=Array.from({length:100},(_,j)=>{
    const n=offset+j;
    return {id:'event-'+String(n).padStart(8,'0'),
     envelope:{ciphertext:'synthetic-envelope-'+n},tokens:[token]};
   });
   await api.insertBatch(owner,batch);
  }
  return {writeMs:performance.now()-start};
 },owner);
 await page.reload();
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const read=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  let after='',count=0,pages=0,maxPage=0,ordered=true,last='';
  while(true){
   const result=await api.scanPage(owner,{after,limit:100});
   pages++;
   maxPage=Math.max(maxPage,result.rows.length);
   for(const row of result.rows){
    if(last && row.id<=last)ordered=false;
    last=row.id;count++;
   }
   if(!result.next)break;
   after=result.next;
   if(pages>101)throw Error('Pagination did not terminate');
  }
  const memory=performance.memory?.usedJSHeapSize??null;
  return {readMs:performance.now()-start,count,pages,maxPage,ordered,last,
   usedJSHeapBytes:memory};
 },owner);
 expect(read.count).toBe(10000);
 expect(read.pages).toBe(100);
 expect(read.maxPage).toBeLessThanOrEqual(100);
 expect(read.ordered).toBe(true);
 expect(read.last).toBe('event-00009999');
 console.log('T-046 synthetic 10000-event benchmark (not a 100M certification): '+
  JSON.stringify({...write,...read}));
});


test('T-046 synthetic 100000-event restart-safe bounded scan',async({page})=>{
 test.setTimeout(300000);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const owner='load100k-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const write=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  const token='f'.repeat(64);
  for(let offset=0;offset<100000;offset+=100){
   const batch=Array.from({length:100},(_,j)=>{
    const n=offset+j;
    return {id:'event-'+String(n).padStart(8,'0'),
     envelope:{ciphertext:'synthetic-envelope-'+n},tokens:[token]};
   });
   await api.insertBatch(owner,batch);
  }
  return {writeMs:performance.now()-start};
 },owner);
 await page.reload();
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const read=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  let after='',count=0,pages=0,maxPage=0,ordered=true,last='';
  while(true){
   const result=await api.scanPage(owner,{after,limit:100});
   pages++;
   maxPage=Math.max(maxPage,result.rows.length);
   for(const row of result.rows){
    if(last && row.id<=last)ordered=false;
    last=row.id;count++;
   }
   if(!result.next)break;
   after=result.next;
   if(pages>1001)throw Error('Pagination did not terminate');
  }
  return {readMs:performance.now()-start,count,pages,maxPage,ordered,last,
   usedJSHeapBytes:performance.memory?.usedJSHeapSize??null};
 },owner);
 expect(read.count).toBe(100000);
 expect(read.pages).toBe(1000);
 expect(read.maxPage).toBeLessThanOrEqual(100);
 expect(read.ordered).toBe(true);
 expect(read.last).toBe('event-00099999');
 console.log('T-046 synthetic 100000-event benchmark (not a 100M certification): '+
  JSON.stringify({...write,...read}));
});
