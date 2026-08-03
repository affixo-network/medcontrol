function addOrReplaceLog(medicationId, plannedAt, action, actualAt) {
  const state = getState();
  state.intakeLogs = state.intakeLogs.filter(log => !(log.medicationId === medicationId && log.plannedAt === plannedAt));
  state.intakeLogs.push({
    id: uid(),
    medicationId,
    plannedAt,
    actualAt,
    action,
    status: computeStatusForLog(plannedAt, actualAt, action)
  });
  saveState(state);
}
window.markTaken = function(medicationId, plannedAt) {
  addOrReplaceLog(medicationId, plannedAt, 'taken', nowISO());
  mount('action');
};
window.markCancelled = function(medicationId, plannedAt) {
  addOrReplaceLog(medicationId, plannedAt, 'cancelled', nowISO());
  mount('action');
};
window.openCorrection = function(medicationId, plannedAt) {
  const existing = getLogForSchedule(medicationId, plannedAt);
  const dialog = document.getElementById('correctionDialog');
  const content = document.getElementById('correctionContent');
  const defaultValue = existing ? existing.actualAt.slice(0,16) : nowISO().slice(0,16);
  content.innerHTML = `<div class="form-grid"><div><label>${escapeHtml(tr('choose_action'))}</label><select id="correction_action"><option value="taken">${escapeHtml(tr('take'))}</option><option value="cancelled">${escapeHtml(tr('cancel'))}</option></select></div><div><label>${escapeHtml(tr('mark_time'))}</label><input id="correction_time" type="datetime-local" value="${escapeHtml(defaultValue)}"></div><div class="full"><p class="muted">${escapeHtml(tr('correction_help'))}</p></div><div class="full right"><button onclick="applyCorrection('${medicationId}','${plannedAt}')">${escapeHtml(tr('apply_correction'))}</button> <button onclick="document.getElementById('correctionDialog').close()">${escapeHtml(tr('close'))}</button></div></div>`;
  if (existing) {
    const select = content.querySelector('#correction_action');
    if (select) select.value = existing.action;
  }
  dialog.showModal();
};
window.applyCorrection = function(medicationId, plannedAt) {
  const action = document.getElementById('correction_action').value;
  const localValue = document.getElementById('correction_time').value;
  if (!localValue) return alert('Укажите время исправления.');
  addOrReplaceLog(medicationId, plannedAt, action, new Date(localValue).toISOString());
  document.getElementById('correctionDialog').close();
  mount('action');
};
window.showIntakeHistory = function(medicationId) {
  window.__historyMedicationId = medicationId;
  refreshIntakeHistory();
  document.getElementById('intakeHistoryDialog').showModal();
};
window.refreshIntakeHistory = function() {
  const medicationId = window.__historyMedicationId;
  if (!medicationId) return;
  const period = document.getElementById('historyPeriodSelect')?.value || 'today';
  const content = document.getElementById('intakeHistoryContent');
  content.innerHTML = intakeHistoryRows(medicationId, period);
};
function getLogForSchedule(medicationId, plannedISO) {
  return getState().intakeLogs.find(log => log.medicationId === medicationId && log.plannedAt === plannedISO) || null;
}
function buildTodayEntries() {
  const dateISO = currentLocalDate();
  const now = Date.now();
  const entries = [];
  const state = getState();

  const medications = Array.isArray(state.medications)
    ? state.medications
    : [];

  medications.forEach(med => {
    if (!isMedicationApplicableOnDate(med, dateISO)) return;

    const times = Array.isArray(med.times)
      ? med.times
      : [];

    times.forEach(time => {
      if (!time) return;

      const plannedAt = getScheduledDateTime(dateISO, time);
      const plannedMs = new Date(plannedAt).getTime();

      if (Number.isNaN(plannedMs)) return;

      const log = getLogForSchedule(med.id, plannedAt);
      let boardState = null;

      if (!log) {
        if (plannedMs > now) {
          boardState = 'upcoming';
        } else if (
          plannedMs + DEFAULT_GRACE_MINUTES * 60 * 1000 < now
        ) {
          boardState = 'overdue';
        } else {
          boardState = 'expected';
        }
      }

      entries.push({
        medication: med,
        plannedTime: time,
        plannedAt,
        log,
        boardState,
        displayStatus: log
          ? computeStatusForLog(plannedAt, log.actualAt, log.action)
          : boardState
      });
    });
  });

  return entries.sort(
    (a, b) => new Date(a.plannedAt) - new Date(b.plannedAt)
  );
}
function recordRowHistory(med, action, payload) {
  med.rowHistory = Array.isArray(med.rowHistory) ? med.rowHistory : [];
  med.rowHistory.unshift({ at: nowISO(), action, payload });
}
function intakeHistoryRows(medId, period) {
  const logs = getState().intakeLogs.filter(log => log.medicationId === medId).filter(log => {
    if (period === 'all') return true;
    const actual = new Date(log.actualAt).getTime();
    const now = Date.now();
    if (period === 'today') return localDateFromISO(log.actualAt) === currentLocalDate();
    if (period === '7') return actual >= now - 7 * 24 * 60 * 60 * 1000;
    if (period === '30') return actual >= now - 30 * 24 * 60 * 60 * 1000;
    return true;
  }).sort((a,b) => new Date(b.actualAt) - new Date(a.actualAt));
  if (!logs.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  return `<table><thead><tr><th>${escapeHtml(tr('planned_time'))}</th><th>${escapeHtml(tr('actual_time'))}</th><th>${escapeHtml(tr('result'))}</th><th>${escapeHtml(tr('status'))}</th></tr></thead><tbody>${logs.map(log => `<tr><td>${escapeHtml(formatDateTime(log.plannedAt))}</td><td>${escapeHtml(formatDateTime(log.actualAt))}</td><td>${escapeHtml(log.action === 'taken' ? tr('take') : tr('cancel'))}</td><td>${escapeHtml(statusLabel(log.status))}</td></tr>`).join('')}</tbody></table>`;
}
function statusLabel(code) {
  const map = {
    expected: tr('expected'),
    upcoming: tr('upcoming'),
    overdue: tr('overdue'),
    taken_on_time: tr('taken_on_time'),
    taken_early: tr('taken_early'),
    taken_late: tr('taken_late'),
    cancelled: tr('cancelled')
  };
  return map[code] || code;
}
function statusClass(code) {
  if (code === 'expected') return 'status expected';
  if (code === 'upcoming') return 'status upcoming';
  if (code === 'overdue') return 'status overdue';
  return 'status success';
}
