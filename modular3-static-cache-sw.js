/* Modular-3 offline application shell. Medical data and credentials are never cached. */
'use strict';
const VERSION='medcontrol-static-modular3-v15';
const PAGES=['/input.html','/action.html','/dashboard.html','/archive.html','/modular3-protected.html'];
const CORE=['/js/auth-guard.js','/js/modular3-script-loader.js','/js/modular3-encrypted-vault.js','/js/modular3-offline-credential.js','/js/modular3-protected-session.js','/js/modular3-course-lifecycle-browser.js','/js/modular3-protected-pages.js','/js/modular3-write-boundary.js','/js/modular3-final-intake.js','/js/modular3-copy-migration.js','/js/modular3-protected-workspace.js'];
const PUBLIC_LOCALES=['/locales/source-ru.json','/locales/catalogs/en.json'];
const allowed=path=>PAGES.includes(path)||/^\/js\/[a-zA-Z0-9._/-]+\.js$/.test(path)||path==='/core.js'||path==='/locales/source-ru.json'||/^\/locales\/catalogs\/[a-z]{2,3}(?:-[a-z]{2,4})?\.json$/.test(path);
async function fetchAndCache(cache,path){
 const response=await fetch(path,{cache:'reload',credentials:'same-origin'});
 if(!response.ok||response.type!=='basic')throw Error('Offline asset unavailable: '+path);
 await cache.put(path,response.clone());
}
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(async cache=>{
  await Promise.all([...PAGES,...CORE,...PUBLIC_LOCALES].map(path=>fetchAndCache(cache,path)));
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('medcontrol-static-modular3-')&&name!==VERSION).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type!=='MEDCONTROL_CACHE_SHELL')return;
 const paths=Array.isArray(event.data.paths)?event.data.paths.filter(path=>typeof path==='string'&&allowed(path)):[];
 event.waitUntil((async()=>{
  try{
   const cache=await caches.open(VERSION);
   await Promise.all(paths.map(path=>fetchAndCache(cache,path)));
   event.ports?.[0]?.postMessage({ok:true});
  }catch(error){event.ports?.[0]?.postMessage({ok:false,error:String(error)});}
 })());
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!allowed(url.pathname))return;
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
