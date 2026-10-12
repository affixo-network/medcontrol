'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/modular3-script-loader.js');
const createLoader = globalThis.MedControlScriptLoader.createLoader;

test('loader does not load scripts on import', () => {
  let calls = 0;
  createLoader({ load: () => { calls++; } });
  assert.equal(calls, 0);
});

test('loads scripts in strict declared order', async () => {
  const calls = [];
  const loader = createLoader({load: async src => { calls.push(src); await Promise.resolve(); }});
  await loader.ensureScripts(['js/a.js', 'js/b.js', 'js/c.js']);
  assert.deepEqual(calls, ['js/a.js', 'js/b.js', 'js/c.js']);
});

test('deduplicates paths across cache-busting query strings', async () => {
  const calls = [];
  const loader = createLoader({load: async src => {calls.push(src);}});
  await loader.ensureScripts(['js/a.js?v=1', 'js/a.js?v=2']);
  assert.deepEqual(calls, ['js/a.js?v=1']);
  assert.equal(loader.isLoaded('js/a.js?v=3'), true);
});

test('coalesces concurrent loads of same path', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  const loader = createLoader({load: async () => {calls++; await gate;}});
  const a = loader.ensureScript('js/a.js?v=1');
  const b = loader.ensureScript('js/a.js?v=2');
  release();
  await Promise.all([a,b]);
  assert.equal(calls,1);
});

test('failed load remains retryable', async () => {
  let calls = 0;
  const loader = createLoader({load: async () => {if (++calls === 1) throw new Error('network');}});
  await assert.rejects(loader.ensureScript('js/a.js'), /network/);
  assert.equal(loader.isLoaded('js/a.js'), false);
  await loader.ensureScript('js/a.js');
  assert.equal(calls,2);
});

test('rejects missing loader and invalid input', async () => {
  assert.throws(() => createLoader({}), /required/);
  const loader = createLoader({load: async () => {}});
  await assert.rejects(loader.ensureScript(''), /Invalid/);
  await assert.rejects(loader.ensureScripts('js/a.js'), /array/);
});
