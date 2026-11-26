'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const policyPath=path.join(__dirname,'../js/modular3-entry-languages.js');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/source-ru.json'),'utf8'));
function harness(options={}){
 const entries=new Map(),fetches=[];
 const context={localStorage:options.storage,module:{exports:{}},Intl,fetch:()=>{},caches:{has:async()=>entries.size>0,open:async()=>({
  put:async(key,response)=>{if(options.cacheError)throw Error('cache denied');entries.set(key,response.clone());},
  match:async key=>options.cacheMissing?undefined:entries.get(key)
 })}};
 vm.runInNewContext(fs.readFileSync(policyPath,'utf8'),context);
 const fetcher=async url=>{
  fetches.push(url);
  if(options.fetchError)throw Error('fetch denied');
  const file=path.join(__dirname,'..',url);
  const body=JSON.parse(fs.readFileSync(file,'utf8'));
  if(options.invalid&&body.messages)delete body.messages[Object.keys(body.messages)[0]];
  return new Response(JSON.stringify(body),{status:options.unavailable?503:200});
 };
 return {policy:context.module.exports,fetcher,entries,fetches};
}
function session(initial={settings:{timezone:'UTC'},medications:[{id:'synthetic-only'}],intakeLogs:[]}){
 let state=structuredClone(initial);let writes=0;let authorizations=0;
 return {read:()=>structuredClone(state),isUnlocked:()=>true,
  transact:async fn=>{const next=structuredClone(state);await fn(next);state=next;writes++;},
  authorizeEntry:()=>{authorizations++;},get writes(){return writes;},get authorizations(){return authorizations;}};
}
// Separate fixture avoids any product-specific storage or medical data.
function makeSession(initial){const s=session(initial);return s;}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
test('resolves valid region/script/Unicode/private tags and aliases only into canonical registry',()=>{
 const {policy:p}=harness();
 for(const [tag,expected] of [['en-u-ca-gregory','en'],['ar-Arab-EG-u-nu-arab','ar'],['fil-PH-x-demo','fil'],['tl_PH','fil'],['iw-IL','he'],['ji','yi'],['in-ID','id'],['nb-NO','no'],['nn-NO','no'],['zh-Hant-TW','zh'],['sr-Latn-RS','sr']])assert.equal(p.resolve(tag),expected,tag);
 for(const tag of ['en-u','en-x','en--US','../en','xx-u-ca-gregory','not-a-real-code'])assert.equal(p.resolve(tag),null,tag);
});
test('confirmation prepares real assets, stages before commit, changes only three settings, never authorizes',async()=>{
 const {policy:p,fetcher,entries}=harness();const s=makeSession();const before=s.read();
 const prepared=await p.confirm(s,'fil',{fetcher,stage:async value=>{assert.equal(s.writes,0);assert.equal(value.code,'fil');assert.ok(entries.has('/locales/catalogs/fil.json'));}});
 assert.equal(prepared.code,'fil');assert.equal(s.writes,1);assert.equal(s.authorizations,0);
 assert.deepEqual(s.read(),{...before,settings:{...before.settings,interfaceLanguage:'fil',languageChoiceConfirmed:true,languageConfirmationVersion:1}});
});
test('preparation/cache/staging/write failures preserve encrypted state',async()=>{
 for(const mode of ['fetchError','unavailable','invalid','cacheError','cacheMissing','stageFalse','stageError','writeError']){
  const {policy:p,fetcher}=harness({[mode]:true});const s=makeSession();const before=s.read();
  if(mode==='writeError')s.transact=async()=>{throw Error('write denied');};
  await assert.rejects(()=>p.confirm(s,'fr',{fetcher,stage:async()=>{if(mode==='stageError')throw Error('stage denied');return mode!=='stageFalse';}}),undefined,mode);
  assert.deepEqual(s.read(),before,mode);assert.equal(s.authorizations,0);
 }
});
test('captures exact code and serializes competing confirmations per session',async()=>{
 const {policy:p,fetcher}=harness();const s=makeSession();const blocked=deferred(),entered=deferred();const order=[];
 let selected='fr';
 const first=p.confirm(s,selected,{fetcher,stage:async value=>{order.push(value.code);entered.resolve();await blocked.promise;}});
 selected='de';const second=p.confirm(s,selected,{fetcher,stage:async value=>{order.push(value.code);assert.equal(s.read().settings.interfaceLanguage,'fr');}});
 await entered.promise;assert.deepEqual(order,['fr']);assert.equal(s.writes,0);blocked.resolve();
 assert.equal((await first).code,'fr');assert.equal((await second).code,'de');assert.deepEqual(order,['fr','de']);assert.equal(s.read().settings.interfaceLanguage,'de');
});
test('rejected queued confirmation does not poison following confirmation or block other sessions',async()=>{
 const {policy:p,fetcher}=harness();const s=makeSession();const blocked=deferred(),entered=deferred();
 const first=p.confirm(s,'fr',{fetcher,stage:async()=>{entered.resolve();await blocked.promise;throw Error('stage denied');}});
 const rejection=assert.rejects(first,/stage denied/);const second=p.confirm(s,'de',{fetcher});
 await entered.promise;await p.confirm(makeSession(),'fil',{fetcher});blocked.resolve();await rejection;await second;assert.equal(s.read().settings.interfaceLanguage,'de');
});
test('rejects noncanonical confirmation and invalid saved settings without fetching or writing',async()=>{
 const {policy:p,fetcher,fetches}=harness();
 for(const code of ['tl','en-US','xx',null,{},' en'])await assert.rejects(()=>p.confirm(makeSession(),code,{fetcher}));
 for(const settings of [{},{interfaceLanguage:'xx',languageChoiceConfirmed:true,languageConfirmationVersion:1},{interfaceLanguage:'en-US',languageChoiceConfirmed:true,languageConfirmationVersion:1},{interfaceLanguage:'fr',languageChoiceConfirmed:true},{interfaceLanguage:'fr',languageChoiceConfirmed:false,languageConfirmationVersion:1}]){
  const s=makeSession({settings});await assert.rejects(()=>p.restore(s,{fetcher}));assert.equal(s.writes,0);
 }
 assert.equal(fetches.length,0);
});
test('restore stages verified saved language without writes and rejects staging failure',async()=>{
 const {policy:p,fetcher}=harness();const s=makeSession({settings:{interfaceLanguage:'ar',languageChoiceConfirmed:true,languageConfirmationVersion:1},medications:[{id:'synthetic-only'}]});const before=s.read();
 assert.equal((await p.restore(s,{fetcher,stage:async value=>assert.equal(value.code,'ar')})).code,'ar');
 await assert.rejects(()=>p.restore(s,{fetcher,stage:async()=>false}));assert.deepEqual(s.read(),before);assert.equal(s.writes,0);assert.equal(s.authorizations,0);
});
test('validated maps and source are immutable snapshots of caller-owned objects',()=>{
 const {policy:p}=harness();const input=structuredClone(source);const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/catalogs/fr.json'),'utf8'));const id=Object.keys(source)[0],original=source[id].source;
 const prepared=p.validate(input,catalog,'fr'),translated=prepared.messages[id];
 input[id].source='changed';input[id].files.push('changed');catalog.messages[id]='changed';
 assert.equal(prepared.source[id].source,original);assert.equal(prepared.messages[id],translated);assert.equal(p.translate(prepared,original),translated);assert.ok(Object.isFrozen(prepared.lookup));assert.ok(Object.isFrozen(prepared.source[id].files));
 const russianInput=structuredClone(source),ru=p.validate(russianInput,null,'ru');russianInput[id].source='changed';assert.equal(ru.source[id].source,original);
});
test('identical confirmation still verifies assets and stage but avoids an encrypted rewrite',async()=>{
 const {policy:p,fetcher,fetches}=harness();const s=makeSession({settings:{interfaceLanguage:'ru',languageChoiceConfirmed:true,languageConfirmationVersion:1,timezone:'UTC'}});let staged=0;
 const prepared=await p.confirm(s,'ru',{fetcher,stage:async()=>{staged++;}});
 assert.equal(prepared.code,'ru');assert.equal(staged,1);assert.equal(fetches.length,1);assert.equal(s.writes,0);
});
test('restore waits for an earlier confirmation and restores the committed canonical language',async()=>{
 const {policy:p,fetcher}=harness();const s=makeSession();const blocked=deferred(),entered=deferred();
 const first=p.confirm(s,'fil',{fetcher,stage:async()=>{entered.resolve();await blocked.promise;}});
 const restored=p.restore(s,{fetcher});await entered.promise;assert.equal(s.writes,0);blocked.resolve();await first;
 assert.equal((await restored).code,'fil');assert.equal(s.writes,1);assert.equal(s.authorizations,0);
});

