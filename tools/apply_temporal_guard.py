from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'marker not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def insert_script(path):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    marker = '<script src="js/utils.js"></script>\n'
    line = '<script src="js/temporal-change-guard.js"></script>\n'
    if line not in text:
        if marker not in text:
            raise RuntimeError(f'utils marker missing in {path}')
        text = text.replace(marker, marker + line, 1)
        p.write_text(text, encoding='utf-8')


def write_helper():
    content = r'''function ensureTemporalChangeState(med) {
  if (!med.temporalChangePermissions || typeof med.temporalChangePermissions !== 'object') {
    med.temporalChangePermissions = { schedule: false, time: false };
  }
  if (!med.temporalPending || typeof med.temporalPending !== 'object') {
    med.temporalPending = { schedule: false, time: false };
  }
  return med;
}

function temporalScheduleSignature(med) {
  return JSON.stringify({
    scheduleType: med.scheduleType || 'daily',
    weekdays: Array.isArray(med.weekdays) ? [...med.weekdays].sort() : [],
    explicitDates: Array.isArray(med.explicitDates) ? [...med.explicitDates].sort() : [],
    startDate: med.startDate || '',
    endDate: med.endDate || ''
  });
}

function temporalTimeSignature(med) {
  return JSON.stringify(Array.isArray(med.times) ? [...med.times].sort() : []);
}

function temporalScheduleChanged(before, after) {
  return temporalScheduleSignature(before) !== temporalScheduleSignature(after);
}

function temporalTimeChanged(before, after) {
  return temporalTimeSignature(before) !== temporalTimeSignature(after);
}

function temporalLockMessage(kind) {
  return kind === 'schedule'
    ? 'Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».'
    : 'Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».';
}

function temporalConfirmMessage(kind) {
  return kind === 'schedule'
    ? 'Вы уверены, что хотите отменить действующее Расписание для его изменения?'
    : 'Вы уверены, что хотите отменить действующее время приёма для его изменения?';
}

function temporalCancelledMessage(kind) {
  return kind === 'schedule' ? 'Расписание отменено.' : 'Время приёма отменено.';
}

function temporalSavedMessage(kind) {
  return kind === 'schedule'
    ? 'Перейдите в раздел «Ввод», в поле «Расписание» внесите необходимые изменения и сохраните их.'
    : 'Перейдите в раздел «Ввод», в поле «Время приёма» внесите необходимые изменения и сохраните их.';
}

function computePendingSlotStatus(plannedMs, nowMs) {
  const minuteEnd = plannedMs + 60 * 1000;
  return nowMs < minuteEnd ? 'expected' : 'overdue';
}

function computeTakenTemporalStatus(plannedMs, actualMs, action) {
  if (action === 'cancelled') return 'cancelled';
  if (actualMs < plannedMs) return 'taken_early';
  if (actualMs < plannedMs + 60 * 1000) return 'taken_on_time';
  return 'taken_late';
}

window.guardTemporalEdit = function(kind) {
  const id = window.__editingMedicationId;
  if (!id) return true;
  const med = getState().medications.find(item => item.id === id);
  if (!med) return false;
  ensureTemporalChangeState(med);
  if (med.temporalChangePermissions[kind]) return true;
  alert(temporalLockMessage(kind));
  return false;
};

window.validateTemporalEditAuthorization = function(med, updatedMedication) {
  ensureTemporalChangeState(med);
  const scheduleChanged = temporalScheduleChanged(med, updatedMedication);
  const timeChanged = temporalTimeChanged(med, updatedMedication);
  if (scheduleChanged && !med.temporalChangePermissions.schedule) {
    throw new Error('temporal_schedule_locked');
  }
  if (timeChanged && !med.temporalChangePermissions.time) {
    throw new Error('temporal_time_locked');
  }
  return { scheduleChanged, timeChanged };
};

window.completeTemporalEdit = function(med, beforeSnapshot, updatedMedication) {
  ensureTemporalChangeState(med);
  const scheduleChanged = temporalScheduleChanged(beforeSnapshot, updatedMedication);
  const timeChanged = temporalTimeChanged(beforeSnapshot, updatedMedication);
  if (scheduleChanged) {
    med.temporalChangePermissions.schedule = false;
    med.temporalPending.schedule = false;
  }
  if (timeChanged) {
    med.temporalChangePermissions.time = false;
    med.temporalPending.time = false;
  }
};

function materializeTemporalCancellationLogs(state, med, kind) {
  const dateISO = currentLocalDate();
  if (typeof isMedicationApplicableOnDate !== 'function' || !isMedicationApplicableOnDate(med, dateISO)) return;
  const times = Array.isArray(med.times) ? med.times : [];
  times.forEach(time => {
    const plannedAt = getScheduledDateTime(dateISO, time);
    const exists = state.intakeLogs.some(log => log.medicationId === med.id && log.plannedAt === plannedAt);
    if (exists) return;
    state.intakeLogs.push({
      id: uid(),
      medicationId: med.id,
      plannedAt,
      actualAt: nowISO(),
      action: 'cancelled',
      status: 'cancelled',
      reason: kind === 'schedule' ? 'schedule_change' : 'time_change'
    });
  });
}

window.beginTemporalCancellation = function(medicationId, kind) {
  const state = getState();
  const med = state.medications.find(item => item.id === medicationId);
  if (!med || med.cancelled) return;
  if (!window.confirm(temporalConfirmMessage(kind))) return;
  window.__pendingTemporalCancellation = { medicationId, kind };
  window.alert(temporalCancelledMessage(kind));
  const dialog = document.getElementById('temporalCancellationDialog');
  const text = document.getElementById('temporalCancellationText');
  if (text) text.textContent = kind === 'schedule'
    ? 'Сохранить отмену Расписания?'
    : 'Сохранить отмену времени приёма?';
  dialog?.showModal();
};

window.saveTemporalCancellation = function() {
  const pending = window.__pendingTemporalCancellation;
  if (!pending) return;
  const state = getState();
  const med = state.medications.find(item => item.id === pending.medicationId);
  if (!med || med.cancelled) return;
  const previousSnapshot = typeof medicationHistorySnapshot === 'function' ? medicationHistorySnapshot(med) : null;
  materializeTemporalCancellationLogs(state, med, pending.kind);
  ensureTemporalChangeState(med);
  med.temporalChangePermissions[pending.kind] = true;
  med.temporalPending[pending.kind] = true;
  med.temporalPendingAt = nowISO();
  if (typeof recordRowHistory === 'function') {
    recordRowHistory(
      med,
      'edited',
      pending.kind === 'schedule'
        ? 'Расписание отменено для последующего изменения.'
        : 'Время приёма отменено для последующего изменения.',
      previousSnapshot
    );
  }
  saveState(state);
  document.getElementById('temporalCancellationDialog')?.close();
  window.__pendingTemporalCancellation = null;
  window.alert(temporalSavedMessage(pending.kind));
  mount('action');
};

window.cancelTemporalCancellationDraft = function() {
  window.__pendingTemporalCancellation = null;
  document.getElementById('temporalCancellationDialog')?.close();
};

function temporalPendingNoticeHtml() {
  const pending = getState().medications.filter(med => {
    ensureTemporalChangeState(med);
    return !med.cancelled && (med.temporalPending.schedule || med.temporalPending.time);
  });
  if (!pending.length) return '';
  const items = pending.map(med => {
    const fields = [];
    if (med.temporalPending.schedule) fields.push('Расписание');
    if (med.temporalPending.time) fields.push('Время приёма');
    return `<li><strong>${escapeHtml(med.name)}</strong>: ${escapeHtml(fields.join(' и '))}. Введите изменение в разделе «Ввод» либо полностью отмените препарат в разделе «Ввод».</li>`;
  }).join('');
  return `<section class="card" style="border-color:#b45309;background:#fff7ed"><strong>Требуется завершить временное назначение.</strong><ul>${items}</ul></section>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ensureTemporalChangeState,
    temporalScheduleSignature,
    temporalTimeSignature,
    temporalScheduleChanged,
    temporalTimeChanged,
    temporalLockMessage,
    temporalConfirmMessage,
    temporalCancelledMessage,
    temporalSavedMessage,
    computePendingSlotStatus,
    computeTakenTemporalStatus
  };
}
'''
    (ROOT / 'js/temporal-change-guard.js').write_text(content, encoding='utf-8')


