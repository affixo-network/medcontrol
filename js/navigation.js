window.mount = function(page) {
  const state = getState();

  if (!TRANSLATIONS[state.settings.interfaceLanguage]) {
    state.settings.interfaceLanguage = 'en';
    saveState(state);
  }

  if (page === 'input') return window.renderInputPage();
  if (page === 'dashboard') return window.renderDashboardPage();
  if (page === 'action') return window.renderActionPage();
  if (page === 'settings') return window.renderSettingsPage();
};