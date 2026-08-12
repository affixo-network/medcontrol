(function () {
  const originalGuardTemporalEdit = window.guardTemporalEdit;
  if (typeof originalGuardTemporalEdit === 'function') {
    window.guardTemporalEdit = function(kind) {
      if (window.__openingMedicationEditor) return true;
      return originalGuardTemporalEdit(kind);
    };
  }

  const originalSyncStructuredWeekdays = window.syncStructuredWeekdays;
  if (typeof originalSyncStructuredWeekdays === 'function') {
    window.syncStructuredWeekdays = function(prefix) {
      const userTriggered = Boolean(window.event && window.event.isTrusted);
      if (prefix === 'edit_' && userTriggered && !guardTemporalEdit('schedule')) return;

      const weekdayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const values = [...document.querySelectorAll(`input[data-prefix="${prefix}"][data-weekday]:checked`)]
        .map(input => input.dataset.weekday)
        .sort((a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b));
      const element = document.getElementById(`${prefix}weekdays`);
      if (element) element.value = values.join(',');
    };
  }

  const originalOpenEditMedication = window.openEditMedication;
  if (typeof originalOpenEditMedication === 'function') {
    window.openEditMedication = function(id) {
      window.__openingMedicationEditor = true;
      try {
        return originalOpenEditMedication(id);
      } finally {
        window.setTimeout(() => {
          window.__openingMedicationEditor = false;
        }, 0);
      }
    };
  }
})();
