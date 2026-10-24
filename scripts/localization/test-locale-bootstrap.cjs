const assert = require('node:assert/strict');
const { test } = require('node:test');
const { install } = require('../../js/modular3-locale-bootstrap.js');
test('built-in languages never fetch or load scripts', async () => {
  let calls = 0;
  for (const language of ['ru','en']) assert.equal(await install({language,fetcher:()=>{calls++;}}),false);
  assert.equal(calls,0);
});
test('unavailable source leaves existing UI untouched', async () => {
  let loaded = 0, registered = 0;
  assert.equal(await install({language:'hy',fallback:{},fetcher:async()=>({ok:false}),loadScript:async()=>{loaded++;},register:()=>{registered++;}}),false);
  assert.equal(loaded,0);
  assert.equal(registered,0);
});
test('invalid language is rejected before any network request', async () => {
  let calls = 0;
  assert.equal(await install({language:'../hy',fallback:{},fetcher:async()=>{calls++;},loadScript:async()=>{},register:()=>{}}),false);
  assert.equal(calls,0);
});
test('script loading failure is isolated from existing interface', async () => {
  let registered = 0;
  assert.equal(await install({language:'hy',fallback:{nav_input:'Input'},fetcher:async()=>({ok:true,json:async()=>({})}),loadScript:async()=>{throw Error('offline');},register:()=>{registered++;}}),false);
  assert.equal(registered,0);
});
