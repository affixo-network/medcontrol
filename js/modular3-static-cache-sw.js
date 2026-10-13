/* Modular-3 static asset cache. No API, HTML, authentication or medical records are cached. */
'use strict';
const VERSION='medcontrol-static-modular3-v1';
const CORE=['/js/auth-guard.js','/js/modular3-script-loader.js','/js/translations.js','/js/storage.js','/js/utils.js','/js/schedule.js','/js/intake.js','/js/render.js','/js/navigation.js'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(async cache=>{
  await Promise.allSettled(CORE.map(async path=>{
   const response=await fetch(path,{cache:'reload',credentials:'same-origin'});
   if(response.ok&&response.type==='basic')await cache.put(path,response);
  }));
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('medcontrol-static-modular3-')&&name!==VERSION).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||req.mode==='navigate')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!/^\/js\/[a-zA-Z0-9._/-]+\.js$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  try{
   const response=await fetch(req);
   if(response.ok&&response.type==='basic')await cache.put(url.pathname,response.clone());
   return response;
  }catch(error){
   const cached=await cache.match(url.pathname);
   if(cached)return cached;
   throw error;
  }
 })());
});
