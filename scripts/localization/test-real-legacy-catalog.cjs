/* Verify the production English catalog maps to legacy labels without changing UI or patient state. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { validateCatalog } = require('../../js/modular3-public-catalog-loader.js');
const { KEY_TO_CATALOG_ID, adaptCatalog } = require('../../js/modular3-legacy-locale-adapter.js');
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const english = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/en.json'), 'utf8'));
test('real English catalog validates all 639 entries', () => {
  assert.equal(Object.keys(source).length, 639);
  assert.equal(Object.keys(validateCatalog(english, source, 'en').messages).length, 639);
});
test('every mapped scalar label has a real English catalog entry', () => {
  for (const [key, id] of Object.entries(KEY_TO_CATALOG_ID)) {
    assert.ok(Object.hasOwn(source, id), 'Unknown source ID: ' + key);
    assert.equal(typeof english.messages[id], 'string', 'Missing English label: ' + key);
    assert.ok(source[id].files.includes('translations.' + key) || (['correction_reason_accident', 'correction_reason_error'].includes(key) && source[id].files.some(file => file.includes('correction'))), 'Wrong source mapping: ' + key);
  }
});
test('real catalog adapter preserves fallback and does not mutate inputs', () => {
  const fallback = { nav_input: 'Input fallback', weekday_short: ['Mon','Tue'], private_key: 'Keep' };
  const before = structuredClone(fallback);
  const result = adaptCatalog(english, fallback);
  assert.equal(result.nav_input, english.messages[KEY_TO_CATALOG_ID.nav_input]);
  assert.deepEqual(result.weekday_short, ['Mon','Tue']);
  assert.equal(result.private_key, 'Keep');
  assert.deepEqual(fallback, before);
});
