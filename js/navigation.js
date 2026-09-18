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
  const nav = document.querySelector('.nav'); if (!nav) return;
  let link = [...nav.querySelectorAll('a')].find(a => /archive\.html(?:$|[?#])/.test(a.getAttribute('href') || ''));
  if (!link) { link = document.createElement('a'); link.href = 'archive.html'; link.textContent = 'Архив'; nav.appendChild(link); }
  if (activePage === 'archive') link.classList.add('active');
}
function ensureLogoutNavigation() {
  const nav = document.querySelector('.nav'); if (!nav || nav.querySelector('[data-medcontrol-logout]')) return;
  const button = document.createElement('button'); button.type = 'button'; button.dataset.medcontrolLogout = '1'; button.textContent = 'Выйти';
  button.onclick = () => window.location.assign('/auth-login.html?logout=1'); nav.appendChild(button);
}
window.mount = function(page) {
  const state = getState();
  if (!TRANSLATIONS[state.settings.interfaceLanguage]) {
    state.settings.interfaceLanguage = 'en';
    if (!saveState(state)) return false;
  }
  let result;
  if (page === 'input') result = renderInputPage();
  else if (page === 'dashboard') result = renderDashboardPage();
  else if (page === 'action') result = renderActionPage();
  else if (page === 'settings') result = renderSettingsPage();
  ensureArchiveNavigation(page); ensureLogoutNavigation(); fixPreviewNavigation(); return result;
};