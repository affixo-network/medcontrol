'use strict';
// Bounded synthetic-only test. Persistent Chromium profile explicitly resides on D:.
const {test,expect,chromium}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const PROFILE_ROOT=process.env.T046_PROFILE_ROOT;
test('T-046 10K persistent IndexedDB on isolated D drive profile',async()=>{
 test.setTimeout(120000);
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
  writeMs=await page.evaluate(async owner=>{
   const api=MedControlT046IndexedEvents,token='a'.repeat(64),start=performance.now();
   const session=await api.openBatchSession();
   try{
    for(let offset=0;offset<10000;offset+=1000){
     const batch=Array.from({length:1000},(_,i)=>({
      id:'event-'+String(offset+i).padStart(8,'0'),
      envelope:{ciphertext:'synthetic-'+(offset+i)},tokens:[token]
     }));
     await session.insertBatch(owner,batch);
    }
   }finally{session.close();}
   return performance.now()-start;
  },owner);
 }finally{await context.close();}
 // A second Chromium process reads the same on-disk IndexedDB profile.
 context=await chromium.launchPersistentContext(profile,{headless:true});
 try {
  const page=context.pages()[0]||await context.newPage();
  await page.goto(url);
  await page.addScriptTag({path:script});
  const result=await page.evaluate(async owner=>{
   const api=MedControlT046IndexedEvents,start=performance.now();
   let after='',count=0,pages=0,last='',ordered=true;
   while(true){
    const p=await api.scanPage(owner,{after,limit:100});
    pages++;
    for(const row of p.rows){if(last&&row.id<=last)ordered=false;last=row.id;count++;}
    if(!p.next)break;
    after=p.next;
    if(pages>101)throw Error('Pagination loop');
   }
   return {count,pages,last,ordered,readMs:performance.now()-start};
  },owner);
  expect(result).toMatchObject({count:10000,pages:100,last:'event-00009999',ordered:true});
  const files=fs.readdirSync(profile,{recursive:true,withFileTypes:true});
  const indexed=files.filter(f=>f.name.endsWith('.indexeddb.leveldb')||f.name==='IndexedDB');
  expect(indexed.length).toBeGreaterThan(0);
  console.log('T046_D_PROFILE_VERIFIED '+JSON.stringify({profile,writeMs,...result,indexedDbDirectories:indexed.length}));
 }finally{await context.close();}
});
