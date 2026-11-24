'use strict';
// Isolated legacy-module unit host: no production guard, protected vault or cloud auth.
// Domain source files and the shared script loader are served unchanged from disk.
const fs=require('node:fs'),path=require('node:path');
const BASE=process.env.MEDCONTROL_TEST_BASE||'http://127.0.0.1:8765';
const source=fs.readFileSync(path.resolve(__dirname,'../js/auth-guard.js'),'utf8');
const common=Function('return '+source.match(/const common=(\[[^;]+\]);/)[1])();
const reset=source.match(/const reset='([^']+)'/)[1];
const scripts=Function('common','reset','return ('+source.match(/const scriptsByPage=(\{[\s\S]*?\n  \});/)[1]+')')(common,reset);
async function installLegacyModuleHost(context,sample,{seed=true}={}){
 if(seed)await context.addInitScript(sample=>{
  const key='affixo_medcontrol_standard_v3';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(sample||{settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[]}));
 },sample);
 const external=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==BASE){external.push(url.origin);return route.abort();}
  const section=url.pathname.match(/^\/(input|action|dashboard|archive)\.html$/)?.[1];
  if(!section)return route.fallback();
  const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><div id="app">MedControl</div><script src="/js/modular3-script-loader.js"></script><script>'+`(async()=>{try{const loader=MedControlScriptLoader.createLoader({load:src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+src;script.onload=resolve;script.onerror=reject;document.head.appendChild(script);})});await loader.ensureScripts(${JSON.stringify(scripts[section])});if(${JSON.stringify(section)}!=='archive')await mount(${JSON.stringify(section)});window.legacyModuleFixtureReady=true;}catch(e){window.legacyModuleFixtureError=String(e);throw e;}})();`+'</script></body></html>';
  return route.fulfill({status:200,contentType:'text/html',body:html});
 });
 return external;
}
module.exports={BASE,installLegacyModuleHost};
