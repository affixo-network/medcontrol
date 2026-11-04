'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 retry controller starts on online and coalesces concurrent runs',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-retry.js')});
 const result=await page.evaluate(async()=>{
  let calls=0;
  const releases=[];
  window.MedControlT046ReplicaDrain={drain:async()=>{
   calls++;
   await new Promise(resolve=>releases.push(resolve));
   return {confirmed:1};
  }};
  const waitForCalls=async target=>{
   for(let i=0;i<200&&calls<target;i++)await new Promise(resolve=>setTimeout(resolve,5));
   if(calls!==target)throw Error('Drain did not start: '+target+' actual '+calls);
  };
  const retry=window.MedControlT046ReplicaRetry.create(async()=>({}));
  const first=retry.run(),second=retry.run();
  await waitForCalls(1);
  const during=calls;
  releases.shift()();
  const both=await Promise.all([first,second]);
  retry.start();
  await waitForCalls(2);
  releases.shift()();
  await new Promise(resolve=>setTimeout(resolve,0));
  const afterStart=calls;
  window.dispatchEvent(new Event('online'));
  await waitForCalls(3);
  releases.shift()();
  await new Promise(resolve=>setTimeout(resolve,0));
  const afterOnline=calls;
  retry.dispose();
  window.dispatchEvent(new Event('online'));
  await new Promise(resolve=>setTimeout(resolve,0));
  return {during,both,afterStart,afterOnline,afterDispose:calls};
 });
 expect(result).toEqual({during:1,both:[{confirmed:1},{confirmed:1}],afterStart:2,afterOnline:3,afterDispose:3});
});
