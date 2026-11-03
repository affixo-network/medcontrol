'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');

test('T-046 bounded synthetic load: 1200 encrypted events, paging, reload and timings',async({page})=>{
 test.setTimeout(180000);
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
  await page.addScriptTag({path:path.join(ROOT,'js',name)});
 const owner='synthetic-load-'+Date.now()+'-'+Math.random();
 const password='Synthetic-T046-Load-Only-2026';
 const measured=await page.evaluate(async({owner,password})=>{
  const vault=await MedControlModular3ShardVault.create(owner,password);
  const total=1200,batchSize=100;
  const start=performance.now();
  for(let offset=0;offset<total;offset+=batchSize){
   const batch=Array.from({length:batchSize},(_,index)=>{
    const i=offset+index;
    return {id:'event-'+String(i).padStart(8,'0'),
     record:{eventId:i,medicationId:'synthetic-medication',status:'taken',timestamp:'2026-11-03T12:00:00Z'}};
   });
   await vault.createRecordsBatch(batch);
  }
  const writeMs=performance.now()-start;
  const readStart=performance.now();
  let after='',count=0,pages=0,checksum=0;
  while(true){
   const result=await vault.page({after,limit:100});
   for(const row of result.rows){count++;checksum+=row.record.eventId;}
   pages++;
   if(result.next===null)break;
   if(result.next===after)throw Error('Paging cursor did not advance');
   after=result.next;
  }
  const readMs=performance.now()-readStart;
  vault.lock();
  return {total,count,pages,checksum,writeMs,readMs};
 },{owner,password});
 expect(measured.count).toBe(measured.total);
 expect(measured.total).toBe(1200);
 expect(measured.checksum).toBe(1200*1199/2);
 expect(measured.writeMs).toBeGreaterThan(0);
 expect(measured.readMs).toBeGreaterThan(0);
 console.log('T-046 synthetic 1200 events timing (ms):',JSON.stringify(measured));
 await page.reload();
 for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
  await page.addScriptTag({path:path.join(ROOT,'js',name)});
 const reopened=await page.evaluate(async({owner,password})=>{
  const vault=await MedControlModular3ShardVault.open(owner,password);
  const first=await vault.page({limit:100});
  const last=await vault.getRecord('event-00001199');
  vault.lock();
  return {first:first.rows.length,last:last?.eventId};
 },{owner,password});
 expect(reopened).toEqual({first:100,last:1199});
});
