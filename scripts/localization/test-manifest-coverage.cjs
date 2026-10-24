/* Public localization inventory checks. Never loads patient data. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const { validateCatalog } = require('../../js/modular3-public-catalog-loader.js');

test('manifest contains exactly 95 distinct, valid languages', () => {
  assert.equal(manifest.length, 95);
  const codes = manifest.map(item => item.code);
  assert.equal(new Set(codes).size, 95);
  for (const item of manifest) {
    assert.match(item.code, /^[a-z]{2,3}(?:-[a-z]{2,4})?$/);
    assert.ok(item.name && item.englishName);
    assert.ok(['ltr', 'rtl'].includes(item.direction));
  }
  assert.ok(codes.includes('ru') && codes.includes('en'));
});

test('right-to-left language directions are declared explicitly', () => {
  for (const code of ['ar', 'he', 'ps', 'fa', 'sd', 'ur', 'yi']) {
    assert.equal(manifest.find(item => item.code === code)?.direction, 'rtl');
  }
});

test('every committed external catalog is complete and declared', () => {
  assert.equal(Object.keys(source).length, 639);
  const directory = path.join(root, 'locales/catalogs');
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json'));
  for (const file of files) {
    const language = file.slice(0, -5);
    assert.ok(manifest.some(item => item.code === language), 'Undeclared catalog: ' + file);
    const catalog = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    validateCatalog(catalog, source, language);
  }
  assert.ok(files.includes('en.json'));
  console.log('Verified committed external catalogs: ' + files.length + ' / 94 (Russian is source)');
});
