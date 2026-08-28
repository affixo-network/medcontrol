(function(){
  const TEMPORAL_KEYS = ['scheduleType','weekdays','explicitDates','startDate','endDate','times'];
  const SCOPE_LABELS = {
    today: 'Только сегодня',
    future: 'Только на последующие дни расписания',
    today_future: 'Сегодня и на последующие дни расписания'
  };

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
      log.medicationId === medicationId && log.action === 'taken' && localDateFromISO(log.plannedAt) === today
    );
  }

  function applyNonTemporal(target, source){
    Object.keys(source).forEach(key => { if (!TEMPORAL_KEYS.includes(key)) target[key] = source[key]; });
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
    dialog.innerHTML = `<form method="dialog" style="min-width:min(520px,90vw)">
      <h3 style="margin-top:0">Когда применить изменения?</h3>
      <div id="scheduleScopeTakenNotice" style="display:none;margin:0 0 12px;font-weight:600">Сегодняшний приём уже зафиксирован.</div>
      <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="today"> Только сегодня</label>
      <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="future"> Только на последующие дни расписания</label>
      <label style="display:block;margin:10px 0"><input type="radio" name="scheduleScope" value="today_future"> Сегодня и на последующие дни расписания</label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button type="button" id="scheduleScopeCancel">Отмена</button><button type="button" id="scheduleScopeSave">Сохранить</button></div>
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
      if (!selected) { alert('Выберите, когда применить изменения.'); return; }
      dialog.close();
      onSave(selected.value);
    };
    dialog.showModal();
  }

  function annotateLatestHistory(med, scope, beforeTemporal, updatedMedication){
    if (!Array.isArray(med.rowHistory) || !med.rowHistory.length) return;
    const entry = med.rowHistory[med.rowHistory.length - 1];
    if (!entry || entry.action !== 'edited') return;

    if (scope && SCOPE_LABELS[scope]) {
      entry.scheduleScope = scope;
      entry.scheduleScopeLabel = SCOPE_LABELS[scope];
    }

    entry.changes = entry.changes || {};
    TEMPORAL_KEYS.forEach(key => {
      const beforeValue = beforeTemporal?.[key];
      const afterValue = updatedMedication?.[key];
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        entry.changes[key] = Array.isArray(afterValue) ? [...afterValue] : (afterValue ?? '');
      }
    });
  }

  function repairCurrentScopeHistory(state){
    let changed = false;
    (state.medications || []).forEach(med => {
      const app = med.temporalApplication;
      if (!app || !Array.isArray(med.rowHistory) || !med.rowHistory.length) return;

      const editedEntries = med.rowHistory.filter(entry => entry.action === 'edited');
      if (!editedEntries.length) return;

      let target = editedEntries.find(entry => entry.at === app.changedAt) || null;
      if (!target && app.changedAt) {
        const appMs = new Date(app.changedAt).getTime();
        target = editedEntries
          .filter(entry => !Number.isNaN(new Date(entry.at).getTime()) && new Date(entry.at).getTime() <= appMs + 60000)
          .sort((a,b) => new Date(b.at) - new Date(a.at))[0] || null;
      }
      if (!target) target = editedEntries[editedEntries.length - 1];

      target.changes = target.changes || {};
      if (app.scope && SCOPE_LABELS[app.scope] && !target.scheduleScopeLabel) {
        target.scheduleScope = app.scope;
        target.scheduleScopeLabel = SCOPE_LABELS[app.scope];
        changed = true;
      }

      let effectiveTemporal = null;
      if (app.scope === 'today' && app.todayTemporal) effectiveTemporal = app.todayTemporal;
      else if (app.scope === 'future' || app.scope === 'today_future') effectiveTemporal = med;

      if (effectiveTemporal) {
        TEMPORAL_KEYS.forEach(key => {
          const value = effectiveTemporal[key];
          if (value === undefined) return;
          const current = target.changes[key];
          if (JSON.stringify(current) !== JSON.stringify(value)) {
            target.changes[key] = Array.isArray(value) ? [...value] : value;
            changed = true;
          }
        });
      }
    });
    return changed;
  }

  function repairAndSave(){
    try {
      const state = getState();
      if (repairCurrentScopeHistory(state)) saveState(state);
    } catch (_) {}
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
          med.temporalApplication = { scope:'today', date:today, changedAt, todayTemporal:cloneTemporal(updatedMedication) };
        } else if (scope === 'future') {
          applyTemporal(med, updatedMedication);
          med.temporalApplication = { scope:'future', date:today, changedAt, todayTemporal:beforeTemporal };
        } else {
          applyTemporal(med, updatedMedication);
          med.temporalApplication = { scope:'today_future', date:today, changedAt };
        }
        completeTemporalEdit(med, previousSnapshot, updatedMedication);
        recordRowHistory(med, 'edited', medicationRuleSummary(updatedMedication), previousSnapshot);
        annotateLatestHistory(med, scope, beforeTemporal, updatedMedication);
        saveState(state);
        document.getElementById('editDialog')?.close();
        mount('input');
      };

      if (temporalChanged(beforeTemporal, updatedMedication)) askScope(hasTakenToday(state, id), persist);
      else persist(null);
    } catch (error) { showMedicationHint(error.message); }
  };

  setTimeout(repairAndSave, 0);
})();
