const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { activate } = require('../../js/modular3-locale-activation.js');
const prepare = require('../../js/modular3-locale-preparation.js');
const loader = require('../../js/modular3-public-catalog-loader.js');
const adapter = require('../../js/modular3-legacy-locale-adapter.js');
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'locales/source-ru.json'), 'utf8'));
const english = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalogs/en.json'), 'utf8'));
const fallback = Object.freeze({ nav_input: 'Input fallback', weekday_short: ['Mon','Tue'] });
test('activates real catalog only after validated preparation', async () => {
  let registered = null;
  const result = await activate('en', {
    source, fallback, loader, adapter, prepare,
    fetcher: async () => ({ ok: true, json: async () => english }),
    register: prepared => { registered = prepared; return prepared.language; }
  });
  assert.equal(result, 'en');
  assert.ok(Object.isFrozen(registered));
  assert.equal(registered.labels.nav_input, english.messages[adapter.KEY_TO_CATALOG_ID.nav_input]);
  assert.deepEqual(registered.labels.weekday_short, ['Mon','Tue']);
});
test('never registers a missing or invalid catalog', async () => {
  let count = 0;
  const register = () => { count++; };
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ language: 'en', messages: {} }) })
  ]) {
    await assert.rejects(() => activate('en', { source, fallback, loader, adapter, prepare, fetcher, register }));
  }
  assert.equal(count, 0);
});
test('rejects missing activation dependencies', async () => {
  await assert.rejects(() => activate('en', {}));
});
