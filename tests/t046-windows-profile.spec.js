'use strict';
// Bounded synthetic-only test. Persistent Chromium profile explicitly resides on D:.
const {test,expect,chromium}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const PROFILE_ROOT=process.env.T046_PROFILE_ROOT;
const COUNT=Number(process.env.T046_EVENT_COUNT||10000);
if(![10000,1000000].includes(COUNT))throw Error('Unsupported T-046 event count');
test('T-046 million-scale persistent IndexedDB on isolated D drive profile',async()=>{
 test.setTimeout(3600000);
 if(!PROFILE_ROOT||path.parse(PROFILE_ROOT).root.toUpperCase()!=='D:\\')
  throw Error('T046_PROFILE_ROOT must be an absolute D: drive directory');
 if(!fs.existsSync(path.dirname(PROFILE_ROOT)))throw Error('Profile parent directory missing');
 const profile=path.resolve(PROFILE_ROOT);
 const owner='probe-'+Date.now();
 const url='http://127.0.0.1:8765/t046-indexed-test.html';
 const script=path.resolve(__dirname,'../js/modular3-indexed-events.js');
 let context=await chromium.launchPersistentContext(profile,{headless:true});
 let writeMs;
 try {
  const page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  writeMs=await page.evaluate(async ({owner,count})=>{
   const api=MedControlT046IndexedEvents,token='a'.repeat(64),start=performance.now();
   const session=await api.openBatchSession();
   try{
    for(let offset=0;offset<count;offset+=1000){
     const batch=Array.from({length:1000},(_,i)=>({
      id:'event-'+String(offset+i).padStart(8,'0'),
      envelope:{ciphertext:'synthetic-'+(offset+i)},tokens:[token]
     }));
     await session.insertBatch(owner,batch);
    }
   }finally{session.close();}
   return performance.now()-start;
  },{owner,count:COUNT});
 }finally{await context.close();}
 // A second Chromium process reads the same on-disk IndexedDB profile.
 context=await chromium.launchPersistentContext(profile,{headless:true});
 try {
  const page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  const result=await page.evaluate(async ({owner,count:expectedCount})=>{
   const api=MedControlT046IndexedEvents,start=performance.now();
   let after='',count=0,pages=0,last='',ordered=true;
   while(true){
    const p=await api.scanPage(owner,{after,limit:100});
    pages++;
    for(const row of p.rows){if(last&&row.id<=last)ordered=false;last=row.id;count++;}
    if(!p.next)break;
    after=p.next;
    if(pages>Math.ceil(expectedCount/100)+1)throw Error('Pagination loop');
   }
   return {count,pages,last,ordered,readMs:performance.now()-start};
  },{owner,count:COUNT});
  expect(result).toMatchObject({count:COUNT,pages:COUNT/100,last:'event-'+String(COUNT-1).padStart(8,'0'),ordered:true});
  const files=fs.readdirSync(profile,{recursive:true,withFileTypes:true});
  const indexed=files.filter(f=>f.name.endsWith('.indexeddb.leveldb')||f.name==='IndexedDB');
  expect(indexed.length).toBeGreaterThan(0);
  console.log('T046_D_PROFILE_VERIFIED '+JSON.stringify({profile,writeMs,...result,indexedDbDirectories:indexed.length}));
 }finally{await context.close();}
});
