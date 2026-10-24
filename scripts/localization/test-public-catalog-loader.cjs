/* Regression tests for the isolated public locale loader. No patient data. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateCatalog, loadCatalog } = require('../../js/modular3-public-catalog-loader.js');
const source = Object.fromEntries(Array.from({ length: 639 }, (_, i) =>
  ['key' + i, { source: i === 0 ? 'Принято ⟦0⟧' : 'Текст' }]));
const messages = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value.source]));
const catalog = () => ({ language: 'en', messages: { ...messages } });
test('accepts complete catalog and preserves placeholders', () => {
  const checked = validateCatalog(catalog(), source, 'en');
  assert.equal(Object.keys(checked.messages).length, 639);
  assert.ok(Object.isFrozen(checked.messages));
});
for (const [name, change] of [
  ['missing key', c => { delete c.messages.key1; }],
  ['substituted key', c => { delete c.messages.key1; c.messages.rogue = 'X'; }],
  ['empty translation', c => { c.messages.key1 = ''; }],
  ['lost placeholder', c => { c.messages.key0 = 'Taken'; }],
  ['batch marker', c => { c.messages.key1 = 'MC0001: Test'; }],
  ['truncated protection marker', c => { c.messages.key1 = 'Translated ZXQABQX'; }],
  ['partial protection marker', c => { c.messages.key1 = 'Translated ZXQAB'; }],
  ['wrong language', c => { c.language = 'fr'; }]
]) test('rejects ' + name, () => {
  const c = catalog(); change(c);
  assert.throws(() => validateCatalog(c, source, 'en'));
});
test('loads a valid public catalog from expected path', async () => {
  const checked = await loadCatalog('en', source, async (url) => {
    assert.equal(url, 'locales/catalogs/en.json');
    return { ok: true, json: async () => catalog() };
  });
  assert.equal(checked.language, 'en');
});
test('rejects unsafe locale and unavailable catalog', async () => {
  await assert.rejects(() => loadCatalog('../bad', source, async () => { throw Error('must not fetch'); }));
  await assert.rejects(() => loadCatalog('fr', source, async () => ({ ok: false })));
});
