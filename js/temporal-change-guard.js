function ensureTemporalChangeState(med) {
  if (!med.temporalChangePermissions || typeof med.temporalChangePermissions !== 'object') {
    med.temporalChangePermissions = { schedule: true, time: true };
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

window.guardTemporalEdit = function() {
  return true;
};

window.validateTemporalEditAuthorization = function(med, updatedMedication) {
  ensureTemporalChangeState(med);
  return {
    scheduleChanged: temporalScheduleChanged(med, updatedMedication),
    timeChanged: temporalTimeChanged(med, updatedMedication)
  };
};

window.completeTemporalEdit = function(med) {
  ensureTemporalChangeState(med);
  med.temporalChangePermissions.schedule = true;
  med.temporalChangePermissions.time = true;
  med.temporalPending.schedule = false;
  med.temporalPending.time = false;
};

window.beginTemporalCancellation = function() {};
window.saveTemporalCancellation = function() {};
window.cancelTemporalCancellationDraft = function() {};

function temporalPendingNoticeHtml() {
  return '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ensureTemporalChangeState,
    temporalScheduleSignature,
    temporalTimeSignature,
    temporalScheduleChanged,
    temporalTimeChanged
  };
}
