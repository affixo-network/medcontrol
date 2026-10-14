/* Modular-3 shared protected write boundary. Opt-in only; no legacy overrides. */
(function(root){
 'use strict';
 const SESSION=root.MedControlModular3ProtectedSession;
 if(!SESSION)throw Error('Protected session dependency unavailable');
 const PAGES=Object.freeze(['input','action','dashboard','archive']);
 const KEY=SESSION.storageKey;
 let queue=Promise.resolve();
 function requirePage(page){if(!PAGES.includes(page))throw Error('Unknown protected page');}
 function protectedMode(){return SESSION.isUnlocked();}
 function read(page){requirePage(page);if(!protectedMode())throw Error('Protected session locked');return SESSION.read();}
 function write(page,mutator){
  requirePage(page);
  if(typeof mutator!=='function')return Promise.reject(Error('Mutation callback required'));
  const operation=queue.then(async()=>{
   if(!protectedMode())throw Error('Protected session locked');
   const before=localStorage.getItem(KEY);
   const result=await SESSION.transact(mutator);
   const persisted=localStorage.getItem(KEY);
   if(!persisted||persisted===before)throw Error('Encrypted checkpoint missing or unchanged');
   const record=JSON.parse(persisted);
   if(record.cipher!=='AES-256-GCM'||!record.ciphertext)throw Error('Invalid encrypted checkpoint');
   return result;
  });
  queue=operation.catch(()=>{});
  return operation;
 }
 const api=Object.freeze({pages:PAGES,enabled:protectedMode,read,write,storageKey:KEY});
 root.MedControlModular3WriteBoundary=api;
})(typeof window!=='undefined'?window:globalThis);