def patch_medications():
    p = ROOT / 'js/medications.js'
    text = p.read_text(encoding='utf-8')
    text = text.replace("window.addStructuredTime = function(prefix) {\n", "window.addStructuredTime = function(prefix) {\n  if (prefix === 'edit_' && !guardTemporalEdit('time')) return;\n", 1)
    text = text.replace("window.removeStructuredTime = function(prefix, value) {\n", "window.removeStructuredTime = function(prefix, value) {\n  if (prefix === 'edit_' && !guardTemporalEdit('time')) return;\n", 1)
    text = text.replace("window.syncStructuredWeekdays = function(prefix) {\n", "window.syncStructuredWeekdays = function(prefix) {\n  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;\n", 1)
    text = text.replace("window.addStructuredDate = function(prefix) {\n", "window.addStructuredDate = function(prefix) {\n  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;\n", 1)
    text = text.replace("window.removeStructuredDate = function(prefix, value) {\n", "window.removeStructuredDate = function(prefix, value) {\n  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;\n", 1)
    text = text.replace("window.syncEditScheduleFields = function() { syncScheduleFields('edit_'); };", "window.syncEditScheduleFields = function() { syncScheduleFields('edit_'); };\nwindow.changeEditScheduleType = function(select) {\n  const previous = select.dataset.previousValue || select.value;\n  if (!guardTemporalEdit('schedule')) {\n    select.value = previous;\n    syncEditScheduleFields();\n    return;\n  }\n  select.dataset.previousValue = select.value;\n  syncEditScheduleFields();\n};")
    text = text.replace("  temporal_schedule_locked: 'TEMP'," , "  temporal_schedule_locked: 'TEMP',") if False else text
    marker = "  save_failed: tr('hint_save_failed')\n};"
    repl = "  save_failed: tr('hint_save_failed'),\n  temporal_schedule_locked: 'Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».',\n  temporal_time_locked: 'Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».'\n};"
    if marker not in text:
        raise RuntimeError('hint marker missing')
    text = text.replace(marker, repl, 1)
    text = text.replace("window.openEditMedication = function(id) {\n", "window.openEditMedication = function(id) {\n  window.__editingMedicationId = id;\n", 1)
    old_select = '<div><label>${escapeHtml(tr(\'schedule\'))}</label><select id="edit_scheduleType" onchange="syncEditScheduleFields()"><option value="daily" ${med.scheduleType === \'daily\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'every_day\'))}</option><option value="weekdays" ${med.scheduleType === \'weekdays\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'weekdays\'))}</option><option value="explicit_dates" ${med.scheduleType === \'explicit_dates\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'explicit_dates\'))}</option></select></div>'
    new_select = '<div><label>${escapeHtml(tr(\'schedule\'))}</label><select id="edit_scheduleType" data-previous-value="${escapeHtml(med.scheduleType || \'daily\')}" onfocus="guardTemporalEdit(\'schedule\')" onchange="changeEditScheduleType(this)"><option value="daily" ${med.scheduleType === \'daily\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'every_day\'))}</option><option value="weekdays" ${med.scheduleType === \'weekdays\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'weekdays\'))}</option><option value="explicit_dates" ${med.scheduleType === \'explicit_dates\' ? \'selected\' : \'\'}>${escapeHtml(tr(\'explicit_dates\'))}</option></select></div>'
    if old_select not in text:
        raise RuntimeError('edit schedule select marker missing')
    text = text.replace(old_select, new_select, 1)
    text = text.replace('id="edit_startDate" type="date" value=', 'id="edit_startDate" type="date" onfocus="if(!guardTemporalEdit(\'schedule\')) this.blur()" value=', 1)
    text = text.replace('id="edit_endDate" type="date" value=', 'id="edit_endDate" type="date" onfocus="if(!guardTemporalEdit(\'schedule\')) this.blur()" value=', 1)
    old = "    updatedMedication.active = currentActive;\n\n    Object.assign(med, updatedMedication);"
    new = "    updatedMedication.active = currentActive;\n\n    validateTemporalEditAuthorization(med, updatedMedication);\n    Object.assign(med, updatedMedication);\n    completeTemporalEdit(med, previousSnapshot, updatedMedication);"
    if old not in text:
        raise RuntimeError('save edit marker missing')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')


