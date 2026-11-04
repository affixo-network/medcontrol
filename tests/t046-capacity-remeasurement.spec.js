'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 expansion only admits writes after authoritative capacity remeasurement',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-resource-governor.js')});
 const result=await page.evaluate(async()=>{
  let available=10,requests=0;
  const governor=window.MedControlT046ResourceGovernor.create({
   lowWatermarkBytes:100,
   requestCapacity:async()=>{requests++;available=200;},
   measureCapacity:async()=>available
  });
  const admitted=await governor.reserve({availableBytes:10,estimatedWriteBytes:50});
  available=0;
  const refused=await governor.reserve({availableBytes:200,estimatedWriteBytes:50});
  return {admitted,refused,requests};
 });
 expect(result.admitted.admitted).toBe(true);
 expect(result.refused.admitted).toBe(false);
 expect(result.requests).toBe(1);
});
