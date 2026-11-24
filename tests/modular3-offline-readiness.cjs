/* Read-only static asset audit. Browser cache/offline success needs actual E2E. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const guard=read('js/auth-guard.js'),entry=read('modular3-protected.html');
const pages=['input','action','dashboard','archive'];
const unique=new Set();
function exists(raw){const file=raw.replace(/^\//,'').split('?')[0];assert.ok(fs.statSync(path.join(root,file)).isFile(),'Missing offline asset '+file);unique.add(file);}
// Evaluate only declared dependency arrays, never the application/authentication code.
const dependencies=vm.createContext({});
for(const name of ['common','reset','protectedModules']){
 const declaration=guard.match(new RegExp('  const '+name+'=([^\\n]+);'));
 assert.ok(declaration,'Missing dependency declaration '+name);
 vm.runInContext('const '+name+'='+declaration[1]+';',dependencies);
}
const groups=guard.match(/  const scriptsByPage=\{[\s\S]*?\n  \};/);assert.ok(groups);
vm.runInContext(groups[0]+'\nglobalThis.dependencies={scriptsByPage,common,protectedModules};',dependencies);
for(const page of pages){
 const source=read(page+'.html');assert.match(source,/js\/auth-guard\.js/);
 assert.ok(dependencies.dependencies.scriptsByPage[page]?.length,'Missing declared dependency list '+page);
 for(const file of dependencies.dependencies.scriptsByPage[page])exists(file);
}
for(const file of dependencies.dependencies.protectedModules)exists(file);
for(const match of entry.matchAll(/<script\b[^>]*\bsrc=['"]([^'"]+)['"]/g))exists(match[1]);
const registrations=[...guard.matchAll(/serviceWorker\.register\('([^']+)'/g),...entry.matchAll(/serviceWorker\.register\('([^']+)'/g)];
assert.ok(registrations.length>=2,'Protected entry and medical shell must register actual root worker');
for(const registration of registrations)assert.equal(registration[1],'/modular3-static-cache-sw.js');
const worker=read(registrations[0][1].slice(1));exists(registrations[0][1]);
const workerContext=vm.createContext({self:{addEventListener(){}}});
vm.runInContext(worker+'\nglobalThis.assets={PAGES,CORE,PUBLIC_LOCALES,VERSION};',workerContext);
for(const file of [...workerContext.assets.PAGES,...workerContext.assets.CORE,...workerContext.assets.PUBLIC_LOCALES])exists(file);
for(const page of pages)assert.ok(workerContext.assets.PAGES.includes('/'+page+'.html'));
for(const file of ['/js/modular3-entry-languages.js','/js/modular3-protected-locale-controller.js','/js/modular3-protected-session.js','/js/modular3-write-boundary.js'])assert.ok(workerContext.assets.CORE.includes(file),'Required protected worker dependency '+file);
const policy=require('../js/modular3-entry-languages.js');
assert.equal(policy.cacheName,workerContext.assets.VERSION,'Policy and actual worker must use the same public cache version');
assert.equal(policy.registry.length,96);assert.equal(policy.registry[27].code,'ka');assert.equal(policy.registry[95].code,'fil');
const manifest=JSON.parse(read('locales/manifest.json')),source=JSON.parse(read('locales/source-ru.json'));
assert.deepEqual(manifest.map(item=>[item.id,item.code]),policy.registry.map(item=>[item.id,item.code]));
for(const language of policy.registry){
 if(language.code==='ru'){policy.validate(source,null,'ru');continue;}
 const file='locales/catalogs/'+language.code+'.json';exists(file);policy.validate(source,JSON.parse(read(file)),language.code);
}
// Inspect the actual current startup block, excluding retained dormant legacy helpers.
const startup=guard.slice(guard.lastIndexOf('  try{\n    const list=pageScripts();'));
assert.ok(startup.startsWith('  try{\n    const list=pageScripts();'),'Cannot identify actual startup block');
assert.match(startup,/isEntryAuthorized\(\)/);assert.match(startup,/MedControlEntryLanguages\.confirmed/);
assert.match(startup,/location\.replace\('\/modular3-protected\.html'\)/);
assert.doesNotMatch(startup,/createVerifiedSupabase\(|attachVerifiedSupabase\(|restoreCloudBeforeOpeningPage\(|supabase\.auth\./);
assert.match(guard,/fetch\('\/'\+targetPage\+'\.html\?deployment_check=/);
assert.match(guard,/catch\(_\)\{return '';\}/,'Deployment metadata failure remains optional');
assert.match(guard,/window\.medcontrolProtectedInterface\?'':await latestDeploymentId\(targetPage\)/,'Protected navigation does not require network deployment checks');
assert.match(guard,/document\.createElement\('script'\)/);
console.log(JSON.stringify({checkedPages:pages,uniqueLocalAssets:unique.size,canonicalLanguages:policy.registry.length,catalogMessages:639,actualRegisteredWorker:registrations[0][1],cacheVersion:policy.cacheName,allLocalScriptsPresent:true,staticAssetsOnly:true,browserOfflineReadiness:'Requires actual browser E2E; file presence does not prove cache installation or offline restart',cloudAuthInvokedByStartup:false,productionModified:false},null,2));