def patch_render():
    p = ROOT / 'js/render.js'
    text = p.read_text(encoding='utf-8')
    old = "    const actionButtons = !log\n      ? `<button onclick=\"markTaken('${item.medication.id}','${item.plannedAt}')\">${escapeHtml(tr('take'))}</button> <button onclick=\"markCancelled('${item.medication.id}','${item.plannedAt}')\">${escapeHtml(tr('cancel'))}</button>`\n      : `<button onclick=\"openCorrection('${item.medication.id}','${item.plannedAt}')\">${escapeHtml(tr('correct'))}</button> <button onclick=\"showIntakeHistory('${item.medication.id}')\">${escapeHtml(tr('history'))}</button>`;"
    new = "    const temporalButtons = `<button onclick=\"beginTemporalCancellation('${item.medication.id}','schedule')\">Отменить Расписание</button> <button onclick=\"beginTemporalCancellation('${item.medication.id}','time')\">Отменить Время</button>`;\n    const actionButtons = !log\n      ? `<button onclick=\"markTaken('${item.medication.id}','${item.plannedAt}')\">${escapeHtml(tr('take'))}</button> ${temporalButtons}`\n      : `<button onclick=\"openCorrection('${item.medication.id}','${item.plannedAt}')\">${escapeHtml(tr('correct'))}</button> ${temporalButtons}`;"
    if old not in text:
        raise RuntimeError('action buttons marker missing')
    text = text.replace(old, new, 1)
    old_body = "  const body = `\n    <section class=\"card\"><h1>${escapeHtml(tr('title_action'))}</h1><p>${escapeHtml(tr('action_intro'))}</p></section>"
    new_body = "  const body = `\n    <section class=\"card\"><h1>${escapeHtml(tr('title_action'))}</h1><p>${escapeHtml(tr('action_intro'))}</p></section>\n    ${temporalPendingNoticeHtml()}"
    if old_body not in text:
        raise RuntimeError('action body marker missing')
    text = text.replace(old_body, new_body, 1)
    dialog_marker = "    <dialog id=\"correctionDialog\"><h2>${escapeHtml(tr('correct'))}</h2><div id=\"correctionContent\"></div></dialog>`;"
    dialog_new = "    <dialog id=\"correctionDialog\"><h2>${escapeHtml(tr('correct'))}</h2><div id=\"correctionContent\"></div></dialog>\n    <dialog id=\"temporalCancellationDialog\"><h2>Изменение временного назначения</h2><p id=\"temporalCancellationText\"></p><div class=\"dialog-actions\"><button onclick=\"saveTemporalCancellation()\">Сохранить</button><button onclick=\"cancelTemporalCancellationDraft()\">Закрыть</button></div></dialog>`;"
    if dialog_marker not in text:
        raise RuntimeError('dialog marker missing')
    text = text.replace(dialog_marker, dialog_new, 1)
    input_marker = "  const body = `\n    <section class=\"card\"><h1>${escapeHtml(tr('title_input'))}</h1><p>${escapeHtml(tr('input_intro'))}</p></section>"
    input_new = "  const body = `\n    <section class=\"card\"><h1>${escapeHtml(tr('title_input'))}</h1><p>${escapeHtml(tr('input_intro'))}</p></section>\n    ${temporalPendingNoticeHtml()}"
    if input_marker not in text:
        raise RuntimeError('input body marker missing')
    text = text.replace(input_marker, input_new, 1)
    p.write_text(text, encoding='utf-8')


