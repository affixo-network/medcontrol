'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const auth = fs.readFileSync(path.join(__dirname,'../../js/auth-guard.js'),'utf8');
const match = auth.match(/  function populateProtectedLanguageSelector\(\)\{[\s\S]*?\n  \}/);
assert.ok(match, 'Protected-only language selector function missing');
function run(protectedMode) {
  const options = [{value:'ru',text:'Русский'},{value:'en',text:'English'}];
  const selector = {options,add(option){options.push(option);},value:'ru'};
  const sandbox = {
    window:{medcontrolProtectedInterface:protectedMode},
    SUPPORTED_LANGUAGES:[['ru','Русский'],['en','English'],['hy','Հայերեն'],['fr','Français']],
    document:{querySelector:()=>selector},
    getState:()=>({settings:{interfaceLanguage:'hy'}}),
    Option:function(text,value){this.text=text;this.value=value;}
  };
  vm.createContext(sandbox);
  vm.runInContext(match[0]+'\npopulateProtectedLanguageSelector();\npopulateProtectedLanguageSelector();',sandbox);
  return {selector,options};
}
test('protected UI adds available languages once and selects saved locale',()=>{
  const {selector,options}=run(true);
  assert.deepEqual(options.map(x=>x.value),['ru','en','hy','fr']);
  assert.equal(selector.value,'hy');
});
test('legacy UI is unchanged',()=>{
  const {selector,options}=run(false);
  assert.deepEqual(options.map(x=>x.value),['ru','en']);
  assert.equal(selector.value,'ru');
});
