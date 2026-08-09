const STORAGE_KEY = 'affixo_medcontrol_standard_v3';
const STORAGE_CORRUPT_BACKUP_KEY = `${STORAGE_KEY}_corrupt_backup`;

function getState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);

      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        throw new Error('MedControl: invalid storage root.');
      }

      parsed.settings = parsed.settings || {};
      parsed.medications = Array.isArray(parsed.medications) ? parsed.medications : [];
      parsed.intakeLogs = Array.isArray(parsed.intakeLogs) ? parsed.intakeLogs : [];

      if (!parsed.settings.interfaceLanguage)
  parsed.settings.interfaceLanguage = 'en';

if (!TRANSLATIONS[parsed.settings.interfaceLanguage])
  parsed.settings.interfaceLanguage = 'en';

delete parsed.settings.detectedLanguage;
delete parsed.settings.languageMode;

      if (!parsed.settings.country)
        parsed.settings.country = inferCountryFromLocale();

      if (!parsed.settings.timezone)
        parsed.settings.timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      return parsed;
    } catch (err) {
      try {
        localStorage.setItem(STORAGE_CORRUPT_BACKUP_KEY, raw);
      } catch (backupError) {
        console.error('MedControl: failed to preserve corrupted storage.', backupError);
        throw err;
      }

      console.error('MedControl: corrupted storage preserved before recovery.', err);
    }
  }

  const initial = makeDefaultState();
  saveState(initial);
  return initial;
}

function saveState(state) {
  state.settings.timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('MedControl: failed to save application state.', error);

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(
        'Не удалось сохранить изменения MedControl.\n\n' +
        'Предыдущие сохранённые данные не изменены. ' +
        'Освободите место в хранилище браузера или проверьте его доступность и повторите действие.'
      );
    }

    return false;
  }
}
