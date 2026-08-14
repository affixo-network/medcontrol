(function () {
  function clearLegacyTemporalUi() {
    document.querySelectorAll('button').forEach(button => {
      const label = (button.textContent || '').trim();
      if (label === 'Отменить Расписание' || label === 'Отменить Время') {
        button.remove();
      }
    });

    document.getElementById('temporalCancellationDialog')?.remove();

    document.querySelectorAll('section.card').forEach(section => {
      const text = (section.textContent || '').trim();
      if (text.startsWith('Требуется завершить временное назначение.')) {
        section.remove();
      }
    });
  }

  function removeStandaloneMedicationCancellation() {
    document.querySelectorAll('button').forEach(button => {
      const label = (button.textContent || '').trim();
      if (label === 'Отменить' && button.getAttribute('onclick')?.includes('startMedicationCancellation')) {
        button.remove();
      }
    });
  }

  // Schedule and intake-time changes are now made directly through "Изменить".
  // The former prerequisite cancellation in "Приём препаратов" is retired.
  window.guardTemporalEdit = function() {
    return true;
  };

  window.validateTemporalEditAuthorization = function(med, updatedMedication) {
    return {
      scheduleChanged: typeof temporalScheduleChanged === 'function'
        ? temporalScheduleChanged(med, updatedMedication)
        : false,
      timeChanged: typeof temporalTimeChanged === 'function'
        ? temporalTimeChanged(med, updatedMedication)
        : false
    };
  };

  window.completeTemporalEdit = function(med, beforeSnapshot, updatedMedication) {
    if (typeof ensureTemporalChangeState === 'function') {
      ensureTemporalChangeState(med);
      med.temporalChangePermissions.schedule = false;
      med.temporalChangePermissions.time = false;
      med.temporalPending.schedule = false;
      med.temporalPending.time = false;
    }
  };

  const originalRenderActionPage = window.renderActionPage;
  if (typeof originalRenderActionPage === 'function') {
    window.renderActionPage = function() {
      const result = originalRenderActionPage.apply(this, arguments);
      clearLegacyTemporalUi();
      return result;
    };
  }

  const originalRenderInputPage = window.renderInputPage;
  if (typeof originalRenderInputPage === 'function') {
    window.renderInputPage = function() {
      const result = originalRenderInputPage.apply(this, arguments);
      clearLegacyTemporalUi();
      removeStandaloneMedicationCancellation();
      return result;
    };
  }

  const originalOpenEditMedication = window.openEditMedication;
  if (typeof originalOpenEditMedication === 'function') {
    window.openEditMedication = function(id) {
      const result = originalOpenEditMedication.apply(this, arguments);
      const med = getState().medications.find(item => item.id === id);
      if (!med || med.cancelled) return result;

      const actions = document.querySelector('#editDialogContent .full.right');
      if (actions && !actions.querySelector('[data-medication-cancel]')) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.dataset.medicationCancel = 'true';
        cancelButton.textContent = 'Отменить препарат';
        cancelButton.onclick = function() {
          document.getElementById('editDialog')?.close();
          startMedicationCancellation(id);
        };
        actions.prepend(cancelButton);
      }

      return result;
    };
  }
})();
