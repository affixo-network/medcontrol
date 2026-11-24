'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const base=path.join(__dirname,'..');
const password='synthetic-test-password';
const initial={settings:{interfaceLanguage:'ru',languageChoiceConfirmed:true,languageConfirmationVersion:1},medications:[{id:'synthetic-only'}],intakeLogs:[]};
function stale(error){
 assert.equal(error.code,'protected_session_changed');
 assert.equal(typeof error.expectedEntryEpoch,'number');
 assert.ok(error.actualEntryEpoch>error.expectedEntryEpoch);return true;
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function harness(){
 const storage=new Map(),cache=new Map();let pauseEncryption=null;
 const subtle=new Proxy(webcrypto.subtle,{get(target,key){
  const method=target[key];
  if(key==='encrypt')return async(...args)=>{const encrypted=await method.apply(target,args);if(pauseEncryption){const pause=pauseEncryption;pauseEncryption=null;pause.entered.resolve();await pause.release.promise;}return encrypted;};
  return typeof method==='function'?method.bind(target):method;
 }});
 const lockQueues=new Map();
 const context=vm.createContext({Intl,structuredClone,TextEncoder,TextDecoder,btoa,atob,
  crypto:{subtle,getRandomValues:webcrypto.getRandomValues.bind(webcrypto)},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  navigator:{locks:{request(name,options,callback){const result=(lockQueues.get(name)||Promise.resolve()).then(callback);lockQueues.set(name,result.catch(()=>{}));return result;}}},
  fetch:async url=>new Response(fs.readFileSync(path.join(base,url),'utf8')),
  caches:{open:async()=>({put:async(key,response)=>cache.set(key,response.clone()),match:async key=>cache.get(key)})}
 });
 for(const file of ['modular3-encrypted-vault.js','modular3-offline-credential.js','modular3-entry-languages.js','modular3-protected-session.js'])vm.runInContext(fs.readFileSync(path.join(base,'js',file),'utf8'),context);
 const session=context.MedControlModular3ProtectedSession,policy=context.MedControlEntryLanguages;
 await session.initialize(initial,password);
 return {session,policy,storage,vault:context.MedControlModular3EncryptedVault,pauseSeal(){const pause={entered:deferred(),release:deferred()};pauseEncryption=pause;return pause;}};
}
async function preserved(h,raw,expected=initial){
 assert.equal(h.session.isUnlocked(),true,'new unlock remains open');
 assert.equal(h.session.isEntryAuthorized(),false,'language work must not authorize entry');
 assert.deepEqual(h.session.read(),expected,'new session data preserved');
 assert.equal(h.storage.get(h.session.storageKey),raw,'ciphertext unchanged');
 assert.deepEqual(structuredClone(await h.vault.open(JSON.parse(raw),password)),expected);
}
test('confirmation paused during staging cannot commit into a later unlock',async()=>{
 const h=await harness(),entered=deferred(),release=deferred();h.session.authorizeEntry();
 let raw=h.storage.get(h.session.storageKey);
 const pending=h.policy.confirm(h.session,'fil',{stage:async()=>{entered.resolve();await release.promise;}});
 const rejected=assert.rejects(pending,stale);
 await entered.promise;await h.session.lock();await h.session.unlock(password);
 await h.session.transact(state=>{state.settings.timezone='UTC';});
 raw=h.storage.get(h.session.storageKey);const expected={...initial,settings:{...initial.settings,timezone:'UTC'}};
 release.resolve();await rejected;await preserved(h,raw,expected);
});
test('queued confirmation and restore capture their epoch before the queue runs',async()=>{
 const h=await harness(),entered=deferred(),release=deferred();
 const first=h.policy.confirm(h.session,'fil',{stage:async()=>{entered.resolve();await release.promise;}});
 const firstRejected=assert.rejects(first,stale);
 const secondRejected=assert.rejects(h.policy.confirm(h.session,'fr'),stale);
 const restoreRejected=assert.rejects(h.policy.restore(h.session),stale);
 await entered.promise;const raw=h.storage.get(h.session.storageKey);await h.session.lock();await h.session.unlock(password);release.resolve();
 await Promise.all([firstRejected,secondRejected,restoreRejected]);await preserved(h,raw);
});
test('restore paused during staging rejects results from a previous unlock',async()=>{
 const h=await harness(),entered=deferred(),release=deferred();
 const pending=h.policy.restore(h.session,{stage:async()=>{entered.resolve();await release.promise;}});
 const rejected=assert.rejects(pending,stale);
 await entered.promise;const raw=h.storage.get(h.session.storageKey);await h.session.lock();await h.session.unlock(password);release.resolve();await rejected;await preserved(h,raw);
});
test('confirmation invalidated during actual AES encryption never writes or locks the new unlock',async()=>{
 const h=await harness(),pause=h.pauseSeal();const raw=h.storage.get(h.session.storageKey);
 const rejected=assert.rejects(h.policy.confirm(h.session,'fil'),stale);
 await pause.entered.promise;const locking=h.session.lock();await h.session.unlock(password);pause.release.resolve();await rejected;await locking;await preserved(h,raw);
});
test('session epochs advance across initialize, lock, unlock, and checkpoint invalidation',async()=>{
 const h=await harness();assert.equal(typeof h.session.entryEpoch,'function');
 const initialized=h.session.entryEpoch();assert.ok(initialized>0);
 await h.session.lock();const locked=h.session.entryEpoch();assert.ok(locked>initialized);
 await h.session.unlock(password);const unlocked=h.session.entryEpoch();assert.ok(unlocked>locked);
 h.storage.set(h.session.storageKey,'changed-by-synthetic-tab');
 await assert.rejects(h.session.transact(()=>{}),/another tab/);assert.ok(h.session.entryEpoch()>unlocked);assert.equal(h.session.isUnlocked(),false);
});
test('setup transactions remain allowed without entry authorization and optional guards reject stale tokens',async()=>{
 const h=await harness();assert.equal(h.session.isEntryAuthorized(),false);
 await h.session.transact(state=>{state.settings.timezone='UTC';});assert.equal(h.session.read().settings.timezone,'UTC');
 assert.equal(h.session.isEntryAuthorized(),false);
 assert.equal(typeof h.session.entryEpoch,'function');const epoch=h.session.entryEpoch();await h.session.lock();await h.session.unlock(password);
 await assert.rejects(h.session.transact(state=>{state.settings.timezone='stale';},{entryEpoch:epoch}),stale);
 assert.equal(h.session.read().settings.timezone,'UTC');assert.equal(h.session.isUnlocked(),true);
});
