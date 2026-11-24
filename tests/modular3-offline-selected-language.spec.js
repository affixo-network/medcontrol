'use strict';
const {test,expect}=require('@playwright/test');
const BASE=process.env.MEDCONTROL_OFFLINE_BASE||'http://127.0.0.1:8765';
async function cacheShell(page,paths){
 return page.evaluate(async paths=>{
  await navigator.serviceWorker.ready;
  const registration=await navigator.serviceWorker.getRegistration('/');
  const channel=new MessageChannel();
  const result=new Promise(resolve=>{channel.port1.onmessage=event=>resolve(event.data);});
  registration.active.postMessage({type:'MEDCONTROL_CACHE_SHELL',paths},[channel.port2]);
  return result;
 },paths);
}
test('a complete selected-language shell can be verified offline; absent or corrupt assets fail',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  await page.goto(BASE+'/modular3-protected.html');
  await page.evaluate(async()=>{
   await navigator.serviceWorker.register('/modular3-static-cache-sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
  });
  const paths=['/input.html','/action.html','/dashboard.html','/archive.html','/js/storage.js','/locales/source-ru.json','/locales/catalogs/fil.json'];
  expect((await cacheShell(page,paths)).ok).toBe(true);
  await context.setOffline(true);
  expect((await cacheShell(page,paths)).ok,'existing valid selected-language shell is offline-ready').toBe(true);
  await page.evaluate(async()=>{
   const cache=await caches.open('medcontrol-static-modular3-v16');
   window.savedFil=await cache.match('/locales/catalogs/fil.json');
   await cache.delete('/locales/catalogs/fil.json');
  });
  expect((await cacheShell(page,paths)).ok,'missing selected catalog is not offline-ready').toBe(false);
  await page.evaluate(async()=>{
   const cache=await caches.open('medcontrol-static-modular3-v16');
   await cache.put('/locales/catalogs/fil.json',new Response('{broken',{headers:{'Content-Type':'application/json'}}));
  });
  expect((await cacheShell(page,paths)).ok,'corrupt selected catalog is not offline-ready').toBe(false);
  await page.evaluate(async()=>{
   const cache=await caches.open('medcontrol-static-modular3-v16');
   await cache.put('/locales/catalogs/fil.json',await cache.match('/locales/catalogs/en.json'));
  });
  expect((await cacheShell(page,paths)).ok,'a valid catalog for the wrong language is not offline-ready').toBe(false);
  await page.evaluate(async()=>{
   const cache=await caches.open('medcontrol-static-modular3-v16');
   await cache.put('/locales/catalogs/fil.json',window.savedFil);
   await cache.delete('/dashboard.html');
  });
  expect((await cacheShell(page,['/locales/catalogs/fil.json'])).ok,'a missing required medical page is not offline-ready').toBe(false);
 }finally{await context.close();}
});
test('offline cached Filipino medical shell recovers readiness and caches the changed language online',async({browser})=>{
 test.setTimeout(90000);
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  await page.goto(BASE+'/modular3-protected.html');
  await page.locator('#password').fill('Synthetic-Offline-Language-2026');
  await page.locator('#enroll').click();
  await page.locator('#confirm-password').fill('Synthetic-Offline-Language-2026');
  await page.locator('#enroll').click();
  await page.locator('#entry-language').selectOption('fil');
  await page.locator('#confirm-entry-language').click();
  await page.locator('#unlock').click();
  await expect(page).toHaveURL(BASE+'/input.html');
  await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(BASE+'/modular3-protected.html');
  await page.locator('#password').fill('Synthetic-Offline-Language-2026');
  await page.locator('#unlock').click();
  await expect(page).toHaveURL(BASE+'/input.html');
  for(const section of ['action','dashboard','archive','input']){
   await page.locator('.topbar .nav a[href="'+section+'.html"]').click();
   await expect(page.locator('html')).toHaveAttribute('lang','fil');
   await expect(page.locator('.topbar')).toBeVisible();
   await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true,null,{timeout:10000});
  }
  await context.setOffline(false);
  await page.locator('.topbar select[onchange*="changeInterfaceLanguage"]').selectOption('ka');
  await expect(page.locator('html')).toHaveAttribute('lang','ka');
  await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true,null,{timeout:15000});
  expect(await page.evaluate(async()=>Boolean(await caches.match('/locales/catalogs/ka.json')))).toBe(true);
  await context.setOffline(true);
  await page.locator('.topbar .nav a[href="action.html"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ka');
  await page.waitForFunction(()=>window.medcontrolOfflineShellReady===true,null,{timeout:10000});
 }finally{await context.close();}
});
