function fixPreviewNavigation() {
  if (window.location.hostname !== 'htmlpreview.github.io') return;

  const target = decodeURIComponent(window.location.search.replace(/^\?/, ''));
  if (!/^https:\/\/github\.com\/.+\/blob\/.+\/(input|action|dashboard)\.html(?:[?#].*)?$/.test(target)) return;

  const base = target.replace(/(input|action|dashboard)\.html(?:[?#].*)?$/, '');
  document.querySelectorAll('.nav a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!/^(input|action|dashboard)\.html$/.test(href || '')) return;
    link.setAttribute(
      'href',
      `https://htmlpreview.github.io/?${base}${href}`
    );
  });
}

window.mount = function(page) {
  const state = getState();

  if (!TRANSLATIONS[state.settings.interfaceLanguage]) {
    state.settings.interfaceLanguage = 'en';
    saveState(state);
  }

  let result;
  if (page === 'input') result = renderInputPage();
  else if (page === 'dashboard') result = renderDashboardPage();
  else if (page === 'action') result = renderActionPage();
  else if (page === 'settings') result = renderSettingsPage();

  fixPreviewNavigation();
  return result;
};