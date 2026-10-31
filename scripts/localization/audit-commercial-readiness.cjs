/* Free, read-only localization release audit. Does not access patient data. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/en.json'), 'utf8')).messages;
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const expectedKeys = Object.keys(source);
const criticalPattern = /medic|dose|dosage|intake|taken|not taken|missed|cancel|accident|error|schedule|password|encrypt|restore|archive|overdue|warning|unit|tablet|capsule|time|date|препарат|доз|приём|принято|ошиб|случайн|расписан|парол|шифр|восстанов|архив|время|дат/i;
const criticalKeys = expectedKeys.filter(key => criticalPattern.test(String(en[key] || '') + ' ' + String(source[key]?.source || '')));
const correctionKeys = {
  accidental: '4736e0eec69e370d',
  error: 'bf22dfeeba8b8508',
  choice: '8fe1c236559abd0c',
  errorConfirmation: '1340d81906bfec36',
  accidentalConfirmation: '75c6218f9fdec1c4'
};
const rows = [];
for (const {code, englishName} of manifest) {
  if (code === 'ru') {
    rows.push({code, language: englishName, entries: expectedKeys.length, automated: 'PASS', nativeMedicalReview: 'NOT DOCUMENTED', identicalToEnglish: null});
    continue;
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs', code + '.json'), 'utf8'));
  const messages = catalog.messages;
  const identical = Object.keys(en).filter(key => typeof messages[key] === 'string' && messages[key].trim() === en[key].trim());
  const missingKeys = expectedKeys.filter(key => !Object.hasOwn(messages, key));
  const extraKeys = Object.keys(messages).filter(key => !Object.hasOwn(source, key));
  const correctionStrings = Object.fromEntries(Object.entries(correctionKeys).map(([label, key]) => [label, messages[key]]));
  const correctionLabelIntegrity = Object.values(correctionStrings).every(value => typeof value === 'string' && value.trim().length > 0) && correctionStrings.accidental.trim().toLocaleLowerCase() !== correctionStrings.error.trim().toLocaleLowerCase();
  const criticalEnglishMatches = criticalKeys.filter(key => typeof messages[key] === 'string' && messages[key].trim() === String(en[key] || '').trim());
  rows.push({
    code, language: englishName, entries: Object.keys(messages).length,
    automated: missingKeys.length === 0 && extraKeys.length === 0 ? 'PASS' : 'FAIL',
    missingKeys, extraKeys, correctionLabelIntegrity,
    correctionStringsForReview: correctionStrings,
    correctionSemanticReview: 'PENDING HUMAN CONTEXT REVIEW; both Accidental button press and Error are approved; distinct labels are structurally checked',
    criticalEnglishMatches: criticalEnglishMatches.length,
    sampleCriticalEnglishMatches: criticalEnglishMatches.slice(0, 20).map(key => ({key, english: en[key]})),
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
  approvedCorrectionOptions: ['Accidental button press', 'Error'],
  correctionLabelIntegrity: rows.filter(x => x.code !== 'ru').every(x => x.correctionLabelIntegrity),
  criticalSourceEntries: criticalKeys.length,
  auditLimitations: ['Matching English may be correct for units and names', 'Automated checks cannot validate medical meaning', 'Clinical and native-speaker review evidence is absent'],
  commercialReleaseApproved: false,
  blockingReason: 'Independent medical-language review and in-context sign-off not documented for every language.',
  languages: rows
};
const target = process.argv[2];
if (target) fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log('Language inventory:', rows.length, '/95');
console.log('Structural entries:', rows.every(x => x.automated === 'PASS') ? 'PASS' : 'FAIL');
console.log('Commercial medical-language sign-off: NOT DOCUMENTED');
console.log('Approved correction options preserved for human review:', out.correctionLabelIntegrity ? 'PASS' : 'FAIL');
console.log('Critical entries selected for human review:', criticalKeys.length);
console.log('Critical matches requiring triage:', rows.filter(x => x.code !== 'en' && x.code !== 'ru').reduce((n,x)=>n+(x.criticalEnglishMatches || 0),0));
console.log('Possible untranslated entries (non-English):', rows.filter(x => x.code !== 'en' && x.code !== 'ru').reduce((n,x)=>n+x.identicalToEnglish,0));
if (!out.technicalInventory.complete || !out.correctionLabelIntegrity) process.exitCode = 1;
