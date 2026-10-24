/* Pure adapter regression tests: synthetic fallback, no medical records. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { KEY_TO_CATALOG_ID, adaptCatalog } = require('../../js/modular3-legacy-locale-adapter.js');
test('mapping is unique and covers known legacy scalar keys', () => {
  assert.equal(Object.keys(KEY_TO_CATALOG_ID).length, 137);
  assert.equal(new Set(Object.values(KEY_TO_CATALOG_ID)).size, 137);
  assert.equal(Object.hasOwn(KEY_TO_CATALOG_ID, 'weekday_short'), false);
});
test('mapped translation replaces only corresponding scalar fallback', () => {
  const id = KEY_TO_CATALOG_ID.title_dashboard;
  assert.ok(id);
  const fallback = { title_dashboard: 'Dashboard', untouched: 'Keep me', weekday_short: ['Mon', 'Tue'] };
  const result = adaptCatalog({ messages: { [id]: 'Localized dashboard' } }, fallback);
  assert.equal(result.title_dashboard, 'Localized dashboard');
  assert.equal(result.untouched, 'Keep me');
  assert.deepEqual(result.weekday_short, ['Mon', 'Tue']);
  assert.equal(fallback.title_dashboard, 'Dashboard');
});
test('missing and empty translations leave fallback intact', () => {
  const id = KEY_TO_CATALOG_ID.title_dashboard;
  const fallback = { title_dashboard: 'Dashboard' };
  assert.equal(adaptCatalog({ messages: {} }, fallback).title_dashboard, 'Dashboard');
  assert.equal(adaptCatalog({ messages: { [id]: '  ' } }, fallback).title_dashboard, 'Dashboard');
});
test('rejects malformed catalog', () => {
  assert.throws(() => adaptCatalog(null, {}));
  assert.throws(() => adaptCatalog({ messages: [] }, {}));
});