def patch_intake():
    p = ROOT / 'js/intake.js'
    text = p.read_text(encoding='utf-8')
    marker = "  medications.forEach(med => {\n    if (!isMedicationApplicableOnDate(med, dateISO)) return;"
    new = "  medications.forEach(med => {\n    ensureTemporalChangeState(med);\n    if (med.temporalPending.schedule || med.temporalPending.time) return;\n    if (!isMedicationApplicableOnDate(med, dateISO)) return;"
    if marker not in text:
        raise RuntimeError('intake medication marker missing')
    text = text.replace(marker, new, 1)
    old = "      if (!log) {\n        if (plannedMs > now) {\n          boardState = 'upcoming';\n        } else if (\n          plannedMs + DEFAULT_GRACE_MINUTES * 60 * 1000 < now\n        ) {\n          boardState = 'overdue';\n        } else {\n          boardState = 'expected';\n        }\n      }"
    new = "      if (!log) {\n        boardState = computePendingSlotStatus(plannedMs, now);\n      }"
    if old not in text:
        raise RuntimeError('status block missing')
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')


def patch_schedule():
    p = ROOT / 'js/schedule.js'
    text = p.read_text(encoding='utf-8')
    old = "function computeStatusForLog(plannedISO, actualISO, action) {\n  if (action === 'cancelled') return 'cancelled';\n  const planned = new Date(plannedISO).getTime();\n  const actual = new Date(actualISO).getTime();\n  if (actual < planned) return 'taken_early';\n  if (actual <= planned + DEFAULT_GRACE_MINUTES * 60 * 1000) return 'taken_on_time';\n  return 'taken_late';\n}"
    new = "function computeStatusForLog(plannedISO, actualISO, action) {\n  const planned = new Date(plannedISO).getTime();\n  const actual = new Date(actualISO).getTime();\n  return computeTakenTemporalStatus(planned, actual, action);\n}"
    if old not in text:
        raise RuntimeError('computeStatusForLog marker missing')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def write_tests():
    tests = ROOT / 'tests'
    tests.mkdir(exist_ok=True)
    (tests / 'temporal_guard_test.js').write_text(r'''global.window = {};
const rules = require('../js/temporal-change-guard.js');
const assert = require('assert');

const med = { scheduleType:'daily', weekdays:[], explicitDates:[], startDate:'2026-08-12', endDate:'2026-08-20', times:['09:34'] };
const same = JSON.parse(JSON.stringify(med));
const scheduleChanged = { ...same, endDate:'2026-08-21' };
const timeChanged = { ...same, times:['10:00'] };
assert.strictEqual(rules.temporalScheduleChanged(med, same), false);
assert.strictEqual(rules.temporalScheduleChanged(med, scheduleChanged), true);
assert.strictEqual(rules.temporalTimeChanged(med, same), false);
assert.strictEqual(rules.temporalTimeChanged(med, timeChanged), true);
assert.strictEqual(rules.temporalLockMessage('schedule'), 'Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».');
assert.strictEqual(rules.temporalLockMessage('time'), 'Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».');

const planned = Date.parse('2026-08-12T09:34:00Z');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:33:59Z')), 'expected');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:34:59Z')), 'expected');
assert.strictEqual(rules.computePendingSlotStatus(planned, Date.parse('2026-08-12T09:35:00Z')), 'overdue');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:33:30Z'), 'taken'), 'taken_early');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:34:45Z'), 'taken'), 'taken_on_time');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:39:00Z'), 'taken'), 'taken_late');
assert.strictEqual(rules.computeTakenTemporalStatus(planned, Date.parse('2026-08-12T09:39:00Z'), 'cancelled'), 'cancelled');
console.log('temporal_guard_test: PASS');
''', encoding='utf-8')
    (tests / 'static_temporal_guard_test.py').write_text(r'''from pathlib import Path
root = Path(__file__).resolve().parents[1]
render = (root/'js/render.js').read_text(encoding='utf-8')
meds = (root/'js/medications.js').read_text(encoding='utf-8')
intake = (root/'js/intake.js').read_text(encoding='utf-8')
for text in ['Отменить Расписание','Отменить Время','temporalCancellationDialog','temporalPendingNoticeHtml()']:
    assert text in render, text
for text in ['validateTemporalEditAuthorization','completeTemporalEdit','temporal_schedule_locked','temporal_time_locked']:
    assert text in meds, text
assert 'DEFAULT_GRACE_MINUTES * 60 * 1000' not in intake
assert "computePendingSlotStatus(plannedMs, now)" in intake
for page in ['input.html','action.html']:
    assert 'js/temporal-change-guard.js' in (root/page).read_text(encoding='utf-8')
print('static_temporal_guard_test: PASS')
''', encoding='utf-8')


def main():
    write_helper()
    for page in ['input.html', 'action.html']:
        insert_script(page)
    patch_medications()
    patch_render()
    patch_intake()
    patch_schedule()
    write_tests()

if __name__ == '__main__':
    main()
