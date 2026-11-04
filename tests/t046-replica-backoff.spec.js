'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 retries pending jobs with bounded backoff and cancels timer on stop',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-replica-retry.js')});
 const result=await page.evaluate(async()=>{
  const originalSet=window.setTimeout,originalClear=window.clearTimeout;
  const timers=new Map();
  let nextId=1,calls=0;
  window.setTimeout=(callback,delay)=>{const id=nextId++;timers.set(id,{callback,delay});return id;};
  window.clearTimeout=id=>timers.delete(id);
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const fire=async()=>{
   const [id,timer]=timers.entries().next().value;
   timers.delete(id);timer.callback();
   await settle();
  };
  try{
   window.MedControlT046ReplicaDrain={drain:async()=>{calls++;return {confirmed:0,failed:1,remaining:1};}};
   const retry=window.MedControlT046ReplicaRetry.create(async()=>({}));
   retry.start();await settle();
   const first={calls,delays:[...timers.values()].map(t=>t.delay)};
   await fire();
   const second={calls,delays:[...timers.values()].map(t=>t.delay)};
   await fire();
   const third={calls,delays:[...timers.values()].map(t=>t.delay)};
   retry.stop();
   const stopped={calls,pending:timers.size};
   retry.dispose();
   return {first,second,third,stopped};
  }finally{
   window.setTimeout=originalSet;
   window.clearTimeout=originalClear;
  }
 });
 expect(result).toEqual({
  first:{calls:1,delays:[1000]},
  second:{calls:2,delays:[2000]},
  third:{calls:3,delays:[4000]},
  stopped:{calls:3,pending:0}
 });
});
