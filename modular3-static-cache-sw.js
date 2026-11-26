/* Modular-3 offline application shell. Medical data and credentials are never cached. */
'use strict';
const VERSION='medcontrol-static-modular3-v16';
const PAGES=['/input.html','/action.html','/dashboard.html','/archive.html','/modular3-protected.html'];
const CORE=['/js/modular3-system-dialog-messages.js','/js/modular3-action-help.js','/js/modular3-protected-locale-controller.js','/js/modular3-entry-languages.js','/js/auth-guard.js','/js/modular3-script-loader.js','/js/modular3-encrypted-vault.js','/js/modular3-offline-credential.js','/js/modular3-protected-session.js','/js/modular3-course-lifecycle-browser.js','/js/modular3-protected-pages.js','/js/modular3-write-boundary.js','/js/modular3-final-intake.js','/js/modular3-copy-migration.js','/js/modular3-protected-workspace.js'];
const PUBLIC_LOCALES=['/locales/source-ru.json','/locales/catalogs/en.json'];
const allowed=path=>PAGES.includes(path)||/^\/js\/[a-zA-Z0-9._/-]+\.js$/.test(path)||path==='/core.js'||path==='/locales/source-ru.json'||/^\/locales\/catalogs\/[a-z]{2,3}(?:-[a-z]{2,4})?\.json$/.test(path);
async function validAsset(response,path){
 if(!response?.ok||response.type!=='basic')return false;
 const text=await response.clone().text();
 if(!text.trim())return false;
 const type=response.headers.get('content-type')||'';
 if(path.endsWith('.json')){
  if(!/application\/json/i.test(type))return false;
  try{
   const data=JSON.parse(text);
   if(path==='/locales/source-ru.json')return Object.keys(data).length===639&&Object.values(data).every(row=>typeof row?.source==='string'&&row.source.trim());
   const code=path.split('/').pop().replace('.json','');
   return data.language===code&&Object.keys(data.messages||{}).length===639&&Object.values(data.messages).every(value=>typeof value==='string'&&value.trim());
  }catch(_){return false;}
 }
 return path.endsWith('.html')?/text\/html/i.test(type)&&/<html[\s>]/i.test(text)&&/<\/html>/i.test(text):/(?:javascript|ecmascript)/i.test(type);
}
async function fetchAndCache(cache,path,allowCached=false){
 let response;
 try{response=await fetch(path,{cache:'reload',credentials:'same-origin'});}
 catch(error){
  // A disconnected page can re-verify its existing complete public shell.
  // Missing, empty, wrong-type or malformed cached resources must still fail.
  if(allowCached&&await validAsset(await cache.match(path),path))return;
  throw error;
 }
 if(!await validAsset(response,path))throw Error('Offline asset unavailable: '+path);
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
   const required=[...new Set([...PAGES,...CORE,...PUBLIC_LOCALES,...paths])];
   await Promise.all(required.map(path=>fetchAndCache(cache,path,true))); 
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
