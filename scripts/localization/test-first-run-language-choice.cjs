'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'locales/manifest.json'), 'utf8'));
const settings = fs.readFileSync(path.join(root, 'js/settings.js'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'js/auth-guard.js'), 'utf8');
const tail = settings.slice(settings.indexOf('const MEDCONTROL_CANONICAL_LANGUAGES ='));
assert.ok(tail.startsWith('const MEDCONTROL_CANONICAL_LANGUAGES'), 'Canonical search registry must exist');
const firstRun = guard.match(/  function offerFirstRunLanguage\(\) \{[\s\S]*?\n  \}/);
assert.ok(firstRun, 'First-run language dialog must exist');

function executeSettings(locale = 'hy-AM') {
  const state = { settings: { interfaceLanguage: 'en' } };
  const context = {
    window: {},
    navigator: { languages: [locale], language: locale },
    getState: () => state,
    document: { getElementById: () => null },
    console
  };
  vm.createContext(context);
  vm.runInContext(tail, context);
  return { context, state };
}
test('every permanent ID and native language has complete Russian search coverage', () => {
  const { context } = executeSettings();
  const actual = JSON.parse(vm.runInContext('JSON.stringify(MEDCONTROL_CANONICAL_LANGUAGES)', context));
  assert.equal(actual.length, 96);
  for (let i = 0; i < 96; i++) {
    assert.equal(actual[i].id, i + 1);
    assert.equal(actual[i].code, manifest[i].code);
  }
  const diagnostics = JSON.parse(vm.runInContext("JSON.stringify(MEDCONTROL_CANONICAL_LANGUAGES.filter(item => item.id <= 95).map(item => ({ id: item.id, aliases: medControlLanguageSearchAliases(item) })))", context));
  assert.equal(diagnostics.length, 95);
  for (const item of diagnostics) {
    assert.ok(item.aliases.length >= 10, 'Insufficient search forms for ID ' + item.id);
    assert.ok(item.aliases.some(x => /[а-яё]/i.test(x)), 'Russian name absent for ID ' + item.id);
  }
});
test('native, Russian, English and romanized searches find Armenian and Georgian offline', () => {
  const { context } = executeSettings();
  for (const [query, code] of [
    ['Հայերեն', 'hy'], ['Армянский', 'hy'], ['Armenian', 'hy'],
    ['hayeren', 'hy'], ['ქართული', 'ka'], ['Грузинский', 'ka'],
    ['kartuli', 'ka'], ['Deutsch', 'de'], ['Немецкий', 'de']
  ]) {
    context.searchTerm = query;
    const hits = JSON.parse(vm.runInContext(
      'JSON.stringify(MEDCONTROL_CANONICAL_LANGUAGES.filter(item => item.id <= 95 && medControlLanguageSearchAliases(item).some(alias => alias.includes(normalizeMedControlLanguageQuery(searchTerm)))).map(item => item.code))', context));
    assert.ok(hits.includes(code), query + ' must match ' + code);
  }
});
function mockElement(tag) {
  return {
    tag, children: [], style: {}, value: '', textContent: '', onclick: null, oninput: null,
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; },
    setAttribute(key, value) { (this.attrs ||= {})[key] = value; },
    querySelector(tagName) { return this.children.find(child => child.tag === tagName) || null; },
    focus() {}
  };
}
test('first protected launch asks confirmation without changing saved language', async () => {
  const { context, state } = executeSettings('hy-AM');
  let dialog = null;
  let requested = null;
  context.window.medcontrolProtectedInterface = true;
  context.window.changeInterfaceLanguage = async code => { requested = code; return true; };
  context.document = {
    createElement: mockElement,
    getElementById: id => dialog?.id === id ? dialog : null,
    body: { appendChild: node => { dialog = node; } }
  };
  vm.runInContext(firstRun[0] + '\nofferFirstRunLanguage();', context);
  assert.ok(dialog, 'dialog must be displayed');
  assert.equal(dialog.attrs.role, 'dialog');
  assert.equal(state.settings.interfaceLanguage, 'en', 'language must not change before confirmation');
  const proposal = dialog.children.find(node => node.tag === 'p');
  assert.ok(proposal.textContent.includes('հայերեն'), 'device language shown in native script');
  const search = dialog.children.find(node => node.tag === 'input');
  const results = dialog.children.find(node => node.tag === 'div');
  assert.equal(results.children.length, 1, 'device language suggested at first launch');
  search.value = 'Армянский';
  search.oninput();
  assert.ok(results.children.some(node => node.textContent.includes('№30')));
  await results.children[0].onclick();
  assert.equal(requested, 'hy');
  assert.equal(state.settings.interfaceLanguage, 'en', 'test stub must not change persisted language');
  state.settings.languageChoiceConfirmed = true;
  dialog = null;
  vm.runInContext('offerFirstRunLanguage();', context);
  assert.equal(dialog, null, 'confirmed language must not prompt again');
});
test('unprotected UI does not show protected first-run dialog', () => {
  const { context } = executeSettings();
  context.window.medcontrolProtectedInterface = false;
  context.document = { getElementById: () => null };
  vm.runInContext(firstRun[0] + '\nofferFirstRunLanguage();', context);
});
