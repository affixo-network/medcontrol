'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 synthetic 500000-event restart-safe bounded scan',async({page})=>{
 test.setTimeout(2400000);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const owner='load100k-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const write=await page.evaluate(async owner=>{
  const api=MedControlT046IndexedEvents,start=performance.now();
  const token='f'.repeat(64);
  for(let offset=0;offset<500000;offset+=100){
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
   if(pages>5001)throw Error('Pagination did not terminate');
  }
  return {readMs:performance.now()-start,count,pages,maxPage,ordered,last,
   usedJSHeapBytes:performance.memory?.usedJSHeapSize??null};
 },owner);
 expect(read.count).toBe(500000);
 expect(read.pages).toBe(5000);
 expect(read.maxPage).toBeLessThanOrEqual(100);
 expect(read.ordered).toBe(true);
 expect(read.last).toBe('event-00499999');
 console.log('T-046 synthetic 500000-event benchmark (not a 100M certification): '+
  JSON.stringify({...write,...read}));
});
