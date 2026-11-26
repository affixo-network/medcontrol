'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/modular3-script-loader.js'),'utf8');
const policy=fs.readFileSync(path.join(root,'js/modular3-entry-languages.js'),'utf8');
const overlay=fs.readFileSync(path.join(root,'js/modular3-protected-locale-controller.js'),'utf8');

function harness({vault=false,authorized=false,confirmed=true,failCatalog=false,failStage=false,failAdministrative=false,holdStage=false,page='input'}={}){
 const scripts=[],redirects=[],events=[];
 const result={mounted:[],authCalls:0,clientCalls:0,locked:0,fetches:[],stageStarted:false,cacheWrites:[]};
 const synthetic={settings:{interfaceLanguage:'fil',languageChoiceConfirmed:confirmed,languageConfirmationVersion:1},medications:[{id:'synthetic-course',name:'Synthetic medication'}],intakeLogs:[]};
 const original=JSON.stringify(synthetic);
 const storage={'sb-lewdbjjaohqxbirzhrbm-auth-token':JSON.stringify({access_token:'fake',refresh_token:'fake',user:{id:'synthetic-user'},expires_at:9999999999})};
 if(vault){storage.medcontrol_modular3_local_credential_v1='synthetic';storage.medcontrol_modular3_protected_state_v1='synthetic encrypted fixture';}
 const app={textContent:'',innerHTML:''};
 const cache=new Map();
 let releaseStage;
 const gate=holdStage?new Promise(resolve=>{releaseStage=resolve;}):Promise.resolve();
 const doc={scripts:[],documentElement:{lang:'ru',dir:'ltr'},title:'',currentScript:{dataset:{page}},
  head:{querySelectorAll:()=>[],appendChild(element){if(element.tagName!=='script')return;scripts.push(element.src);const scriptPath=element.src.split('?')[0];
   if(scriptPath==='js/modular3-script-loader.js')vm.runInContext(loader,ctx);
   if(scriptPath==='js/modular3-protected-locale-controller.js')vm.runInContext(overlay,ctx);
   if(scriptPath==='js/modular3-system-dialog-messages.js'){if(failAdministrative){queueMicrotask(()=>element.onerror?.());return;}vm.runInContext(fs.readFileSync(path.join(root,scriptPath),'utf8'),ctx);}
   if(scriptPath==='js/navigation.js')ctx.mount=async section=>{events.push('mount');assert.ok(result.cacheWrites.includes('/locales/catalogs/fil.json'),'Medical mount requires verified offline selected catalog');assert.ok(ctx.window.MedControlProtectedUiCatalogs.fil,'Medical mount requires staged selected catalog');result.mounted.push(section);};
   queueMicrotask(()=>element.onload?.());}},
  createElement:tag=>({tagName:tag,src:'',onload:null,onerror:null}),getElementById:id=>id==='app'?app:null,
  querySelector:()=>null,querySelectorAll:()=>[]};
 const window={location:{pathname:'/'+page+'.html',href:'https://medcontrol.test/'+page+'.html',replace:url=>redirects.push(url)},history:{pushState(){}},
  MedControlModular3ProtectedSession:{transact:async()=>assert.fail('Startup restoration cannot write clinical state'),isUnlocked:()=>vault,isEntryAuthorized:()=>authorized,read:()=>structuredClone(synthetic),lock:async()=>{authorized=false;result.locked++;events.push('lock');}},MedControlModular3ProtectedPages:{},
  caches:{open:async()=>({put:async(key,value)=>{result.cacheWrites.push(key);cache.set(key,value);},match:async key=>cache.get(key)})},
  fetch:async url=>{result.fetches.push(url);if(failCatalog&&url.includes('/catalogs/'))return new Response('',{status:503});return new Response(fs.readFileSync(path.join(root,url.replace(/^\//,'')),'utf8'),{status:200});},
  MedControlLocaleBootstrap:{install:async({language})=>{result.stageStarted=true;events.push('stage');await gate;if(failStage)return false;ctx.TRANSLATIONS[language]={nav_archive:'Arkibo'};window.MedControlProtectedUiCatalogs={[language]:{'Не удалось запустить MedControl. Локальные данные не удалялись.':'Synthetic localized failure'}};events.push('stage-ready');return true;}},
  __testImport:async()=>({createClient:()=>{result.clientCalls++;return {auth:{getSession:async()=>{result.authCalls++;return {data:{session:{user:{id:'synthetic'}}}};}}};}})};
 const ctx=vm.createContext({window,document:doc,navigator:{},TRANSLATIONS:{ru:{},en:{}},getState:()=>window.MedControlModular3ProtectedSession.read(),registerPreparedLanguage:()=>true,
  localStorage:{getItem:key=>storage[key]??null,setItem(){assert.fail('Startup cannot mutate encrypted state');},removeItem(){assert.fail('Startup cannot delete data');}},
  URL,URLSearchParams,Response,Date,Promise,Set,Map,structuredClone,console:{error(){}},setTimeout,queueMicrotask,MutationObserver:class{observe(){}disconnect(){}takeRecords(){return [];}}});
 vm.runInContext(policy,ctx);
 const run=()=>vm.runInContext(guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","window.__testImport()"),ctx);
 return {ctx,scripts,redirects,result,events,run,releaseStage:()=>releaseStage?.(),unchanged:()=>assert.equal(JSON.stringify(synthetic),original)};
}
async function waitFor(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1));}assert.fail('Timed out waiting for guard state');}
function noCloud(h){assert.equal(h.result.clientCalls,0);assert.equal(h.result.authCalls,0);assert.equal(h.ctx.window.medcontrolSupabaseUser,undefined);}
for(const page of ['input','action','dashboard','archive']){
 test(page+': no protected vault redirects despite fake fresh cloud session, without loading application scripts',async()=>{const h=harness({page});await h.run();assert.deepEqual(h.redirects,['/modular3-protected.html']);assert.equal(h.scripts.length,0);assert.equal(h.result.mounted.length,0);noCloud(h);h.unchanged();});
 test(page+': unlocked storage without explicit entry authorization cannot mount medical UI',async()=>{const h=harness({page,vault:true});await h.run();assert.deepEqual(h.redirects,['/modular3-protected.html']);assert.equal(h.result.mounted.length,0);assert.equal(h.result.fetches.length,0);noCloud(h);h.unchanged();});
}
test('authorized entry cannot mount until exact639 selected catalog is cached and public APIs staged',async()=>{const h=harness({vault:true,authorized:true,holdStage:true});const running=h.run();await waitFor(()=>h.result.stageStarted||h.result.locked);assert.equal(h.result.locked,0,h.ctx.window.medcontrolProtectedLocaleRefreshError);assert.equal(h.result.mounted.length,0);assert.equal(h.scripts[0],'js/modular3-script-loader.js');h.releaseStage();await running;assert.deepEqual(h.result.mounted,['input']);assert.ok(h.events.indexOf('stage-ready')<h.events.indexOf('mount'));assert.equal(h.ctx.document.documentElement.lang,'fil');assert.equal(h.ctx.document.documentElement.dir,'ltr');assert.equal(h.redirects.length,0);noCloud(h);h.unchanged();});
test('unconfirmed protected language redirects before medical scripts mount',async()=>{const h=harness({vault:true,authorized:true,confirmed:false});await h.run();assert.deepEqual(h.redirects,['/modular3-protected.html']);assert.equal(h.result.mounted.length,0);noCloud(h);h.unchanged();});
for(const failure of ['failCatalog','failStage'])test(failure+': authorized startup fails closed without deleting clinical data or mounting fallback',async()=>{const h=harness({vault:true,authorized:true,[failure]:true});await h.run();assert.equal(h.result.mounted.length,0);assert.equal(h.result.locked,1);assert.equal(h.ctx.window.MedControlModular3ProtectedSession.isEntryAuthorized(),false);assert.match(h.ctx.window.medcontrolProtectedLocaleRefreshError,failure==='failCatalog'?/Language assets unavailable: fil/:/Selected language catalog activation failed: fil/);assert.equal(h.ctx.document.getElementById('app').textContent,'MedControl');noCloud(h);h.unchanged();});

test('missing administrative warning module fails closed before any medical mount',async()=>{const h=harness({vault:true,authorized:true,failAdministrative:true});await h.run();assert.equal(h.result.mounted.length,0);assert.equal(h.result.locked,1);assert.equal(h.ctx.window.MedControlModular3ProtectedSession.isEntryAuthorized(),false);assert.match(h.ctx.window.medcontrolProtectedLocaleRefreshError,/modular3-system-dialog-messages/);assert.equal(h.ctx.document.getElementById('app').textContent,'MedControl');noCloud(h);h.unchanged();});
