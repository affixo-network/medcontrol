'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 only one tab drains while shared Web Lock is held',async({browser})=>{
 const context=await browser.newContext();
 const a=await context.newPage(),b=await context.newPage();
 for(const page of [a,b]){
  await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-retry.js')});
  await page.evaluate(()=>{
   window.__calls=0;
   window.MedControlT046ReplicaDrain={drain:async()=>{window.__calls++;await new Promise(r=>window.__release=r);return {confirmed:1};}};
   window.__retry=window.MedControlT046ReplicaRetry.create(async()=>({}));
  });
 }
 const first=a.evaluate(()=>window.__retry.run());
 await a.waitForFunction(()=>window.__calls===1);
 const competing=await b.evaluate(()=>window.__retry.run());
 expect(competing).toEqual({busy:true});
 expect(await b.evaluate(()=>window.__calls)).toBe(0);
 await a.evaluate(()=>window.__release());
 expect(await first).toEqual({confirmed:1});
 const second=b.evaluate(()=>window.__retry.run());
 await b.waitForFunction(()=>window.__calls===1);
 await b.evaluate(()=>window.__release());
 expect(await second).toEqual({confirmed:1});
 await context.close();
});
