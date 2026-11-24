'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const policy = require('../../js/modular3-entry-languages.js');
const auth = fs.readFileSync(path.join(__dirname,'../../js/auth-guard.js'),'utf8');
const match = auth.match(/  function populateProtectedLanguageSelector\(\)\{[\s\S]*?\n  \}/);
assert.ok(match, 'Protected-only language selector function missing');
function run(protectedMode, selected = 'hy') {
  const options = [{value:'ru',text:'Русский'},{value:'en',text:'English'}];
  const selector = {options,add(option){options.push(option);},value:'ru'};
  const state = {settings:{interfaceLanguage:selected},medications:[{id:'synthetic',name:'Synthetic medication'}]};
  const original = JSON.stringify(state);
  const sandbox = {
    window:{medcontrolProtectedInterface:protectedMode,MedControlEntryLanguages:policy},
    SUPPORTED_LANGUAGES:[['ru','Русский'],['en','English'],['hy','Հայերեն'],['fr','Français']],
    document:{querySelector:()=>selector},
    getState:()=>state,
    Option:function(text,value){this.text=text;this.value=value;}
  };
  vm.createContext(sandbox);
  vm.runInContext(match[0]+'\npopulateProtectedLanguageSelector();\npopulateProtectedLanguageSelector();',sandbox);
  assert.equal(JSON.stringify(state),original,'Populating a selector cannot mutate saved settings or clinical data');
  return {selector,options};
}
test('protected UI adds available languages once and selects saved locale',()=>{
  const {selector,options}=run(true);
  assert.equal(options.length,96);
  assert.equal(new Set(options.map(x=>x.value)).size,96);
  assert.deepEqual(new Set(options.map(x=>x.value)),new Set(policy.registry.map(x=>x.code)));
  assert.equal(policy.registry.find(entry=>entry.id===28).code,'ka');
  assert.equal(policy.registry.find(entry=>entry.id===96).code,'fil');
  assert.ok(options.some(option=>option.value==='ka'&&option.text==='ქართული'));
  assert.ok(options.some(option=>option.value==='fil'&&option.text==='Filipino'));
  assert.equal(selector.value,'hy');
});
test('legacy UI is unchanged',()=>{
  const {selector,options}=run(false);
  assert.deepEqual(options.map(x=>x.value),['ru','en']);
  assert.equal(selector.value,'ru');
});

test('selected Filipino is retained while selector population remains idempotent',()=>{
  const {selector,options}=run(true,'fil');
  assert.equal(selector.value,'fil');
  assert.equal(options.length,96);
});
