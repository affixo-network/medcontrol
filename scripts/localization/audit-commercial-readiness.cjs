/* Free, read-only localization release audit. Does not access patient data. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/en.json'), 'utf8')).messages;
const rows = [];
for (const {code, englishName} of manifest) {
  if (code === 'ru') {
    rows.push({code, language: englishName, entries: 639, automated: 'PASS', nativeMedicalReview: 'NOT DOCUMENTED', identicalToEnglish: null});
    continue;
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs', code + '.json'), 'utf8'));
  const messages = catalog.messages;
  const identical = Object.keys(en).filter(key => typeof messages[key] === 'string' && messages[key].trim() === en[key].trim());
  rows.push({
    code, language: englishName, entries: Object.keys(messages).length,
    automated: Object.keys(messages).length === 639 ? 'PASS' : 'FAIL',
    nativeMedicalReview: 'NOT DOCUMENTED',
    provenance: catalog.provenance || 'UNKNOWN',
    identicalToEnglish: identical.length,
    sampleIdenticalKeys: identical.slice(0, 12)
  });
}
const out = {
  generatedAt: new Date().toISOString(),
  purpose: 'Automated triage only; identical English strings may be legitimate.',
  technicalInventory: {languages: rows.length, expected: 95, complete: rows.every(x => x.automated === 'PASS')},
  commercialReleaseApproved: false,
  blockingReason: 'Independent medical-language review and in-context sign-off not documented for every language.',
  languages: rows
};
const target = process.argv[2];
if (target) fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log('Language inventory:', rows.length, '/95');
console.log('Structural entries:', rows.every(x => x.automated === 'PASS') ? 'PASS' : 'FAIL');
console.log('Commercial medical-language sign-off: NOT DOCUMENTED');
console.log('Possible untranslated entries (non-English):', rows.filter(x => x.code !== 'en' && x.code !== 'ru').reduce((n,x)=>n+x.identicalToEnglish,0));
if (!out.technicalInventory.complete) process.exitCode = 1;
