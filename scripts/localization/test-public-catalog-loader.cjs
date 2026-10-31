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

// Real Filipino catalog regression: source keys, placeholders and loader path.
test('loads and validates the real Filipino catalog against the Russian source', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  const realSource = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
  const filipino = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/fil.json'), 'utf8'));
  const checked = await loadCatalog('fil', realSource, async (url) => {
    assert.equal(url, 'locales/catalogs/fil.json');
    return { ok: true, json: async () => filipino };
  });
  assert.equal(checked.language, 'fil');
  assert.equal(Object.keys(checked.messages).length, 639);
  assert.equal(checked.messages['4736e0eec69e370d'], 'Hindi sinasadyang pagpindot');
  assert.equal(checked.messages['bf22dfeeba8b8508'], 'Pagkakamali');
});

// All published languages must load from their actual files, not synthetic fixtures.
test('validates every manifest language catalog against the Russian reference', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  const reference = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
  assert.equal(manifest.length, 96);
  assert.equal(new Set(manifest.map(item => item.code)).size, manifest.length);
  for (const { code } of manifest) {
    const actual = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs', code + '.json'), 'utf8'));
    const checked = await loadCatalog(code, reference, async url => {
      assert.equal(url, 'locales/catalogs/' + code + '.json');
      return { ok: true, json: async () => actual };
    });
    assert.equal(checked.language, code);
    assert.equal(Object.keys(checked.messages).length, 639);
  }
});
