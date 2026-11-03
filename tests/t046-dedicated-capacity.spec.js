// T-046 opt-in long-duration capacity trial. Never included in ordinary CI.
// Run only on a dedicated disposable browser profile with adequate free SSD space.
// T046_EVENT_COUNT=50000000 (then 500000000), T046_CAPACITY_APPROVED=YES.
// Synthetic records only. No access to the active medical vault.
const {test,expect}=require('@playwright/test');
const path=require('path');
const COUNT=Number(process.env.T046_EVENT_COUNT||0);
const APPROVED=process.env.T046_CAPACITY_APPROVED==='YES';
const ALLOWED=[50000000,500000000];
test('T-046 dedicated capacity trial',async({page})=>{
 test.skip(!APPROVED||!ALLOWED.includes(COUNT),
  'Dedicated capacity test requires explicit opt-in and an allowed volume');
 test.setTimeout(0);
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const owner='capacity-'+COUNT+'-'+Date.now();
 const metrics=await page.evaluate(async({owner,count})=>{
  const api=MedControlT046IndexedEvents,token='f'.repeat(64);
  const started=performance.now(),checkpoints=[];
  for(let offset=0;offset<count;offset+=100){
   const batch=Array.from({length:Math.min(100,count-offset)},(_,i)=>{
    const n=offset+i;
    return {id:'event-'+String(n).padStart(10,'0'),
      envelope:{ciphertext:'synthetic-placeholder-'+n},tokens:[token]};
   });
   await api.insertBatch(owner,batch);
   if((offset+batch.length)%100000===0){
    const estimate=await navigator.storage?.estimate?.();
    checkpoints.push({events:offset+batch.length,elapsedMs:performance.now()-started,
      originUsageBytes:estimate?.usage??null,originQuotaBytes:estimate?.quota??null});
    console.log('T-046 capacity checkpoint '+JSON.stringify(checkpoints[checkpoints.length-1]));
   }
  }
  return {writeMs:performance.now()-started,checkpoints};
 },{owner,count:COUNT});
 console.log('T-046 capacity write result '+JSON.stringify({
  count:COUNT,writeMs:metrics.writeMs,
  first:metrics.checkpoints[0],last:metrics.checkpoints.at(-1)}));
 await page.reload();
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const result=await page.evaluate(async({owner,count})=>{
  const api=MedControlT046IndexedEvents,started=performance.now();
  let after='',total=0,pages=0,last='',ordered=true;
  while(true){
   const p=await api.scanPage(owner,{after,limit:100});
   pages++;
   for(const row of p.rows){
    if(last&&row.id<=last)ordered=false;
    last=row.id;total++;
   }
   if(!p.next)break;
   after=p.next;
   if(pages>Math.ceil(count/100)+1)throw Error('Scan pagination loop');
   if(pages%1000===0)console.log('T-046 capacity scan '+JSON.stringify({pages,total}));
  }
  return {total,pages,last,ordered,readMs:performance.now()-started};
 },{owner,count:COUNT});
 expect(result.total).toBe(COUNT);
 expect(result.pages).toBe(COUNT/100);
 expect(result.ordered).toBe(true);
 expect(result.last).toBe('event-'+String(COUNT-1).padStart(10,'0'));
 console.log('T-046 capacity verified '+JSON.stringify({count:COUNT,...result}));
});
