'use strict';
const {test,expect}=require('@playwright/test');
test('production static service worker caches JavaScript and serves it during network loss without caching medical state',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/input.html');
 await page.evaluate(async()=>{
  const registration=await navigator.serviceWorker.register('/js/modular3-static-cache-sw.js',{scope:'/'});
  await registration.update();
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 });
 await expect.poll(()=>page.evaluate(async()=>Boolean(await caches.match('/js/storage.js')))).toBe(true);
 const names=await page.evaluate(()=>caches.keys());
 expect(names.some(name=>name.startsWith('medcontrol-static-modular3-'))).toBe(true);
 await context.setOffline(true);
 const cached=await page.evaluate(async()=>{
  const response=await fetch('/js/storage.js?v=offline-cache-verification');
  return {ok:response.ok,text:await response.text()};
 });
 expect(cached.ok).toBe(true);
 expect(cached.text).toContain('STORAGE_KEY');
 const denied=await page.evaluate(async()=>{
  try{await fetch('/rest/v1/mc_cloud_snapshots');return false;}catch(_){return true;}
 });
 expect(denied).toBe(true);
 const cacheKeys=await page.evaluate(async()=>{
  const names=await caches.keys();const keys=[];
  for(const name of names)if(name.startsWith('medcontrol-static-modular3-')){
   const cache=await caches.open(name);keys.push(...(await cache.keys()).map(req=>new URL(req.url).pathname));
  }
  return keys;
 });
 expect(cacheKeys.every(path=>path.startsWith('/js/')&&path.endsWith('.js'))).toBe(true);
 await context.close();
});
