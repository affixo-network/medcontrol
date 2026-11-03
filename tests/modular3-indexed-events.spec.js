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
