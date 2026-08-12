window.mount = function(page) {
  const state = getState();

  if (!TRANSLATIONS[state.settings.interfaceLanguage]) {
    state.settings.interfaceLanguage = 'en';
    saveState(state);
  }

  if (page === 'input') return renderInputPage();
  if (page === 'dashboard') return renderDashboardPage();
  if (page === 'action') return renderActionPage();
  if (page === 'settings') return renderSettingsPage();
};