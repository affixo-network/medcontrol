const STORAGE_KEY = 'affixo_medcontrol_standard_v3';

function getState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.settings = parsed.settings || {};
      parsed.medications = Array.isArray(parsed.medications) ? parsed.medications : [];
      parsed.intakeLogs = Array.isArray(parsed.intakeLogs) ? parsed.intakeLogs : [];

      if (!parsed.settings.detectedLanguage)
        parsed.settings.detectedLanguage = detectLanguage();
      if (!parsed.settings.languageMode)
        parsed.settings.languageMode = 'auto';
      if (!parsed.settings.interfaceLanguage)
        parsed.settings.interfaceLanguage =
          TRANSLATIONS[parsed.settings.detectedLanguage]
            ? parsed.settings.detectedLanguage
            : 'en';

      if (!parsed.settings.country)
        parsed.settings.country = inferCountryFromLocale();

      if (!parsed.settings.timezone)
        parsed.settings.timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      return parsed;
    } catch (err) {}
  }

  const initial = makeDefaultState();
  saveState(initial);
  return initial;
}

function saveState(state) {
  state.settings.timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
