/* Experimental test-only service worker. Never registered by production pages. */
'use strict';
const CACHE='medcontrol-modular3-offline-proof-v1';
const ASSETS=['/tests/modular3-offline-proof.html','/js/storage.js','/js/utils.js','/js/intake.js','/js/schedule.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 if(!ASSETS.includes(url.pathname))return;
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