test('display hint accepts only canonical codes bound to an existing credential and ciphertext',()=>{
 const {policy:p}=harness();const values=new Map();const storage={getItem:key=>values.has(key)?values.get(key):null};
 const set=hint=>values.set(p.displayKey,JSON.stringify(hint));
 set({version:1,code:'en',salt:null});assert.equal(p.readDisplayLanguage(storage),null);
 const salt='a'.repeat(32);values.set('medcontrol_modular3_protected_state_v1','synthetic-cipher');values.set('medcontrol_modular3_local_credential_v1',JSON.stringify({version:1,salt,verifier:'synthetic'}));
 for(const language of p.registry){set({version:1,code:language.code,salt});assert.equal(p.readDisplayLanguage(storage),language.code);}
 for(const hint of [{version:1,code:'en-US',salt},{version:1,code:'../en',salt},{version:2,code:'en',salt},{version:1,code:'en',salt:'b'.repeat(32)}]){set(hint);assert.equal(p.readDisplayLanguage(storage),null);}
 values.set(p.displayKey,'{bad');assert.equal(p.readDisplayLanguage(storage),null);
 assert.equal(p.readDisplayLanguage({getItem(){throw Error('storage blocked');}}),null);
});
test('display hint staging failure preserves protected choice; failed finalization stays pending',async()=>{
 const values=new Map([['medcontrol_modular3_protected_state_v1','synthetic-cipher'],['medcontrol_modular3_local_credential_v1',JSON.stringify({version:1,salt:'a'.repeat(32)})]]);
 let mode='ok';const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(mode==='before')throw Error('synthetic pre-write failure');if(mode==='final'&&!JSON.parse(value).pending)throw Error('synthetic final write failure');values.set(key,value);if(mode==='after')throw Error('synthetic post-write failure');}};
 const {policy:p,fetcher}=harness({storage});const s=makeSession();
 await p.confirm(s,'ar',{fetcher});assert.equal(p.readDisplayLanguage(storage),'ar');
 mode='before';await assert.rejects(p.confirm(s,'fil',{fetcher}));assert.equal(s.read().settings.interfaceLanguage,'ar');assert.equal(p.readDisplayLanguage(storage),'ar');
 mode='after';await assert.rejects(p.confirm(s,'fil',{fetcher}));assert.equal(s.read().settings.interfaceLanguage,'ar');assert.equal(p.readDisplayLanguage(storage),null);assert.equal(p.displayPending(storage),true);
 mode='ok';await p.restore(s,{fetcher});assert.equal(p.readDisplayLanguage(storage),'ar');
 mode='final';await p.confirm(s,'fil',{fetcher});assert.equal(s.read().settings.interfaceLanguage,'fil');assert.equal(p.readDisplayLanguage(storage),null);assert.equal(p.displayPending(storage),true);assert.equal(s.authorizations,0);
 mode='ok';await p.restore(s,{fetcher});assert.equal(p.readDisplayLanguage(storage),'fil');
 const before=values.get(p.displayKey);const other=harness({storage,fetchError:true});await assert.rejects(other.policy.confirm(s,'en',{fetcher:other.fetcher}));assert.equal(values.get(p.displayKey),before);assert.equal(s.read().settings.interfaceLanguage,'fil');
});

test('locked display validates cached assets without fetching or writing caches',async()=>{
 const {policy:p,fetcher,entries}=harness();
 await p.prepare('ar',fetcher);const before=[...entries.keys()];
 const prepared=await p.prepareDisplay('ar',async()=>{throw Error('network must not be needed');});assert.equal(prepared.code,'ar');assert.deepEqual([...entries.keys()],before);
 const readonly=harness();const display=await readonly.policy.prepareDisplay('fil',readonly.fetcher);assert.equal(display.code,'fil');assert.equal(readonly.entries.size,0,'Network display must not write a cache');
});
