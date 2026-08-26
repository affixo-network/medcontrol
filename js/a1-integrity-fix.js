(function(){
  function plusDays(dateISO, days) {
    const [y, m, d] = String(dateISO || '').split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days, 12));
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function weekdayCode(dateISO) {
    const [y, m, d] = String(dateISO || '').split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    if (Number.isNaN(date.getTime())) return '';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()];
  }

  function appliesOnDate(med, dateISO) {
    if (!med || !dateISO) return false;
    if (med.scheduleType === 'explicit_dates') {
      return Array.isArray(med.explicitDates) && med.explicitDates.includes(dateISO);
    }
    if (med.startDate && dateISO < med.startDate) return false;
    if (med.endDate && dateISO > med.endDate) return false;
    if (med.scheduleType === 'weekdays') {
      return Array.isArray(med.weekdays) && med.weekdays.includes(weekdayCode(dateISO));
    }
    return med.scheduleType === 'daily' || !med.scheduleType;
  }

  function lastScheduleDate(med) {
    if (med.scheduleType === 'explicit_dates') {
      const dates = (med.explicitDates || []).filter(Boolean).slice().sort();
      return dates.length ? dates[dates.length - 1] : '';
    }
    return med.endDate || '';
  }

  function hasApplicableDateFromToday(med) {
    const today = currentLocalDate();
    const lastDate = lastScheduleDate(med);
    if (!lastDate || lastDate < today) return false;
    for (let offset = 0; offset <= 370; offset += 1) {
      const dateISO = plusDays(today, offset);
      if (!dateISO || dateISO > lastDate) break;
      if (appliesOnDate(med, dateISO)) return true;
    }
    return false;
  }

  function currentDayProtectedTimes(before) {
    const today = currentLocalDate();
    if (!appliesOnDate(before, today)) return [];

    const state = getState();
    const now = Date.now();
    return (before.times || [])
      .filter(Boolean)
      .filter(time => {
        const plannedAt = getScheduledDateTime(today, time);
        const plannedMs = new Date(plannedAt).getTime();
        const hasLog = (state.intakeLogs || []).some(
          log => log.medicationId === before.id && log.plannedAt === plannedAt
        );
        const hasCorrection = (state.intakeCorrections || []).some(
          item => item.medicationId === before.id && item.plannedAt === plannedAt
        );
        return plannedMs <= now || hasLog || hasCorrection;
      })
      .sort();
  }

  function validateOnlineEditAgainstToday(before, after) {
    if (!before || !after) return;
    const protectedTimes = currentDayProtectedTimes(before);
    if (!protectedTimes.length) return;

    const today = currentLocalDate();
    const afterAppliesToday = appliesOnDate(after, today);
    const afterTimes = new Set((after.times || []).filter(Boolean));
    const invalidated = protectedTimes.filter(
      time => !afterAppliesToday || !afterTimes.has(time)
    );

    if (invalidated.length) {
      const error = new Error('online_edit_conflicts_today');
      error.conflictTimes = invalidated;
      throw error;
    }
  }

  const originalHint = window.showMedicationHint;
  if (typeof originalHint === 'function') {
    window.showMedicationHint = function(code, details) {
      if (code === 'schedule_no_applicable_date') {
        alert(
          'Расписание не может быть сохранено.\n\n' +
          'Начиная с текущей даты и до окончания курса нет ни одного допустимого расчётного приёма. ' +
          'Проверьте дни недели / даты и дату окончания.'
        );
        return;
      }
      if (code === 'online_edit_conflicts_today') {
        const times = Array.isArray(details) && details.length ? details.join(', ') : '—';
        alert(
          'Изменение не сохранено.\n\n' +
          `Оно противоречит уже наступившим или зафиксированным расчётным приёмам текущего дня: ${times}.\n\n` +
          'Эти строки уже являются частью хронологии и не могут быть удалены задним числом. ' +
          'Измените только ещё не наступившую часть расписания.'
        );
        return;
      }
      return originalHint(code);
    };
  }

  const originalCreateMedicationFromForm = window.createMedicationFromForm;
  if (typeof originalCreateMedicationFromForm === 'function') {
    window.createMedicationFromForm = function(prefix) {
      const item = originalCreateMedicationFromForm(prefix);
      if ((prefix === 'create_' || prefix === 'edit_') && !hasApplicableDateFromToday(item)) {
        throw new Error('schedule_no_applicable_date');
      }

      if (prefix === 'edit_') {
        const before = getState().medications.find(
          med => med.id === window.__editingMedicationId
        );
        if (before) {
          item.id = before.id;
          try {
            validateOnlineEditAgainstToday(before, item);
          } catch (error) {
            if (error?.message === 'online_edit_conflicts_today') {
              window.__onlineEditConflictTimes = error.conflictTimes || [];
            }
            throw error;
          }
        }
      }

      return item;
    };
  }

  const originalSaveMedicationEdit = window.saveMedicationEdit;
  if (typeof originalSaveMedicationEdit === 'function') {
    window.saveMedicationEdit = function(id) {
      window.__onlineEditConflictTimes = [];
      try {
        return originalSaveMedicationEdit(id);
      } catch (error) {
        throw error;
      }
    };
  }

  const originalRowHistoryHtml = window.rowHistoryHtml;
  if (typeof originalRowHistoryHtml === 'function') {
    window.rowHistoryHtml = function(entries) {
      const visibleEntries = Array.isArray(entries)
        ? entries.filter(entry => {
            const action = entry?.action || entry?.event || '';
            return action !== 'course_status_corrected' && action !== 'course_completed';
          })
        : entries;
      return originalRowHistoryHtml(visibleEntries);
    };
  }

  window.saveTemporalCancellation = function() {
    const pending = window.__pendingTemporalCancellation;
    if (!pending) return;

    const state = getState();
    const med = state.medications.find(item => item.id === pending.medicationId);
    if (!med || med.cancelled) return;

    if (typeof ensureTemporalChangeState === 'function') {
      ensureTemporalChangeState(med);
    }

    med.temporalChangePermissions[pending.kind] = true;
    med.temporalPending[pending.kind] = true;
    med.temporalPendingAt = nowISO();

    saveState(state);
    document.getElementById('temporalCancellationDialog')?.close();
    window.__pendingTemporalCancellation = null;

    alert(
      pending.kind === 'schedule'
        ? 'Разрешение на изменение расписания открыто. Само расписание ещё не изменено. Перейдите во «Ввод» и сохраните новое расписание.'
        : 'Разрешение на изменение времени открыто. Само время ещё не изменено. Перейдите во «Ввод» и сохраните новое время.'
    );

    mount('action');
  };

  function endOfTodayMs(today) {
    const next = plusDays(today, 1);
    return next ? new Date(`${next}T00:00:00`).getTime() - 1 : Infinity;
  }

  function historicalPlannedTimesForToday(med, today) {
    const history = Array.isArray(med?.rowHistory) ? med.rowHistory.slice() : [];
    history.sort((a, b) => new Date(a?.at || 0) - new Date(b?.at || 0));

    let version = {};
    const times = new Set();
    const cutoff = endOfTodayMs(today);

    history.forEach(entry => {
      const atMs = new Date(entry?.at || 0).getTime();
      if (Number.isFinite(atMs) && atMs > cutoff) return;

      if (entry?.action === 'created' && entry.snapshot && typeof entry.snapshot === 'object') {
        version = { ...entry.snapshot };
      } else if (entry?.changes && typeof entry.changes === 'object') {
        version = { ...version, ...entry.changes };
      }

      if (appliesOnDate(version, today)) {
        (version.times || []).filter(Boolean).forEach(time => times.add(time));
      }
    });

    return [...times].sort();
  }

  function correctionCount(medicationId, plannedAt) {
    return (getState().intakeCorrections || []).filter(
      item => item.medicationId === medicationId && item.plannedAt === plannedAt
    ).length;
  }

  function rowFromHistoricalPlan(med, today, time, now) {
    const plannedAt = getScheduledDateTime(today, time);
    const plannedMs = new Date(plannedAt).getTime();
    const log = getLogForSchedule(med.id, plannedAt);
    const count = correctionCount(med.id, plannedAt);

    if (log) {
      return {
        medication: med,
        plannedDate: today,
        plannedTime: time,
        plannedAt,
        plannedMs,
        status: log.action === 'taken' ? 'taken' : 'cancelled',
        actualAt: log.actualAt || null,
        canTake: false,
        canCorrect: log.action === 'taken',
        correctionCount: count,
        countdownMode: null,
        countdownMs: null
      };
    }

    const waiting = plannedMs > now;
    return {
      medication: med,
      plannedDate: today,
      plannedTime: time,
      plannedAt,
      plannedMs,
      status: waiting ? 'waiting' : 'missed',
      actualAt: null,
      canTake: true,
      canCorrect: false,
      correctionCount: count,
      countdownMode: waiting ? 'remaining' : 'late',
      countdownMs: waiting ? plannedMs - now : now - plannedMs
    };
  }

  const originalBuildTimeline = window.buildMedControlTimeline;
  if (typeof originalBuildTimeline === 'function') {
    window.buildMedControlTimeline = function() {
      const baseRows = originalBuildTimeline() || [];
      const state = getState();
      const today = currentLocalDate();
      const now = Date.now();
      const byKey = new Map();

      baseRows.forEach(row => {
        const key = `${row?.medication?.id || ''}|${row?.plannedAt || ''}`;
        byKey.set(key, row);
      });

      (state.medications || []).forEach(med => {
        if (!med || med.cancelled || !med.active) return;
        historicalPlannedTimesForToday(med, today).forEach(time => {
          const plannedAt = getScheduledDateTime(today, time);
          const key = `${med.id}|${plannedAt}`;
          if (!byKey.has(key)) {
            byKey.set(key, rowFromHistoricalPlan(med, today, time, now));
          }
        });
      });

      return [...byKey.values()].sort(
        (a, b) => (a?.plannedMs ?? Infinity) - (b?.plannedMs ?? Infinity)
      );
    };
  }

  const previousHint = window.showMedicationHint;
  if (typeof previousHint === 'function') {
    window.showMedicationHint = function(code) {
      if (code === 'online_edit_conflicts_today') {
        const times = window.__onlineEditConflictTimes || [];
        window.__onlineEditConflictTimes = [];
        alert(
          'Изменение не сохранено.\n\n' +
          `Оно противоречит уже наступившим или зафиксированным расчётным приёмам текущего дня: ${times.join(', ') || '—'}.\n\n` +
          'Эти строки уже являются частью хронологии и не могут быть удалены задним числом. ' +
          'Измените только ещё не наступившую часть расписания.'
        );
        return;
      }
      return previousHint(code);
    };
  }
})();
