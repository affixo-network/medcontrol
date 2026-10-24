/* Verify language registration in a browser-like isolated VM. No patient data. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../js/language.js'), 'utf8');
function context() {
  const state = { settings: { interfaceLanguage: 'ru' }, medications: [{ id: 7 }] };
  const translations = { ru: { nav_input: 'Ввод' }, en: { nav_input: 'Input' } };
  const sandbox = { TRANSLATIONS: translations, getState: () => state, navigator: { language: 'ru-RU', languages: ['ru-RU'] } };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, state, translations };
}
test('registers prepared locale without changing patient state or selected language', () => {
  const { sandbox, state, translations } = context();
  const before = JSON.stringify(state);
  const prepared = Object.freeze({ language: 'hy', labels: Object.freeze({ nav_input: 'Մուտք' }) });
  assert.equal(sandbox.registerPreparedLanguage(prepared), 'hy');
  assert.equal(translations.hy.nav_input, 'Մուտք');
  assert.equal(JSON.stringify(state), before);
  assert.equal(sandbox.tr('nav_input'), 'Ввод');
});
test('rejects unverified, unsupported, duplicate and built-in registrations', () => {
  const { sandbox, translations } = context();
  const good = Object.freeze({ language: 'hy', labels: Object.freeze({ nav_input: 'Մուտք' }) });
  assert.throws(() => sandbox.registerPreparedLanguage({ language: 'hy', labels: {} }));
  assert.throws(() => sandbox.registerPreparedLanguage(Object.freeze({ language: '../hy', labels: Object.freeze({}) })));
  assert.throws(() => sandbox.registerPreparedLanguage(Object.freeze({ language: 'zz', labels: Object.freeze({}) })));
  assert.throws(() => sandbox.registerPreparedLanguage(Object.freeze({ language: 'ru', labels: Object.freeze({}) })));
  assert.throws(() => sandbox.registerPreparedLanguage(Object.freeze({ language: 'en', labels: Object.freeze({}) })));
  sandbox.registerPreparedLanguage(good);
  assert.throws(() => sandbox.registerPreparedLanguage(good));
  assert.equal(translations.ru.nav_input, 'Ввод');
  assert.equal(translations.en.nav_input, 'Input');
});
test('registered language becomes selectable and translates when explicitly selected', () => {
  const { sandbox, state, translations } = context();
  sandbox.registerPreparedLanguage(Object.freeze({ language: 'hy', labels: Object.freeze({ nav_input: 'Մուտք' }) }));
  state.settings.interfaceLanguage = 'hy';
  assert.equal(sandbox.tr('nav_input'), translations.hy.nav_input);
  assert.equal(sandbox.tr('unknown'), 'unknown');
});
