'use strict';
// Fail-closed catalog audit: a selected language must not silently retain
// untranslated Russian source messages. No medical records are read.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'locales/source-ru.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'locales/manifest.json'),'utf8'));
const languages=manifest;
assert.equal(languages[27].code,'ka');assert.equal(languages[95].code,'fil');
assert.equal(languages.length,96,'Expected exactly 96 canonical commercial languages');
const ids=Object.keys(source);
assert.equal(ids.length,639,'Russian reference must contain 639 messages');
const sectionTitleIds={
  input:'87a2b9ea146d476e',
  action:'f45170df6a0828f5',
  dashboard:'0fe132872b85f083',
  archive:'78aca0cace982b30'
};
for(const [page,id] of Object.entries(sectionTitleIds))
  assert.equal(typeof source[id]?.source,'string','Russian section title missing: '+page);
const failures=[];
const review=[];
for(const item of languages){
  if(item.code==='ru')continue;
  const file=path.join(root,'locales/catalogs',item.code+'.json');
  if(!fs.existsSync(file)){failures.push(item.code+': catalog missing');continue;}
  const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
  if(catalog.language!==item.code)failures.push(item.code+': catalog language mismatch');
  const messages=catalog.messages||{};
  const missing=ids.filter(id=>typeof messages[id]!=='string'||!messages[id].trim());
  const sectionTitleMissing=Object.entries(sectionTitleIds).filter(([page,id])=>
    typeof messages[id]!=='string'||!messages[id].trim()||
    (item.code!=='ru'&&messages[id]===source[id].source));
  for(const [page,id] of sectionTitleMissing)
    console.error('SECTION_TITLE_REVIEW '+item.code+' '+page+' '+id+' '+JSON.stringify(messages[id]));
  const untranslated=ids.filter(id=>/[А-Яа-яЁё]/.test(source[id].source)&&messages[id]===source[id].source);
  const extra=Object.keys(messages).filter(id=>!Object.prototype.hasOwnProperty.call(source,id));
  // These locales use non-Cyrillic writing systems. A Cyrillic character in
  // their translated UI copy is a separate language-mixing warning even when
  // the string is not identical to the Russian source. Avoid asserting this
  // for Cyrillic-script languages, where identical words can be legitimate.
  const cyrillicLocales=new Set(['ru','be','bg','kk','ky','mk','mn','sr','tg','uk']);
  const unexpectedCyrillic=cyrillicLocales.has(item.code)?[]:
    ids.filter(id=>typeof messages[id]==='string'&&/[А-Яа-яЁё]/.test(messages[id]));
  console.log(item.code+': 4 section titles audited; '+(ids.length-missing.length)+'/'+ids.length+
    ' present; '+untranslated.length+' unchanged Russian; '+extra.length+' extra');
  if(sectionTitleMissing.length)review.push(item.code+': '+sectionTitleMissing.length+' section titles require review');
  if(untranslated.length)review.push(item.code+': '+untranslated.length+' exact Russian matches require linguistic review');
  if(missing.length||extra.length||unexpectedCyrillic.length){
    failures.push(item.code+': missing='+missing.length+' unchangedRussian='+untranslated.length+
      ' extra='+extra.length+' unexpectedCyrillic='+unexpectedCyrillic.length);
    // Print every unresolved source string for a single reviewed correction
    // batch. Exact equality alone is not proof of a wrong translation.
    for(const id of missing)
      console.error('MISSING '+item.code+' '+id+' '+JSON.stringify(source[id].source));

    for(const id of extra)
      console.error('EXTRA '+item.code+' '+id);
    for(const id of unexpectedCyrillic)
      console.error('UNEXPECTED_CYRILLIC '+item.code+' '+id+' '+JSON.stringify(messages[id]));
  }
  for(const id of untranslated)
    console.log('REVIEW_UNCHANGED '+item.code+' '+id+' '+JSON.stringify(source[id].source));
}
console.log('LINGUISTIC REVIEW PENDING: '+review.length+' catalogs; exact Russian matches are not automatically errors');
for(const entry of review)console.log('REVIEW '+entry);
if(failures.length){
  console.error('SINGLE-LANGUAGE GUARANTEE NOT VERIFIED: '+failures.length+' catalogs need review');
  for(const failure of failures)console.error(failure);
  process.exitCode=1;
}else console.log('PASS: structural and script-leakage checks; linguistic review and rendered-page audit remain separate acceptance gates');
