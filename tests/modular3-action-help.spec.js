'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/modular3-action-help.js'),'utf8');
test('language manifest and action-help use the same locale codes',async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/manifest.json'),'utf8'));
 const vm=require('node:vm');
 const host={};
 vm.runInNewContext(source,{window:host});
 const fromManifest=manifest.map(item=>item.code);
 const fromHelp=Array.from(host.MedControlActionHelp.languages);
 expect(fromManifest).toHaveLength(manifest.length);
 expect(new Set(fromManifest).size).toBe(95);
 expect(fromHelp).toHaveLength(manifest.length);
 expect([...fromHelp].sort()).toEqual([...fromManifest].sort());
 // Commercially required Filipino must not be silently replaced by Cebuano.
 expect(fromManifest).toContain('fil');
});

test('all action-help catalogs render in selected language without medical writes',async({page})=>{
 await page.goto('http://127.0.0.1:8765/input.html');
 // Prevent pending application redirects from destroying the isolated test document.
 await page.route('**/*',route=>route.abort());
 await page.goto('about:blank');
 await page.setContent('<main id="app">Synthetic interface</main>');
 await page.evaluate(()=>{window.medcontrolProtectedInterface=true;window.__localeState={settings:{interfaceLanguage:'ru'}};window.getState=()=>window.__localeState;});
 await page.addScriptTag({content:source});
 const result=await page.evaluate(()=>{
  const languages=window.MedControlActionHelp.languages;
  const failures=[];
  for(const language of languages){
   window.__localeState.settings.interfaceLanguage=language;
   window.MedControlActionHelp.render();
   const panel=document.getElementById('medcontrol-action-help');
   if(!panel||panel.querySelectorAll('dt').length!==8||panel.querySelectorAll('dd').length!==8||!panel.querySelector('summary')?.textContent.endsWith(language.toUpperCase()))failures.push(language);
  }
  return {languages:languages.length,failures,panels:document.querySelectorAll('#medcontrol-action-help').length};
 });
 expect(result).toEqual({languages:JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/manifest.json'),'utf8')).length,failures:[],panels:1});
});


test('all non-default language catalogs have complete and safe public messages',async()=>{
 const vm=require('node:vm');
 const host={};
 vm.runInNewContext(source,{window:host});
 const languages=Array.from(host.MedControlActionHelp.languages);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/manifest.json'),'utf8'));
 expect(languages).toHaveLength(manifest.length);
 const catalogDir=path.join(__dirname,'../locales/catalogs');
 const catalogFiles=fs.readdirSync(catalogDir).filter(name=>name.endsWith('.json')).sort();
 const expected=languages.filter(language=>language!=='ru').map(language=>language+'.json').sort();
 expect(catalogFiles).toEqual(expected);
 const russianSource=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/source-ru.json'),'utf8'));
 const loader=require('../js/modular3-public-catalog-loader.js');
 expect(Object.keys(russianSource)).toHaveLength(639);
 const historicalFallbacks=[];
 for(const filename of catalogFiles){
  const language=filename.slice(0,-5);
  const catalog=JSON.parse(fs.readFileSync(path.join(catalogDir,filename),'utf8'));
  expect(()=>loader.validateCatalog(catalog,russianSource,language),filename).not.toThrow();
  // This is a historical count of segmented translation requests, not untranslated messages.
  if(language!=='en') {
   expect(catalog.segmentedFallbackMessages === undefined || (Number.isSafeInteger(catalog.segmentedFallbackMessages) && catalog.segmentedFallbackMessages>=0),filename).toBe(true);
   if((catalog.segmentedFallbackMessages||0)>0) historicalFallbacks.push({language,count:catalog.segmentedFallbackMessages});
  }
 }
 console.log('Historical segmented translation requests:',JSON.stringify(historicalFallbacks));
});


test('all language catalogs preserve technical filenames and module identifiers',async()=>{
 const catalogDir=path.join(__dirname,'../locales/catalogs');
 for(const filename of fs.readdirSync(catalogDir).filter(name=>name.endsWith('.json'))){
  const catalog=JSON.parse(fs.readFileSync(path.join(catalogDir,filename),'utf8'));
  expect(catalog.messages['6a87923bbd93eb05'],filename).toContain('(.json)');
  expect(catalog.messages['bb60dfab35c65509'],filename).toContain('core.js');
  expect(catalog.messages['969e5c79f8f07166'],filename).toContain('medcontrol-encrypted-transfer.json');
 }
});


test('language correction catalogs preserve cancellation placeholders and Russian reference semantics',async()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const root=path.join(__dirname,'..');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'locales/manifest.json'),'utf8'));
 const source=JSON.parse(fs.readFileSync(path.join(root,'locales/source-ru.json'),'utf8'));
 const languages=manifest.map(item=>item.code);
 expect(languages).toHaveLength(manifest.length);
 expect(new Set(languages).size).toBe(95);
 const helpKey='585d7328139b9ece';
 const confirmationKey='1340d81906bfec36';
 expect(source[helpKey].source).toContain('отменена');
 expect(source[helpKey].source).toContain('истории');
 expect(source[helpKey].source).not.toContain('Статус «Принято» сохранится');
 expect(source[confirmationKey].source).toContain('Отмена отметки');
 const loader=require('../js/modular3-public-catalog-loader.js');
 for(const language of languages.filter(code=>code!=='ru')){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'locales/catalogs',language+'.json'),'utf8'));
  expect(()=>loader.validateCatalog(catalog,source,language),language).not.toThrow();
  expect(catalog.messages[helpKey].trim().length,language).toBeGreaterThan(25);
  expect(catalog.messages[confirmationKey].match(/⟦[012]⟧/g)?.sort(),language).toEqual(['⟦0⟧','⟦1⟧','⟦2⟧']);
 }
 const english=JSON.parse(fs.readFileSync(path.join(root,'locales/catalogs/en.json'),'utf8'));
 expect(english.messages[helpKey]).toContain('cancelled');
 expect(english.messages[helpKey]).not.toContain('status is retained');
});

