/* Validate machine-generated public UI drafts before any repository import.
 * Structural approval only; human medical-language review remains outstanding.
 * Never reads protected medical data.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const masterBytes = fs.readFileSync(path.join(root, 'locales/catalogs/en.json'));
const masterHash = crypto.createHash('sha256').update(masterBytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
const allowed = new Set(manifest.map(x => x.code).filter(x => x !== 'ru' && x !== 'en'));
const { validateCatalog } = require('../../js/modular3-public-catalog-loader.js');
const input = path.join(root, 'locales/draft-import');
const output = path.join(root, 'locales/catalogs');
if (!fs.existsSync(input)) throw new Error('Draft download missing');
const files = fs.readdirSync(input).filter(x => x.endsWith('.json'));
if (!files.length) throw new Error('No draft JSON files downloaded');
let accepted = 0;
const rejected = [];
for (const file of files) {
  const code = file.slice(0, -5);
  if (!allowed.has(code)) { rejected.push(file + ': unknown language'); continue; }
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(input, file), 'utf8'));
    if (catalog.englishMasterSha256 !== masterHash) throw new Error('English master mismatch');
    if (catalog.provenance !== 'machine translation from AI-reviewed English UI; units and named clinical controls preserved; native editorial review not established') throw new Error('Unrecognized provenance');
    validateCatalog(catalog, source, code);
    const dest = path.join(output, file);
    if (fs.existsSync(dest)) { console.log('SKIPPED existing catalog:', file); continue; }
    fs.copyFileSync(path.join(input, file), dest, fs.constants.COPYFILE_EXCL);
    accepted++;
  } catch (error) { rejected.push(file + ': ' + error.message); }
}
console.log('Accepted drafts:', accepted, 'Rejected:', rejected.length);
for (const issue of rejected) console.log('REJECTED', issue);
if (accepted === 0) throw new Error('No structurally valid new drafts');
