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
          <div><label>${escapeHtml(tr('language'))}</label><select id="settingsInterfaceLanguage" onchange="changeInterfaceLanguage(this.value)">${SUPPORTED_LANGUAGES.filter(([id]) => !!TRANSLATIONS[id] || id === 'ru' || id === 'en').map(([id,label]) => `<option value="${id}" ${state.settings.interfaceLanguage === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div>
          <div><label>${escapeHtml(tr('country'))}</label><select id="settingsCountry" onchange="changeCountry(this.value)">${COUNTRY_OPTIONS.map(country => `<option value="${country}" ${state.settings.country === country ? 'selected' : ''}>${escapeHtml(country)}</option>`).join('')}</select></div>
          <div><label>${escapeHtml(tr('timezone'))}</label><input readonly value="${escapeHtml(state.settings.timezone)}"></div>
          <div><label>${escapeHtml(tr('patient_data'))}</label><input readonly value="${escapeHtml(tr('patient_data_value'))}"></div>
          <div><label>${escapeHtml(tr('language'))}</label><input readonly value="${escapeHtml(activeLabel)}"></div>
        </div>
      </div>
      <div class="card"><h2>${escapeHtml(tr('settings_title_2'))}</h2>
        <div class="help"><ul>
          <li>${escapeHtml(tr('settings_help_1'))}</li>
          <li>${escapeHtml(tr('settings_help_2'))}</li>
          <li>${escapeHtml(tr('settings_help_3'))}</li>
          <li>${escapeHtml(tr('settings_help_4'))}</li>
          <li>${escapeHtml(tr('settings_help_5'))}</li>
        </ul></div>
      </div>
    </section>`;
  document.body.innerHTML = appShell(tr('title_settings'), 'settings', body);
  scheduleClock();
}
window.changeInterfaceLanguage = function(language) {
  const state = getState();

  if (language === '__auto__') {
    state.settings.languageMode = 'auto';

    const detected = detectLanguage();
    state.settings.detectedLanguage = detected;
    state.settings.interfaceLanguage =
      TRANSLATIONS[detected] ? detected : 'en';

  } else {

    state.settings.languageMode = 'manual';
    state.settings.interfaceLanguage =
      TRANSLATIONS[language] ? language : 'en';

  }

  saveState(state);
  window.location.reload();
};

window.changeCountry = function(country) {
  const state = getState();
  state.settings.country = country;
  saveState(state);
  mount('settings');
};
