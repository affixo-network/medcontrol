const SUPPORTED_LANGUAGES = [
  ['ru', 'Русский'],
  ['en', 'English'],
  ['hy', 'Հայերեն'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['ar', 'العربية'],
  ['zh', '中文'],
  ['ja', '日本語']
];
function detectLanguage() {
  const langs = [];
  if (Array.isArray(navigator.languages)) langs.push(...navigator.languages);
  if (navigator.language) langs.push(navigator.language);
  const normalized = langs.map(x => String(x || '').toLowerCase());
  for (const item of normalized) {
    const code = item.split('-')[0];
    if (SUPPORTED_LANGUAGES.some(([id]) => id === code) && TRANSLATIONS[code]) return code;
  }
  return 'en';
}

function inferCountryFromLocale() {
  const locale = navigator.language || 'en-US';
  const region = (locale.split('-')[1] || '').toUpperCase();
  const map = {
    AM: 'Armenia', AR: 'Argentina', AU: 'Australia', AT: 'Austria', BE: 'Belgium',
    BR: 'Brazil', CA: 'Canada', CN: 'China', EG: 'Egypt', FR: 'France',
    DE: 'Germany', IN: 'India', IT: 'Italy', JP: 'Japan', MX: 'Mexico',
    NL: 'Netherlands', RU: 'Russia', ES: 'Spain', SE: 'Sweden',
    CH: 'Switzerland', AE: 'United Arab Emirates',
    GB: 'United Kingdom', US: 'United States'
  };
  return map[region] || 'United States';
}
function tr(key) {
  const lang = getState().settings.interfaceLanguage;
  const table = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return table[key] || TRANSLATIONS.en[key] || key;
}

// Register only explicitly prepared public labels; never read or write medical state.
function registerPreparedLanguage(prepared) {
  if (!prepared || typeof prepared.language !== 'string' ||
      !/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(prepared.language) ||
      !prepared.labels || typeof prepared.labels !== 'object' || Array.isArray(prepared.labels) ||
      !Object.isFrozen(prepared.labels) || !Object.isFrozen(prepared)) {
    throw new Error('Unverified prepared language');
  }
  const code = prepared.language;
  if (!SUPPORTED_LANGUAGES.some(([id]) => id === code)) throw new Error('Unsupported interface language');
  if (code === 'ru' || code === 'en') throw new Error('Built-in translations cannot be overwritten');
  if (TRANSLATIONS[code]) throw new Error('Language already registered');
  TRANSLATIONS[code] = prepared.labels;
  return code;
}
