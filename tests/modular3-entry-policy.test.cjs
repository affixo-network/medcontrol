'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const entry=require('../js/modular3-entry-languages.js');
const base=path.join(__dirname,'..','locales');
const registry=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(base,'source-ru.json'),'utf8'));
assert.equal(entry.registry.length,96);
assert.equal(registry.length,96);
assert.equal(entry.registry[0].code,'ru');
assert.equal(entry.registry[95].code,'fil');
assert.equal(entry.resolve('tl-PH'),'fil');
assert.equal(entry.resolve('iw-IL'),'he');
assert.equal(entry.resolve('zh-Hant-TW'),'zh');
assert.equal(entry.resolve('sr-Latn-RS'),'sr');
assert.equal(entry.resolve('not-a-real-code'),null);
assert.equal(entry.confirmed({interfaceLanguage:'xx',languageChoiceConfirmed:true,languageConfirmationVersion:1}),false);
assert.equal(entry.confirmed({interfaceLanguage:'fil',languageChoiceConfirmed:true,languageConfirmationVersion:1}),true);
const mandatory=['Язык интерфейса','Подтвердить','Войти'];
for(const language of registry){
 const record=entry.registry.find(item=>item.id===language.id);
 assert.equal(record?.code,language.code,'Registry mismatch for ID '+language.id);
 assert.equal(record.direction,language.direction,'Direction mismatch for '+language.code);
 if(language.code==='ru')continue;
 const catalog=JSON.parse(fs.readFileSync(path.join(base,'catalogs',language.code+'.json'),'utf8'));
 const prepared=entry.validate(source,catalog,language.code);
 for(const label of mandatory){
  const localized=entry.translate(prepared,label);
  assert.equal(typeof localized,'string','Missing translated entry label '+language.code+': '+label);
  assert.ok(localized.trim(),'Empty translated entry label '+language.code+': '+label);
 }
}
console.log('PASS: all 96 Modular-3 entry languages have complete structural catalogs and mandatory entry labels');
