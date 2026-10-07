function updateTopClock() {
  const now = new Date();
  const dateEl = document.getElementById('topCurrentDate');
  const timeEl = document.getElementById('topCurrentTime');
  if (dateEl && window.__medcontrolDateFormatter) dateEl.textContent = window.__medcontrolDateFormatter.format(now);
  if (timeEl && window.__medcontrolTimeFormatter) timeEl.textContent = window.__medcontrolTimeFormatter.format(now);
}
function scheduleClock() {
  const lang = getState().settings.interfaceLanguage === 'ru' ? 'ru-RU' : 'en-US';
  window.__medcontrolDateFormatter = new Intl.DateTimeFormat(lang, { day:'2-digit', month:'2-digit', year:'numeric' });
  window.__medcontrolTimeFormatter = new Intl.DateTimeFormat(lang, { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  updateTopClock();
  clearInterval(window.__medcontrolClock);
  window.__medcontrolClock = setInterval(updateTopClock, 1000);
}
