(function(){
  const TEMPORAL_KEYS = ['scheduleType','weekdays','explicitDates','startDate','endDate','times'];

  function cloneTemporal(source){
    const out = {};
    TEMPORAL_KEYS.forEach(key => {
      const value = source?.[key];
      out[key] = Array.isArray(value) ? [...value] : (value ?? '');
    });
    return out;
  }

  function temporalChanged(before, after){
    return JSON.stringify(cloneTemporal(before)) !== JSON.stringify(cloneTemporal(after));
  }

  function hasTakenToday(state, medicationId){
    const today = currentLocalDate();
    return (state.intakeLogs || []).some(log =>
      log.medicationId === medicationId &&
      log.action === 'taken' &&
      localDateFromISO(log.plannedAt) === today
    );
  }

  function applyNonTemporal(target, source){
    Object.keys(source).forEach(key => {
      if (!TEMPORAL_KEYS.includes(key)) target[key] = source[key];
    });
  }

  function applyTemporal(target, source){
    TEMPORAL_KEYS.forEach(key => {
      const value = source[key];
      target[key] = Array.isArray(value) ? [...value] : value;
    });
  }

  function ensureDialog(){
    let dialog = document.getElementById('scheduleScopeDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'scheduleScopeDialog';
    dialog.innerHTML = `
      <form method="dialog" style="min-width:min(520px,90vw)">
        <h3 style="margin-top:0">Когда применить изменения?</h3>
        <div id="scheduleScopeTakenNotice" style="display:none;margin:0 0 12px;font-weight:600">Сегодняшний приём уже зафиксирован.</div>
        <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="today"> Только сегодня</label>
        <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="future"> Только на последующие дни расписания</label>
        <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="today_future"> Сегодня и на последующие дни расписания</label>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
          <button type="button" id="scheduleScopeCancel">Отмена</button>
          <button type="button" id="scheduleScopeSave">Сохранить</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function askScope(takenToday, onSave){
    const dialog = ensureDialog();
    const notice = document.getElementById('scheduleScopeTakenNotice');
    if (notice) notice.style.display = takenToday ? 'block' : 'none';
    dialog.querySelectorAll('input[name="scheduleScope"]').forEach(input => { input.checked = false; });
    document.getElementById('scheduleScopeCancel').onclick = () => dialog.close();
    document.getElementById('scheduleScopeSave').onclick = () => {
      const selected = dialog.querySelector('input[name="scheduleScope"]:checked');
      if (!selected) {
        alert('Выберите, когда применить изменения.');
        return;
      }
      dialog.close();
      onSave(selected.value);
    };
    dialog.showModal();
  }

  window.saveMedicationEdit = function(id){
    try {
      const state = getState();
      const med = state.medications.find(item => item.id === id);
      if (!med || med.cancelled) return;

      const currentActive = Boolean(med.active);
      const previousSnapshot = medicationHistorySnapshot(med);
      const beforeTemporal = cloneTemporal(med);
      const updatedMedication = createMedicationFromForm('edit_');
      updatedMedication.active = currentActive;

      validateTemporalEditAuthorization(med, updatedMedication);

      const persist = scope => {
        const changedAt = nowISO();
        const today = currentLocalDate();

        applyNonTemporal(med, updatedMedication);

        if (!temporalChanged(beforeTemporal, updatedMedication)) {
          applyTemporal(med, updatedMedication);
          delete med.temporalApplication;
        } else if (scope === 'today') {
          applyTemporal(med, beforeTemporal);
          med.temporalApplication = {
            scope: 'today',
            date: today,
            changedAt,
            todayTemporal: cloneTemporal(updatedMedication)
          };
        } else if (scope === 'future') {
          applyTemporal(med, updatedMedication);
          med.temporalApplication = {
            scope: 'future',
            date: today,
            changedAt,
            todayTemporal: beforeTemporal
          };
        } else {
          applyTemporal(med, updatedMedication);
          med.temporalApplication = {
            scope: 'today_future',
            date: today,
            changedAt
          };
        }

        completeTemporalEdit(med, previousSnapshot, updatedMedication);
        recordRowHistory(med, 'edited', medicationRuleSummary(updatedMedication), previousSnapshot);
        saveState(state);
        document.getElementById('editDialog')?.close();
        mount('input');
      };

      if (temporalChanged(beforeTemporal, updatedMedication)) {
        askScope(hasTakenToday(state, id), persist);
      } else {
        persist(null);
      }
    } catch (error) {
      showMedicationHint(error.message);
    }
  };
})();
