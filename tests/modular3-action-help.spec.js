'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/modular3-action-help.js'),'utf8');
test('all 95 action-help catalogs render in selected language without medical writes',async({page})=>{
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
 expect(result).toEqual({languages:95,failures:[],panels:1});
});


test('all non-default language catalogs have complete and safe public messages',async()=>{
 const vm=require('node:vm');
 const host={};
 vm.runInNewContext(source,{window:host});
 const languages=Array.from(host.MedControlActionHelp.languages);
 expect(languages).toHaveLength(95);
 const catalogDir=path.join(__dirname,'../locales/catalogs');
 const catalogFiles=fs.readdirSync(catalogDir).filter(name=>name.endsWith('.json')).sort();
 const expected=languages.filter(language=>language!=='ru').map(language=>language+'.json').sort();
 expect(catalogFiles).toEqual(expected);
 const russianSource=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/source-ru.json'),'utf8'));
 const loader=require('../js/modular3-public-catalog-loader.js');
 expect(Object.keys(russianSource)).toHaveLength(639);
 for(const filename of catalogFiles){
  const language=filename.slice(0,-5);
  const catalog=JSON.parse(fs.readFileSync(path.join(catalogDir,filename),'utf8'));
  expect(()=>loader.validateCatalog(catalog,russianSource,language),filename).not.toThrow();
  if(language!=='en') expect(catalog.segmentedFallbackMessages,filename).toBe(0);
 }
});
