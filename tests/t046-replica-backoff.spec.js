'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 retries pending jobs with bounded backoff and cancels timer on stop',async({page})=>{
 await page.clock.install();
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-retry.js')});
 await page.evaluate(()=>{
  window.__calls=0;
  window.MedControlT046ReplicaDrain={drain:async()=>{window.__calls++;return {confirmed:0,failed:1,remaining:1};}};
  window.__retry=window.MedControlT046ReplicaRetry.create(async()=>({}));
  window.__retry.start();
 });
 await expect.poll(()=>page.evaluate(()=>window.__calls)).toBe(1);
 await page.clock.runFor(999);
 expect(await page.evaluate(()=>window.__calls)).toBe(1);
 await page.clock.runFor(1);
 await expect.poll(()=>page.evaluate(()=>window.__calls)).toBe(2);
 await page.clock.runFor(1999);
 expect(await page.evaluate(()=>window.__calls)).toBe(2);
 await page.clock.runFor(1);
 await expect.poll(()=>page.evaluate(()=>window.__calls)).toBe(3);
 await page.evaluate(()=>window.__retry.stop());
 await page.clock.runFor(120000);
 expect(await page.evaluate(()=>window.__calls)).toBe(3);
});
