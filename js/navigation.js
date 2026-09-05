function fixPreviewNavigation() {
  if (window.location.hostname !== 'htmlpreview.github.io') return;

  const target = decodeURIComponent(window.location.search.replace(/^\?/, ''));
  if (!/^https:\/\/github\.com\/.+\/blob\/.+\/(input|action|dashboard|archive)\.html(?:[?#].*)?$/.test(target)) return;

  const base = target.replace(/(input|action|dashboard|archive)\.html(?:[?#].*)?$/, '');
  document.querySelectorAll('.nav a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!/^(input|action|dashboard|archive)\.html$/.test(href || '')) return;
    link.setAttribute('href', `https://htmlpreview.github.io/?${base}${href}`);
  });
}

function ensureArchiveNavigation(activePage) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let link = [...nav.querySelectorAll('a')].find(a => /archive\.html(?:$|[?#])/.test(a.getAttribute('href') || ''));
  if (!link) {
    link = document.createElement('a');
    link.href = 'archive.html';
    link.textContent = 'Архив';
    nav.appendChild(link);
  }
  if (activePage === 'archive') link.classList.add('active');
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

  ensureArchiveNavigation(page);
  fixPreviewNavigation();
  return result;
};