test('correction catalog activates only after successful registration',async()=>{
 const activation=require('../js/modular3-locale-activation.js');
 const messages=Object.freeze({'4736e0eec69e370d':'Accidental button press'});
 const prepared={language:'en',labels:{},correctionMessages:messages};
 const options={
   source:{},fallback:{},fetcher:async()=>{},
   loader:{},adapter:{},prepare:{prepare:async()=>prepared},
   register:async()=>true
 };
 const previous=globalThis.MedControlCorrectionCatalogs;
 try{
   delete globalThis.MedControlCorrectionCatalogs;
   expect(await activation.activate('en',options)).toBe(true);
   expect(globalThis.MedControlCorrectionCatalogs.en.messages['4736e0eec69e370d']).toBe('Accidental button press');
   delete globalThis.MedControlCorrectionCatalogs;
   expect(await activation.activate('en',{...options,register:async()=>false})).toBe(false);
   expect(globalThis.MedControlCorrectionCatalogs).toBeUndefined();
 }finally{
   if(previous===undefined)delete globalThis.MedControlCorrectionCatalogs;
   else globalThis.MedControlCorrectionCatalogs=previous;
 }
});

test('all translated correction dialogs have required catalog keys',async()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const root=path.join(__dirname,'..');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'locales/manifest.json'),'utf8'));
 const source=JSON.parse(fs.readFileSync(path.join(root,'locales/source-ru.json'),'utf8'));
 const required=[
  '1419825a704fb8e4','685190e0416b6da0','57cb4188862a5ff0',
  'f9274041224ea4c0','442e7ad5479655fc','6a323db2ae5bed82',
  '435d3d1cbd5cc878','0a23c2a4fe16415a','a7a4033657e89fc9',
  '89c4361d72299747','585d7328139b9ece',
  '4736e0eec69e370d','bf22dfeeba8b8508'
 ];
 for(const item of manifest.filter(item=>item.code!=='ru')){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'locales/catalogs',item.code+'.json'),'utf8'));
  for(const key of required){
   expect(source[key],item.code+' source '+key).toBeDefined();
   expect(typeof catalog.messages[key],item.code+' '+key).toBe('string');
   expect(catalog.messages[key].trim().length,item.code+' '+key).toBeGreaterThan(0);
  }
  expect(catalog.messages['1419825a704fb8e4'],item.code).toContain('⟦0⟧');
 }
});
