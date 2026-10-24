/* Isolated public locale preparation tests. No protected state or medical records. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { prepare } = require('../../js/modular3-locale-preparation.js');
const loader = require('../../js/modular3-public-catalog-loader.js');
const adapter = require('../../js/modular3-legacy-locale-adapter.js');
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const english = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/en.json'), 'utf8'));
const fallback = Object.freeze({ nav_input: 'Fallback Input', nav_archive: 'Fallback Archive', weekday_short: ['Mon', 'Tue'], unknown: 'Keep' });
const fetcher = async (url, options) => {
  assert.equal(url, 'locales/catalogs/en.json');
  assert.equal(options.cache, 'no-store');
  return { ok: true, json: async () => english };
};
test('prepares validated real catalog and immutable labels without mutating fallback', async () => {
  const result = await prepare('en', { source, fallback, fetcher, loader, adapter });
  assert.equal(result.language, 'en');
  assert.equal(result.labels.nav_input, english.messages[adapter.KEY_TO_CATALOG_ID.nav_input]);
  assert.equal(result.labels.unknown, 'Keep');
  assert.deepEqual(result.labels.weekday_short, ['Mon', 'Tue']);
  assert.equal(fallback.nav_input, 'Fallback Input');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.labels));
});
test('rejects invalid options and invalid locale without fetching', async () => {
  await assert.rejects(() => prepare('en'));
  await assert.rejects(() => prepare('../en', { source, fallback, loader, adapter, fetcher: async () => { throw Error('Unexpected fetch'); } }));
});
test('rejects malformed catalog before adapting', async () => {
  let adapted = false;
  await assert.rejects(() => prepare('en', {
    source, fallback, loader,
    adapter: { adaptCatalog() { adapted = true; return {}; } },
    fetcher: async () => ({ ok: true, json: async () => ({ language: 'en', messages: {} }) })
  }));
  assert.equal(adapted, false);
});
test('propagates unavailable catalog without silently changing language', async () => {
  await assert.rejects(() => prepare('en', {
    source, fallback, loader, adapter, fetcher: async () => ({ ok: false })
  }), /Catalog unavailable/);
});
