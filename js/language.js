const SUPPORTED_LANGUAGES = [
  ['ru', "русский"],
  ['eu', "euskara"],
  ['ka', "ქართული"],
  ['km', "ខ្មែរ"],
  ['fa', "فارسی"],
  ['ro', "română"],
  ['th', "ไทย"],
  ['en', "English"],
  ['af', "Afrikaans"],
  ['sq', "shqip"],
  ['am', "አማርኛ"],
  ['ar', "العربية"],
  ['hy', "հայերեն"],
  ['az', "azərbaycan"],
  ['be', "беларуская"],
  ['bn', "বাংলা"],
  ['bs', "bosanski"],
  ['bg', "български"],
  ['ca', "català"],
  ['ceb', "Cebuano"],
  ['zh', "中文"],
  ['co', "Corsican"],
  ['hr', "hrvatski"],
  ['cs', "čeština"],
  ['da', "dansk"],
  ['nl', "Nederlands"],
  ['eo', "Esperanto"],
  ['et', "eesti"],
  ['fi', "suomi"],
  ['fil', "Filipino"],
  ['fr', "français"],
  ['fy', "Frysk"],
  ['gl', "galego"],
  ['de', "Deutsch"],
  ['el', "Ελληνικά"],
  ['gu', "ગુજરાતી"],
  ['ht', "Haitian Creole"],
  ['ha', "Hausa"],
  ['he', "עברית"],
  ['hi', "हिन्दी"],
  ['hmn', "Hmong"],
  ['hu', "magyar"],
  ['is', "íslenska"],
  ['ig', "Igbo"],
  ['id', "Indonesia"],
  ['ga', "Gaeilge"],
  ['it', "italiano"],
  ['ja', "日本語"],
  ['jv', "Jawa"],
  ['kn', "ಕನ್ನಡ"],
  ['kk', "қазақ тілі"],
  ['ko', "한국어"],
  ['ku', "kurdî (kurmancî)"],
  ['ky', "кыргызча"],
  ['lo', "ລາວ"],
  ['lv', "latviešu"],
  ['lt', "lietuvių"],
  ['lb', "Lëtzebuergesch"],
  ['mk', "македонски"],
  ['mg', "Malagasy"],
  ['ms', "Melayu"],
  ['ml', "മലയാളം"],
  ['mt', "Malti"],
  ['mr', "मराठी"],
  ['mn', "монгол"],
  ['my', "မြန်မာ"],
  ['ne', "नेपाली"],
  ['no', "norsk"],
  ['ps', "پښتو"],
  ['pl', "polski"],
  ['pt', "português"],
  ['pa', "ਪੰਜਾਬੀ"],
  ['gd', "Gàidhlig"],
  ['sr', "српски"],
  ['sd', "سنڌي"],
  ['si', "සිංහල"],
  ['sk', "slovenčina"],
  ['sl', "slovenščina"],
  ['so', "Soomaali"],
  ['es', "español"],
  ['su', "Basa Sunda"],
  ['sw', "Kiswahili"],
  ['sv', "svenska"],
  ['tg', "тоҷикӣ"],
  ['ta', "தமிழ்"],
  ['te', "తెలుగు"],
  ['tr', "Türkçe"],
  ['uk', "українська"],
  ['ur', "اردو"],
  ['uz', "o‘zbek"],
  ['vi', "Tiếng Việt"],
  ['cy', "Cymraeg"],
  ['xh', "IsiXhosa"],
  ['yi', "ייִדיש"],
  ['yo', "Èdè Yorùbá"],
  ['zu', "isiZulu"]
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
