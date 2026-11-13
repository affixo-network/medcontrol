function renderSettingsPage() {
  const state = getState();
  const detectedLabel = (SUPPORTED_LANGUAGES.find(x => x[0] === state.settings.detectedLanguage) || ['en','English'])[1];
  const activeLabel = (SUPPORTED_LANGUAGES.find(x => x[0] === state.settings.interfaceLanguage) || ['en','English'])[1];
  const body = `
    <section class="card"><h1>${escapeHtml(tr('title_settings'))}</h1><p>${escapeHtml(tr('settings_intro'))}</p></section>
    <section class="grid2">
      <div class="card"><h2>${escapeHtml(tr('settings_title_1'))}</h2>
        <div class="form-grid">
          <div><label>${escapeHtml(tr('auto_detected_language'))}</label><input readonly value="${escapeHtml(detectedLabel)}"></div>
          <div><label>${escapeHtml(tr('language'))}</label><input id="settingsLanguageSearch" type="search" autocomplete="off" placeholder="Search language / Поиск языка" oninput="filterMedControlLanguages(this.value)" aria-label="Search language"><div id="settingsLanguageMatches" role="listbox" style="max-height:240px;overflow:auto"></div><p id="settingsLanguageSuggestion" class="muted"></p></div>
          <div><label>${escapeHtml(tr('country'))}</label><select id="settingsCountry" onchange="changeCountry(this.value)">${COUNTRY_OPTIONS.map(country => `<option value="${country}" ${state.settings.country === country ? 'selected' : ''}>${escapeHtml(country)}</option>`).join('')}</select></div>
          <div><label>${escapeHtml(tr('timezone'))}</label><input readonly value="${escapeHtml(state.settings.timezone)}"></div>
          <div><label>${escapeHtml(tr('patient_data'))}</label><input readonly value="${escapeHtml(tr('patient_data_value'))}"></div>
          <div><label>${escapeHtml(tr('language'))}</label><input readonly value="${escapeHtml(activeLabel)}"></div>
        </div>
      </div>
      <div class="card"><h2>${escapeHtml(tr('settings_title_2'))}</h2>
        <div class="help"><ul>
          <li>${escapeHtml(tr('settings_help_1'))}</li><li>${escapeHtml(tr('settings_help_2'))}</li><li>${escapeHtml(tr('settings_help_3'))}</li><li>${escapeHtml(tr('settings_help_4'))}</li><li>${escapeHtml(tr('settings_help_5'))}</li>
        </ul></div>
      </div>
    </section>`;
  document.body.innerHTML = appShell(tr('title_settings'), 'settings', body);
  scheduleClock();
  renderMedControlLanguageSearch();
}
window.changeInterfaceLanguage = async function(language) {
  const state = getState();
  // Prepare a catalog before changing encrypted settings; failed loads preserve the old language.
  if (!TRANSLATIONS[language] && window.medcontrolProtectedInterface &&
      SUPPORTED_LANGUAGES.some(([code]) => code === language)) {
    try {
      // The auth guard's loadScript is private; use a page-local loader here.
      const loadLocaleScript = async (path) => {
        // Reuse a module only after its API is ready; a pending script tag is not proof of loading.
        const moduleApi = {
          'js/modular3-locale-bootstrap.js': 'MedControlLocaleBootstrap',
          'js/modular3-public-catalog-loader.js': 'MedControlCatalogLoader',
          'js/modular3-legacy-locale-adapter.js': 'MedControlLegacyLocaleAdapter',
          'js/modular3-locale-preparation.js': 'MedControlLocalePreparation',
          'js/modular3-locale-activation.js': 'MedControlLocaleActivation'
        };
        if (moduleApi[path] && window[moduleApi[path]]) return;
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = path;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Language module unavailable'));
          document.head.appendChild(script);
        });
      };
      if (!window.MedControlLocaleBootstrap) await loadLocaleScript('js/modular3-locale-bootstrap.js');
      await window.MedControlLocaleBootstrap.install({
        language, fallback: TRANSLATIONS.en, fetcher: window.fetch.bind(window),
        loadScript: loadLocaleScript, register: registerPreparedLanguage
      });
    } catch (_) { /* Existing language remains selected. */ }
  }
  if (!TRANSLATIONS[language]) {
    const selector = document.getElementById('settingsInterfaceLanguage');
    if (selector) selector.value = state.settings.interfaceLanguage;
    return false;
  }
  // Cache the selected language before committing encrypted settings.
  // Failure must preserve the existing language and medical state.
  if (window.medcontrolProtectedInterface && language !== 'ru' && language !== 'en') {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const ready = await navigator.serviceWorker.ready;
      const worker = ready.active;
      if (!worker) throw new Error('Offline language cache worker unavailable');
      {
        const assets = ['/locales/source-ru.json', '/locales/catalogs/' + language + '.json',
          '/js/modular3-locale-bootstrap.js', '/js/modular3-public-catalog-loader.js',
          '/js/modular3-legacy-locale-adapter.js', '/js/modular3-locale-preparation.js',
          '/js/modular3-locale-activation.js'];
        await new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          const timeout = setTimeout(() => reject(new Error('Language offline cache timed out')), 30000);
          channel.port1.onmessage = event => {
            clearTimeout(timeout);
            event.data?.ok === true ? resolve() : reject(new Error('Language offline cache failed'));
          };
          worker.postMessage({ type: 'MEDCONTROL_CACHE_SHELL', paths: assets }, [channel.port2]);
        });
      }
    } catch (error) {
      console.warn('Selected language offline cache unavailable.', error);
      const selector = document.getElementById('settingsInterfaceLanguage');
      if (selector) selector.value = state.settings.interfaceLanguage;
      return false;
    }
  }

  const previousLanguage = state.settings.interfaceLanguage;
  state.settings.interfaceLanguage = language;
  try {
    if (!(await saveStateAsync(state))) {
      state.settings.interfaceLanguage = previousLanguage;
      await mount('settings');
      return false;
    }
  } catch (error) {
    state.settings.interfaceLanguage = previousLanguage;
    throw error;
  }
  window.location.reload();
  return true;
};
window.changeCountry = async function(country) {
  const state = getState();
  state.settings.country = country;
  if (!(await saveStateAsync(state))) { (await mount('settings')); return false; }
  (await mount('settings'));
  return true;
};
const MEDCONTROL_LANGUAGE_ALIASES = Object.freeze({
  hy: ['Armenian', 'Армянский', 'hayeren', 'hayeren'],
  ru: ['Russian', 'Русский', 'russkiy'],
  en: ['English', 'Английский', 'angliyskiy'],
  fr: ['French', 'Французский', 'francais'],
  de: ['German', 'Немецкий', 'deutsch'],
  es: ['Spanish', 'Испанский', 'espanol'],
  it: ['Italian', 'Итальянский', 'italiano'],
  pt: ['Portuguese', 'Португальский', 'portugues'],
  ka: ['Georgian', 'Грузинский', 'kartuli'],
  el: ['Greek', 'Греческий', 'ellinika'],
  ar: ['Arabic', 'Арабский', 'arabic']
});
function normalizeMedControlLanguageQuery(value) {
  return String(value || '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase().trim();
}
function medControlDeviceLanguage() {
  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    const code = String(candidate).toLowerCase().split('-')[0];
    if (SUPPORTED_LANGUAGES.some(([id]) => id === code)) return code;
  }
  return 'en';
}
function renderMedControlLanguageSearch(query = '') {
  const target = document.getElementById('settingsLanguageMatches');
  if (!target) return;
  const current = getState().settings.interfaceLanguage;
  const device = medControlDeviceLanguage();
  const normalized = normalizeMedControlLanguageQuery(query);
  const matches = SUPPORTED_LANGUAGES.filter(([code, name]) =>
    !normalized || [name, code, ...(MEDCONTROL_LANGUAGE_ALIASES[code] || [])]
      .some(alias => normalizeMedControlLanguageQuery(alias).includes(normalized)));
  const suggested = document.getElementById('settingsLanguageSuggestion');
  if (suggested) {
    const label = SUPPORTED_LANGUAGES.find(([code]) => code === device)?.[1] || 'English';
    suggested.textContent = 'Device language / Язык устройства: ' + label;
  }
  const ordered = normalized ? matches : [
    ...matches.filter(([code]) => code === device),
    ...matches.filter(([code]) => code === current && code !== device),
    ...matches.filter(([code]) => code !== device && code !== current)
  ];
  target.replaceChildren();
  for (const [code, name] of ordered.slice(0, normalized ? 20 : 8)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(code === current));
    button.textContent = name + (code === current ? ' ✓' : '');
    button.style.margin = '3px';
    button.onclick = () => { window.changeInterfaceLanguage(code); };
    target.appendChild(button);
  }
  if (!ordered.length) target.textContent = 'No matching language / Язык не найден';
}
window.filterMedControlLanguages = renderMedControlLanguageSearch;
