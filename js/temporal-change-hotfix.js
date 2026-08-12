(function () {
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
      originalOpenEditMedication(id);
      const schedule = document.getElementById('edit_scheduleType');
      if (schedule) schedule.removeAttribute('onfocus');
    };
  }
})();
