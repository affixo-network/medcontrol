'use strict';
// Fail-closed catalog audit: a selected language must not silently retain
// untranslated Russian source messages. No medical records are read.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'locales/source-ru.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'locales/manifest.json'),'utf8'));
const languages=manifest.filter(item=>item.id<=95);
assert.equal(languages.length,95,'Expected exactly 95 commercial languages');
const ids=Object.keys(source);
assert.equal(ids.length,639,'Russian reference must contain 639 messages');
const failures=[];
for(const item of languages){
  if(item.code==='ru')continue;
  const file=path.join(root,'locales/catalogs',item.code+'.json');
  if(!fs.existsSync(file)){failures.push(item.code+': catalog missing');continue;}
  const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
  if(catalog.language!==item.code)failures.push(item.code+': catalog language mismatch');
  const messages=catalog.messages||{};
  const missing=ids.filter(id=>typeof messages[id]!=='string'||!messages[id].trim());
  const untranslated=ids.filter(id=>/[А-Яа-яЁё]/.test(source[id].source)&&messages[id]===source[id].source);
  const extra=Object.keys(messages).filter(id=>!Object.prototype.hasOwnProperty.call(source,id));
  // These locales use non-Cyrillic writing systems. A Cyrillic character in
  // their translated UI copy is a separate language-mixing warning even when
  // the string is not identical to the Russian source. Avoid asserting this
  // for Cyrillic-script languages, where identical words can be legitimate.
  const cyrillicLocales=new Set(['ru','be','bg','kk','ky','mk','mn','sr','tg','uk']);
  const unexpectedCyrillic=cyrillicLocales.has(item.code)?[]:
    ids.filter(id=>typeof messages[id]==='string'&&/[А-Яа-яЁё]/.test(messages[id]));
  console.log(item.code+': '+(ids.length-missing.length)+'/'+ids.length+
    ' present; '+untranslated.length+' unchanged Russian; '+extra.length+' extra');
  if(missing.length||untranslated.length||extra.length||unexpectedCyrillic.length){
    failures.push(item.code+': missing='+missing.length+' unchangedRussian='+untranslated.length+
      ' extra='+extra.length+' unexpectedCyrillic='+unexpectedCyrillic.length);
    // Print every unresolved source string for a single reviewed correction
    // batch. Exact equality alone is not proof of a wrong translation.
    for(const id of missing)
      console.error('MISSING '+item.code+' '+id+' '+JSON.stringify(source[id].source));
    for(const id of untranslated)
      console.error('REVIEW_UNCHANGED '+item.code+' '+id+' '+JSON.stringify(source[id].source));
    for(const id of extra)
      console.error('EXTRA '+item.code+' '+id);
    for(const id of unexpectedCyrillic)
      console.error('UNEXPECTED_CYRILLIC '+item.code+' '+id+' '+JSON.stringify(messages[id]));
  }
}
if(failures.length){
  console.error('SINGLE-LANGUAGE GUARANTEE NOT VERIFIED: '+failures.length+' catalogs need review');
  for(const failure of failures)console.error(failure);
  process.exitCode=1;
}else console.log('PASS: 95 catalogs structurally complete without identical Cyrillic Russian fallbacks');
