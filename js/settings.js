function renderSettingsPage() {
  const state = getState();
  const detectedLabel = (SUPPORTED_LANGUAGES.find(x => x[0] === medControlDeviceLanguage()) || ['en','English'])[1];
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
    const legacySelector = document.getElementById('settingsInterfaceLanguage');
    if (legacySelector) legacySelector.value = state.settings.interfaceLanguage;
    if (typeof window.filterMedControlLanguages === 'function') window.filterMedControlLanguages(document.getElementById('settingsLanguageSearch')?.value || '');
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
      const legacySelector = document.getElementById('settingsInterfaceLanguage');
    if (legacySelector) legacySelector.value = state.settings.interfaceLanguage;
    if (typeof window.filterMedControlLanguages === 'function') window.filterMedControlLanguages(document.getElementById('settingsLanguageSearch')?.value || '');
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
const MEDCONTROL_CANONICAL_LANGUAGES = Object.freeze([{"id":1,"code":"ru","name":"русский","englishName":"Russian"},{"id":2,"code":"en","name":"English","englishName":"English"},{"id":3,"code":"fr","name":"français","englishName":"French"},{"id":4,"code":"de","name":"Deutsch","englishName":"German"},{"id":5,"code":"es","name":"español","englishName":"Spanish"},{"id":6,"code":"it","name":"italiano","englishName":"Italian"},{"id":7,"code":"pt","name":"português","englishName":"Portuguese"},{"id":8,"code":"af","name":"Afrikaans","englishName":"Afrikaans"},{"id":9,"code":"am","name":"አማርኛ","englishName":"Amharic"},{"id":10,"code":"ar","name":"العربية","englishName":"Arabic"},{"id":11,"code":"az","name":"azərbaycan","englishName":"Azerbaijani"},{"id":12,"code":"be","name":"беларуская","englishName":"Belarusian"},{"id":13,"code":"bg","name":"български","englishName":"Bulgarian"},{"id":14,"code":"bn","name":"বাংলা","englishName":"Bangla"},{"id":15,"code":"bs","name":"bosanski","englishName":"Bosnian"},{"id":16,"code":"ca","name":"català","englishName":"Catalan"},{"id":17,"code":"cs","name":"čeština","englishName":"Czech"},{"id":18,"code":"da","name":"dansk","englishName":"Danish"},{"id":19,"code":"nl","name":"Nederlands","englishName":"Dutch"},{"id":20,"code":"et","name":"eesti","englishName":"Estonian"},{"id":21,"code":"fi","name":"suomi","englishName":"Finnish"},{"id":22,"code":"fy","name":"Frysk","englishName":"Western Frisian"},{"id":23,"code":"el","name":"Ελληνικά","englishName":"Greek"},{"id":24,"code":"gu","name":"ગુજરાતી","englishName":"Gujarati"},{"id":25,"code":"he","name":"עברית","englishName":"Hebrew"},{"id":26,"code":"hi","name":"हिन्दी","englishName":"Hindi"},{"id":27,"code":"gl","name":"galego","englishName":"Galician"},{"id":28,"code":"ka","name":"ქართული","englishName":"Georgian"},{"id":29,"code":"sq","name":"shqip","englishName":"Albanian"},{"id":30,"code":"hy","name":"հայերեն","englishName":"Armenian"},{"id":31,"code":"eu","name":"euskara","englishName":"Basque"},{"id":32,"code":"ceb","name":"Cebuano","englishName":"Cebuano"},{"id":33,"code":"zh","name":"中文","englishName":"Chinese"},{"id":34,"code":"co","name":"Corsican","englishName":"Corsican"},{"id":35,"code":"hr","name":"hrvatski","englishName":"Croatian"},{"id":36,"code":"eo","name":"Esperanto","englishName":"Esperanto"},{"id":37,"code":"ht","name":"Haitian Creole","englishName":"Haitian Creole"},{"id":38,"code":"ha","name":"Hausa","englishName":"Hausa"},{"id":39,"code":"hmn","name":"Hmong","englishName":"Hmong"},{"id":40,"code":"hu","name":"magyar","englishName":"Hungarian"},{"id":41,"code":"is","name":"íslenska","englishName":"Icelandic"},{"id":42,"code":"ig","name":"Igbo","englishName":"Igbo"},{"id":43,"code":"id","name":"Indonesia","englishName":"Indonesian"},{"id":44,"code":"ga","name":"Gaeilge","englishName":"Irish"},{"id":45,"code":"ja","name":"日本語","englishName":"Japanese"},{"id":46,"code":"jv","name":"Jawa","englishName":"Javanese"},{"id":47,"code":"kn","name":"ಕನ್ನಡ","englishName":"Kannada"},{"id":48,"code":"kk","name":"қазақ тілі","englishName":"Kazakh"},{"id":49,"code":"km","name":"ខ្មែរ","englishName":"Khmer"},{"id":50,"code":"ko","name":"한국어","englishName":"Korean"},{"id":51,"code":"ku","name":"kurdî (kurmancî)","englishName":"Kurdish"},{"id":52,"code":"ky","name":"кыргызча","englishName":"Kyrgyz"},{"id":53,"code":"lo","name":"ລາວ","englishName":"Lao"},{"id":54,"code":"lv","name":"latviešu","englishName":"Latvian"},{"id":55,"code":"lt","name":"lietuvių","englishName":"Lithuanian"},{"id":56,"code":"lb","name":"Lëtzebuergesch","englishName":"Luxembourgish"},{"id":57,"code":"mk","name":"македонски","englishName":"Macedonian"},{"id":58,"code":"mg","name":"Malagasy","englishName":"Malagasy"},{"id":59,"code":"ms","name":"Melayu","englishName":"Malay"},{"id":60,"code":"ml","name":"മലയാളം","englishName":"Malayalam"},{"id":61,"code":"mt","name":"Malti","englishName":"Maltese"},{"id":62,"code":"mr","name":"मराठी","englishName":"Marathi"},{"id":63,"code":"mn","name":"монгол","englishName":"Mongolian"},{"id":64,"code":"my","name":"မြန်မာ","englishName":"Burmese"},{"id":65,"code":"ne","name":"नेपाली","englishName":"Nepali"},{"id":66,"code":"no","name":"norsk","englishName":"Norwegian"},{"id":67,"code":"ps","name":"پښتو","englishName":"Pashto"},{"id":68,"code":"fa","name":"فارسی","englishName":"Persian"},{"id":69,"code":"pl","name":"polski","englishName":"Polish"},{"id":70,"code":"pa","name":"ਪੰਜਾਬੀ","englishName":"Punjabi"},{"id":71,"code":"ro","name":"română","englishName":"Romanian"},{"id":72,"code":"gd","name":"Gàidhlig","englishName":"Scottish Gaelic"},{"id":73,"code":"sr","name":"српски","englishName":"Serbian"},{"id":74,"code":"sd","name":"سنڌي","englishName":"Sindhi"},{"id":75,"code":"si","name":"සිංහල","englishName":"Sinhala"},{"id":76,"code":"sk","name":"slovenčina","englishName":"Slovak"},{"id":77,"code":"sl","name":"slovenščina","englishName":"Slovenian"},{"id":78,"code":"so","name":"Soomaali","englishName":"Somali"},{"id":79,"code":"su","name":"Basa Sunda","englishName":"Sundanese"},{"id":80,"code":"sw","name":"Kiswahili","englishName":"Swahili"},{"id":81,"code":"sv","name":"svenska","englishName":"Swedish"},{"id":82,"code":"tg","name":"тоҷикӣ","englishName":"Tajik"},{"id":83,"code":"ta","name":"தமிழ்","englishName":"Tamil"},{"id":84,"code":"te","name":"తెలుగు","englishName":"Telugu"},{"id":85,"code":"th","name":"ไทย","englishName":"Thai"},{"id":86,"code":"tr","name":"Türkçe","englishName":"Turkish"},{"id":87,"code":"uk","name":"українська","englishName":"Ukrainian"},{"id":88,"code":"ur","name":"اردو","englishName":"Urdu"},{"id":89,"code":"uz","name":"o‘zbek","englishName":"Uzbek"},{"id":90,"code":"vi","name":"Tiếng Việt","englishName":"Vietnamese"},{"id":91,"code":"cy","name":"Cymraeg","englishName":"Welsh"},{"id":92,"code":"xh","name":"IsiXhosa","englishName":"Xhosa"},{"id":93,"code":"yi","name":"ייִדיש","englishName":"Yiddish"},{"id":94,"code":"yo","name":"Èdè Yorùbá","englishName":"Yoruba"},{"id":95,"code":"zu","name":"isiZulu","englishName":"Zulu"},{"id":96,"code":"fil","name":"Filipino","englishName":"Filipino"}]);
const MEDCONTROL_LANGUAGE_ALIASES = Object.freeze({
  hy: ['Armenian', 'Армянский', 'hayeren'],
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
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
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
  const matches = MEDCONTROL_CANONICAL_LANGUAGES.filter(({id, code, name, englishName}) =>
    id <= 95 && (!normalized || [name, englishName, code, String(id), ...(MEDCONTROL_LANGUAGE_ALIASES[code] || [])]
      .some(alias => normalizeMedControlLanguageQuery(alias).includes(normalized))));
  const suggested = document.getElementById('settingsLanguageSuggestion');
  if (suggested) {
    const entry = MEDCONTROL_CANONICAL_LANGUAGES.find(({code}) => code === device);
    suggested.replaceChildren();
    const label = document.createElement('span');
    label.textContent = 'Device language / Язык устройства: ' + (entry?.name || 'English') + ' ';
    suggested.appendChild(label);
    if (entry && entry.code !== current && entry.id <= 95) {
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.textContent = 'Confirm / Подтвердить';
      confirm.onclick = () => { window.changeInterfaceLanguage(entry.code); };
      suggested.appendChild(confirm);
    }
  }
  const ordered = normalized ? matches : [
    ...matches.filter(({code}) => code === device),
    ...matches.filter(({code}) => code === current && code !== device),
    ...matches.filter(({code}) => code !== device && code !== current)
  ];
  target.replaceChildren();
  for (const {id, code, name} of ordered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(code === current));
    button.textContent = '№' + id + ' · ' + name + (code === current ? ' ✓' : '');
    button.style.margin = '3px';
    button.onclick = () => { window.changeInterfaceLanguage(code); };
    target.appendChild(button);
  }
  if (!ordered.length) target.textContent = 'No matching language / Язык не найден';
}
window.filterMedControlLanguages = renderMedControlLanguageSearch;
