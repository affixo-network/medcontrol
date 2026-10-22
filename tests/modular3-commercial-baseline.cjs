'use strict';
// Commercial Modular-3 must preserve the completed Modular-2 implementation.
// Only synthetic data and repository files are examined.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const vm=require('node:vm');
const paths=['input.html','action.html','dashboard.html','archive.html','core.js','js/render.js','js/medications.js'];
for(const file of paths){
 const original=execFileSync('git',['show','origin/modular-2.000:'+file],{encoding:'utf8'});
 const current=fs.readFileSync(file,'utf8');
 assert.equal(current,original,'Modular-2 completed baseline unexpectedly changed: '+file);
}
console.log('PASS commercial baseline: 7 completed Modular-2 interface/core files unchanged');
const ctx={console:{log(){}}};
vm.runInNewContext(fs.readFileSync('js/translations.js','utf8')+';this.catalog=TRANSLATIONS;',ctx);
const translations=ctx.catalog;
const locales=Object.keys(translations).sort();
assert.ok(locales.includes('ru')&&locales.includes('en'));
const keys=Object.keys(translations.en);
for(const [locale,values] of Object.entries(translations)){
 assert.deepEqual(Object.keys(values).sort(),[...keys].sort(),'Missing or extra translation keys for '+locale);
 for(const key of keys)assert.ok(typeof values[key]==='string'||Array.isArray(values[key]),'Invalid translation '+locale+'.'+key);
}
console.log('PASS commercial localization baseline: '+locales.join(', ')+'; '+keys.length+' keys');
console.log('INFO commercial localization target: 95 languages; actual translated catalogs: '+locales.length+'/95');
