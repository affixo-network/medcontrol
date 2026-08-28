function ensureTemporalChangeState(med) {
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
