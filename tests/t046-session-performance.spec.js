'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 persistent batch session 10000-event measured integrity',async({page})=>{
 test.setTimeout(120000);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const owner='perf-session-'+Date.now()+'-'+Math.random();
 const metrics=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,token='a'.repeat(64),started=performance.now();
  const session=await api.openBatchSession();
  try{
   for(let offset=0;offset<10000;offset+=1000){
    const rows=Array.from({length:1000},(_,i)=>({id:'event-'+String(offset+i).padStart(8,'0'),
      envelope:{ciphertext:'synthetic-'+(offset+i)},tokens:[token]}));
    await session.insertBatch(owner,rows);
   }
  }finally{session.close();}
  return {writeMs:performance.now()-started};
 },owner);
 await page.reload();
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const verified=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  let count=0,after='',last='',ordered=true,pages=0;
  while(true){
   const p=await api.scanPage(owner,{after,limit:100});pages++;
   for(const row of p.rows){if(last&&row.id<=last)ordered=false;last=row.id;count++;}
   if(!p.next)break;after=p.next;
   if(pages>101)throw Error('Scan loop');
  }
  return {count,pages,last,ordered,readMs:performance.now()-start};
 },owner);
 expect(verified).toMatchObject({count:10000,pages:100,last:'event-00009999',ordered:true});
 console.log('T-046 measured persistent session 10000 '+JSON.stringify({...metrics,...verified}));
});
