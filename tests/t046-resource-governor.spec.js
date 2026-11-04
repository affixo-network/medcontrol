'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 resource governor bounds work and does not falsely acknowledge capacity',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-resource-governor.js')});
 const result=await page.evaluate(async()=>{
  let requested=0,release;
  const governor=window.MedControlT046ResourceGovernor.create({
   maxInFlight:1,maxBatchBytes:64,lowWatermarkBytes:100,
   requestCapacity:async({requiredBytes})=>{requested+=requiredBytes;}
  });
  const reserve=await governor.reserve({availableBytes:20,pendingBytes:10,estimatedWriteBytes:30});
  const running=governor.runBatch({bytes:64,task:()=>new Promise(resolve=>{release=resolve;})});
  await Promise.resolve();await Promise.resolve();
  const rejected=await governor.runBatch({bytes:1,task:async()=>true});
  release('completed');
  const completed=await running;
  return {reserve,requested,rejected,completed,stats:governor.stats()};
 });
 expect(result.reserve.admitted).toBe(false);
 expect(result.reserve.status).toBe('CAPACITY_UNAVAILABLE');
 expect(result.requested).toBeGreaterThan(0);
 expect(result.rejected).toEqual({started:false,reason:'BACKPRESSURE'});
 expect(result.completed).toEqual({started:true,result:'completed'});
 expect(result.stats.inFlight).toBe(0);
});
