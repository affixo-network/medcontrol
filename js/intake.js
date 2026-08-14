function addPrimaryLog(medicationId, plannedAt, action, actualAt) {
  const state = getState();
  const existing = getLogForScheduleFromState(state, medicationId, plannedAt);
  if (existing) return existing;
  const log = {
    id: uid(), medicationId, plannedAt, actualAt, action,
    status: computeStatusForLog(plannedAt, actualAt, action),
    eventType: 'primary', createdAt: nowISO()
  };
  state.intakeLogs.push(log);
  saveState(state);
  return log;
}
function getLogForScheduleFromState(state, medicationId, plannedISO) {
  const matching = state.intakeLogs.filter(log => log.medicationId === medicationId && log.plannedAt === plannedISO);
  if (!matching.length) return null;
  const primary = matching.find(log => (log.eventType || 'primary') === 'primary') || matching[0];
  const corrections = matching.filter(log => log.eventType === 'correction' && log.correctsLogId === primary.id)
    .sort((a,b) => new Date(a.correctedAt || a.createdAt || a.actualAt) - new Date(b.correctedAt || b.createdAt || b.actualAt));
  if (!corrections.length) return primary;
  const latest = corrections[corrections.length - 1];
  return { ...primary, action: latest.action, actualAt: latest.actualAt, status: latest.status, effectiveCorrectionId: latest.id, correctionReason: latest.reason };
}
window.markTaken = function(medicationId, plannedAt) {
  addPrimaryLog(medicationId, plannedAt, 'taken', nowISO());
  mount('action');
};
window.markCancelled = function(medicationId, plannedAt) {
  addPrimaryLog(medicationId, plannedAt, 'cancelled', nowISO());
  mount('action');
};
window.openCorrection = function(medicationId, plannedAt) {
  const existing = getLogForSchedule(medicationId, plannedAt);
  if (!existing) return alert('Сначала необходимо зафиксировать первичный факт приёма.');
  const dialog = document.getElementById('correctionDialog');
  const content = document.getElementById('correctionContent');
  const defaultValue = existing.actualAt.slice(0,16);
  content.innerHTML = `<div class="form-grid"><div><label>${escapeHtml(tr('choose_action'))}</label><select id="correction_action"><option value="taken">${escapeHtml(tr('take'))}</option><option value="cancelled">${escapeHtml(tr('cancel'))}</option></select></div><div><label>${escapeHtml(tr('mark_time'))}</label><input id="correction_time" type="datetime-local" value="${escapeHtml(defaultValue)}"></div><div class="full"><label>Причина исправления</label><input id="correction_reason" type="text" maxlength="250" placeholder="Укажите причину" required></div><div class="full"><p class="muted">Исправление не удаляет и не переписывает первоначальную запись. В истории сохраняются исходные и исправленные данные.</p></div><div class="full right"><button onclick="applyCorrection('${medicationId}','${plannedAt}')">${escapeHtml(tr('apply_correction'))}</button> <button onclick="document.getElementById('correctionDialog').close()">${escapeHtml(tr('close'))}</button></div></div>`;
  content.querySelector('#correction_action').value = existing.action;
  dialog.showModal();
};
window.applyCorrection = function(medicationId, plannedAt) {
  const action = document.getElementById('correction_action').value;
  const localValue = document.getElementById('correction_time').value;
  const reason = (document.getElementById('correction_reason').value || '').trim();
  if (!localValue) return alert('Укажите исправленное время.');
  if (!reason) return alert('Укажите причину исправления.');
  const state = getState();
  const effective = getLogForScheduleFromState(state, medicationId, plannedAt);
  if (!effective) return alert('Первичная запись не найдена.');
  const primary = state.intakeLogs.find(log => log.id === effective.id) || state.intakeLogs.find(log => log.medicationId === medicationId && log.plannedAt === plannedAt && (log.eventType || 'primary') === 'primary');
  const actualAt = new Date(localValue).toISOString();
  state.intakeLogs.push({
    id: uid(), medicationId, plannedAt, actualAt, action,
    status: computeStatusForLog(plannedAt, actualAt, action),
    eventType: 'correction', correctsLogId: primary.id,
    previous: { action: effective.action, actualAt: effective.actualAt, status: effective.status },
    reason, correctedAt: nowISO()
  });
  saveState(state);
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
  return getLogForScheduleFromState(getState(), medicationId, plannedISO);
}
function buildTodayEntries() {
  const dateISO = currentLocalDate(); const now = Date.now(); const entries = []; const state = getState();
  const medications = Array.isArray(state.medications) ? state.medications : [];
  medications.forEach(med => {
    ensureTemporalChangeState(med);
    if (med.temporalPending.schedule || med.temporalPending.time) return;
    if (!isMedicationApplicableOnDate(med, dateISO)) return;
    (Array.isArray(med.times) ? med.times : []).forEach(time => {
      if (!time) return;
      const plannedAt = getScheduledDateTime(dateISO, time); const plannedMs = new Date(plannedAt).getTime();
      if (Number.isNaN(plannedMs)) return;
      const log = getLogForScheduleFromState(state, med.id, plannedAt);
      const boardState = log ? null : computePendingSlotStatus(plannedMs, now);
      entries.push({ medication: med, plannedTime: time, plannedAt, log, boardState, displayStatus: log ? computeStatusForLog(plannedAt, log.actualAt, log.action) : boardState });
    });
  });
  return entries.sort((a,b) => new Date(a.plannedAt) - new Date(b.plannedAt));
}
function medicationHistorySnapshot(med) {
  return { name: med.name || '', manufacturer: med.manufacturer || '', contentValue: med.contentValue || '', contentUnit: med.contentUnit || '', contentUnitOther: med.contentUnitOther || '', intakeQuantity: med.intakeQuantity || '', intakeUnit: med.intakeUnit || '', intakeUnitOther: med.intakeUnitOther || '', details: med.details || '', scheduleType: med.scheduleType || 'daily', weekdays: Array.isArray(med.weekdays) ? [...med.weekdays] : [], explicitDates: Array.isArray(med.explicitDates) ? [...med.explicitDates] : [], times: Array.isArray(med.times) ? [...med.times] : [], startDate: med.startDate || '', endDate: med.endDate || '', active: Boolean(med.active), cancelled: Boolean(med.cancelled) };
}
function medicationHistoryDiff(previousSnapshot, currentSnapshot) {
  const fields = ['name','manufacturer','contentValue','contentUnit','contentUnitOther','intakeQuantity','intakeUnit','intakeUnitOther','details','scheduleType','weekdays','explicitDates','times','startDate','endDate','active','cancelled']; const diff = {};
  fields.forEach(field => { const p=previousSnapshot?.[field], c=currentSnapshot?.[field]; const pt=Array.isArray(p)?JSON.stringify(p):String(p??''); const ct=Array.isArray(c)?JSON.stringify(c):String(c??''); if(pt!==ct) diff[field]=c; }); return diff;
}
function recordRowHistory(med, action, payload, previousSnapshot = null) {
  med.rowHistory = Array.isArray(med.rowHistory) ? med.rowHistory : []; const currentSnapshot=medicationHistorySnapshot(med); const historySnapshot=med.rowHistory[0]?.snapshot||null; const baselineSnapshot=previousSnapshot||historySnapshot; let changes=currentSnapshot;
  if(action==='edited'&&baselineSnapshot) changes=medicationHistoryDiff(baselineSnapshot,currentSnapshot);
  med.rowHistory.unshift({at:nowISO(),action,payload,snapshot:currentSnapshot,changes});
}
function intakeHistoryRows(medId, period) {
  const logs=getState().intakeLogs.filter(log=>log.medicationId===medId).filter(log=>{if(period==='all')return true;const t=new Date(log.correctedAt||log.createdAt||log.actualAt).getTime(),now=Date.now();if(period==='today')return localDateFromISO(log.correctedAt||log.createdAt||log.actualAt)===currentLocalDate();if(period==='7')return t>=now-7*86400000;if(period==='30')return t>=now-30*86400000;return true;}).sort((a,b)=>new Date(b.correctedAt||b.createdAt||b.actualAt)-new Date(a.correctedAt||a.createdAt||a.actualAt));
  if(!logs.length)return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  return `<table><thead><tr><th>${escapeHtml(tr('planned_time'))}</th><th>${escapeHtml(tr('actual_time'))}</th><th>Действие</th><th>${escapeHtml(tr('status'))}</th><th>Примечание</th></tr></thead><tbody>${logs.map(log=>`<tr><td>${escapeHtml(formatDateTime(log.plannedAt))}</td><td>${escapeHtml(formatDateTime(log.actualAt))}</td><td>${escapeHtml(log.eventType==='correction'?'Исправлено':(log.action==='taken'?tr('take'):tr('cancel')))}</td><td>${escapeHtml(statusLabel(log.status))}</td><td>${escapeHtml(log.eventType==='correction'?(log.reason||''):'Первичная запись')}</td></tr>`).join('')}</tbody></table>`;
}
function statusLabel(code) { const map={expected:tr('expected'),upcoming:tr('upcoming'),overdue:tr('overdue'),taken_on_time:tr('taken_on_time'),taken_early:tr('taken_early'),taken_late:tr('taken_late'),cancelled:tr('cancelled')}; return map[code]||code; }
function statusClass(code) { if(code==='expected')return 'status expected';if(code==='upcoming')return 'status upcoming';if(code==='overdue')return 'status overdue';return 'status success'; }
