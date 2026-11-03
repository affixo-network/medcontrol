// T-046 dedicated resumable stress driver. Synthetic data only; no medical vault.
// Usage: T046_EVENT_COUNT=50000000 node scripts/t046-capacity-runner.cjs
//        T046_EVENT_COUNT=500000000 node scripts/t046-capacity-runner.cjs
// Keep the same persistent profile to resume after interruption.
const {chromium}=require('@playwright/test');
const path=require('path'),fs=require('fs'),os=require('os');
const count=Number(process.env.T046_EVENT_COUNT||0);
if(![50000000,500000000].includes(count))throw Error('T046_EVENT_COUNT must be 50000000 or 500000000');
const profile=path.resolve(process.env.T046_PROFILE_DIR||'.t046-capacity-profile');
const base=process.env.T046_BASE_URL||'http://127.0.0.1:8765/t046-indexed-test.html';
const checkpoint=path.join(profile,'t046-checkpoint-'+count+'.json');
const owner='t046-capacity-'+count;
const segment=100000;
const save=(x)=>{fs.mkdirSync(profile,{recursive:true});const tmp=checkpoint+'.tmp';fs.writeFileSync(tmp,JSON.stringify(x,null,2));fs.renameSync(tmp,checkpoint);};
let state=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):{count,owner,completed:0,segments:[],verified:0};
if(state.count!==count||state.owner!==owner)throw Error('Checkpoint mismatch');
(async()=>{
 const browser=await chromium.launchPersistentContext(profile,{headless:true,args:['--no-sandbox']});
 const page=browser.pages()[0]||await browser.newPage();
 try{
  await page.goto(base);
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
  // Never trust a checkpoint blindly: the last stored ID must exist in the database.
  if(state.completed){
   const verified=await page.evaluate(async({owner,n})=>{
    const page=await MedControlT046IndexedEvents.scanPage(owner,{after:'event-'+String(n-2).padStart(10,'0'),limit:1});
    return page.rows.length===1&&page.rows[0].id==='event-'+String(n-1).padStart(10,'0');
   },{owner,n:state.completed});
   if(!verified)throw Error('Checkpoint does not match IndexedDB; manual inspection required');
  }
  for(let offset=state.completed;offset<count;offset+=segment){
   const amount=Math.min(segment,count-offset);
   const elapsed=await page.evaluate(async({owner,offset,amount})=>{
    const started=performance.now(),token='f'.repeat(64);
    for(let at=0;at<amount;at+=100){
     const batch=Array.from({length:Math.min(100,amount-at)},(_,j)=>{
      const n=offset+at+j;
      return {id:'event-'+String(n).padStart(10,'0'),
       envelope:{ciphertext:'synthetic-placeholder-'+n},tokens:[token]};
     });
     await MedControlT046IndexedEvents.insertBatch(owner,batch);
    }
    return performance.now()-started;
   },{owner,offset,amount});
   const usage=await page.evaluate(async()=>navigator.storage?.estimate?.());
   state.completed=offset+amount;
   state.segments.push({completed:state.completed,writeMs:elapsed,
    originUsageBytes:usage?.usage??null,originQuotaBytes:usage?.quota??null,
    at:new Date().toISOString()});
   save(state);
   console.log('T046_CHECKPOINT '+JSON.stringify(state.segments.at(-1)));
  }
  await page.reload();
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
  let last='',after=state.verified?'event-'+String(state.verified-1).padStart(10,'0'):'';
  for(let offset=state.verified;offset<count;offset+=segment){
   const result=await page.evaluate(async({owner,after,amount})=>{
    let n=0,last='',ordered=true,pages=0;
    while(n<amount){
     const p=await MedControlT046IndexedEvents.scanPage(owner,{after,limit:100});
     if(!p.rows.length)break;
     for(const r of p.rows){if(last&&r.id<=last)ordered=false;last=r.id;n++;}
     after=last;pages++;
    }
    return {n,last,ordered,pages};
   },{owner,after,amount:Math.min(segment,count-offset)});
   if(result.n!==Math.min(segment,count-offset)||!result.ordered||
      result.last!=='event-'+String(offset+result.n-1).padStart(10,'0'))
     throw Error('Readback verification failed at '+offset);
   after=result.last;last=result.last;
   state.verified=offset+result.n;save(state);
   console.log('T046_VERIFIED '+state.verified);
  }
  console.log('T046_SUCCESS '+JSON.stringify({count,verified:state.verified,last,segments:state.segments.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error('T046_FAILED',e);process.exitCode=1;});
