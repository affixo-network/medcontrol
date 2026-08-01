function updateTopClock() {
  const state = getState();
  const lang = state.settings.interfaceLanguage === 'ru' ? 'ru-RU' : 'en-US';
  const now = new Date();
  const dateText = new Intl.DateTimeFormat(lang, { day:'2-digit', month:'2-digit', year:'numeric' }).format(now);
  const timeText = new Intl.DateTimeFormat(lang, { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);
  const dateEl = document.getElementById('topCurrentDate');
  const timeEl = document.getElementById('topCurrentTime');
  if (dateEl) dateEl.textContent = dateText;
  if (timeEl) timeEl.textContent = timeText;
}
function scheduleClock() {
  updateTopClock();
  clearInterval(window.__medcontrolClock);
  window.__medcontrolClock = setInterval(updateTopClock, 1000);
}
