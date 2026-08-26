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

  function temporalSignature(med) {
    return JSON.stringify({
      scheduleType: med?.scheduleType || 'daily',
      weekdays: Array.isArray(med?.weekdays) ? [...med.weekdays].sort() : [],
      explicitDates: Array.isArray(med?.explicitDates) ? [...med.explicitDates].sort() : [],
      startDate: med?.startDate || '',
      endDate: med?.endDate || '',
      times: Array.isArray(med?.times) ? [...med.times].filter(Boolean).sort() : []
    });
  }

  function temporalChanged(before, after) {
    return temporalSignature(before) !== temporalSignature(after);
  }

  function futureSlots(med, nowMs) {
    const today = currentLocalDate();
    const lastDate = lastScheduleDate(med);
    if (!lastDate || lastDate < today) return [];

    const times = (med.times || []).filter(Boolean).slice().sort();
    const out = [];

    for (let offset = 0; offset <= 370; offset += 1) {
      const dateISO = plusDays(today, offset);
      if (!dateISO || dateISO > lastDate) break;
      if (!appliesOnDate(med, dateISO)) continue;

      for (const time of times) {
        const plannedAt = getScheduledDateTime(dateISO, time);
        const plannedMs = new Date(plannedAt).getTime();
        if (Number.isFinite(plannedMs) && plannedMs > nowMs) {
          out.push({ dateISO, time, plannedAt, plannedMs });
        }
      }
    }

    return out.sort((a, b) => a.plannedMs - b.plannedMs);
  }

  function pastTimesCreatedToday(med, nowMs) {
    const today = currentLocalDate();
    if (!appliesOnDate(med, today)) return [];

    return (med.times || [])
      .filter(Boolean)
      .filter(time => {
        const plannedMs = new Date(getScheduledDateTime(today, time)).getTime();
        return Number.isFinite(plannedMs) && plannedMs <= nowMs;
      })
      .sort();
  }

  function scheduleHistoryVersions(med) {
    const history = Array.isArray(med?.rowHistory) ? med.rowHistory.slice() : [];
    history.sort((a, b) => new Date(a?.at || 0) - new Date(b?.at || 0));

    const versions = [];
    let version = {};

    history.forEach(entry => {
      const action = entry?.action || entry?.event || '';
      if (action === 'course_completed' || action === 'course_status_corrected') return;

      const atMs = new Date(entry?.at || 0).getTime();
      if (!Number.isFinite(atMs)) return;

      let changed = false;

      if (action === 'created' && entry.snapshot && typeof entry.snapshot === 'object') {
        version = { ...entry.snapshot };
        changed = true;
      } else if (
        (action === 'edited' || action === 'activated' || action === 'deactivated') &&
        entry.changes &&
        typeof entry.changes === 'object'
      ) {
        version = { ...version, ...entry.changes };
        changed = true;
      }

      if (changed) {
        versions.push({ startMs: atMs, value: { ...version } });
      }
    });

    return versions;
  }

  function committedPastTimesForToday(med, nowMs) {
    const today = currentLocalDate();
    const versions = scheduleHistoryVersions(med);
    const committed = new Set();

    versions.forEach((item, index) => {
      const nextStartMs = versions[index + 1]?.startMs ?? Infinity;
      const version = item.value;
      if (!appliesOnDate(version, today)) return;

      (version.times || []).filter(Boolean).forEach(time => {
        const plannedAt = getScheduledDateTime(today, time);
        const plannedMs = new Date(plannedAt).getTime();
        if (!Number.isFinite(plannedMs)) return;

        if (
          plannedMs >= item.startMs &&
          plannedMs < nextStartMs &&
          plannedMs <= nowMs
        ) {
          committed.add(time);
        }
      });
    });

    const state = getState();
    (state.intakeLogs || [])
      .filter(log => log.medicationId === med.id && localDateFromISO(log.plannedAt) === today)
      .forEach(log => {
        const parts = formatDateTime(log.plannedAt).split(', ');
        if (parts[1]) committed.add(parts[1]);
      });

    (state.intakeCorrections || [])
      .filter(item => item.medicationId === med.id && localDateFromISO(item.plannedAt) === today)
      .forEach(item => {
        const parts = formatDateTime(item.plannedAt).split(', ');
        if (parts[1]) committed.add(parts[1]);
      });

    return [...committed].sort();
  }

  function newlyAddedPastTimes(before, after, nowMs) {
    const today = currentLocalDate();
    if (!appliesOnDate(after, today)) return [];

    const existing = new Set(committedPastTimesForToday(before, nowMs));

    if (appliesOnDate(before, today)) {
      (before.times || []).filter(Boolean).forEach(time => {
        const plannedMs = new Date(getScheduledDateTime(today, time)).getTime();
        if (Number.isFinite(plannedMs) && plannedMs <= nowMs) existing.add(time);
      });
    }

    return (after.times || [])
      .filter(Boolean)
      .filter(time => {
        const plannedMs = new Date(getScheduledDateTime(today, time)).getTime();
        return Number.isFinite(plannedMs) && plannedMs <= nowMs && !existing.has(time);
      })
      .sort();
  }

  const originalHint = window.showMedicationHint;
  if (typeof originalHint === 'function') {
    window.showMedicationHint = function(code) {
      if (code === 'schedule_no_future_intake') {
        alert(
          'Расписание не может быть сохранено.\n\n' +
          'После текущего момента и до окончания курса нет ни одного будущего расчётного приёма.\n\n' +
          'Проверьте дату окончания, дни недели / даты и время приёма.'
        );
        return;
      }

      if (code === 'schedule_past_time_create') {
        const times = window.__a1ConflictTimes || [];
        window.__a1ConflictTimes = [];
        alert(
          'Препарат не создан.\n\n' +
          `На сегодняшний день указано уже прошедшее время: ${times.join(', ') || '—'}.\n\n` +
          'Новый препарат не может создавать расчётные приёмы задним временем. ' +
          'Удалите прошедшее время либо выберите дату/расписание, начинающееся позже.'
        );
        return;
      }

      if (code === 'schedule_retroactive_time_edit') {
        const times = window.__a1ConflictTimes || [];
        window.__a1ConflictTimes = [];
        alert(
          'Изменение не сохранено.\n\n' +
          `Добавляется уже прошедшее расчётное время текущего дня: ${times.join(', ') || '—'}.\n\n` +
          'Изменение действует онлайн и не может создавать новые расчётные приёмы задним временем.'
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
      const nowMs = Date.now();

      if (prefix === 'create_') {
        const pastTimes = pastTimesCreatedToday(item, nowMs);
        if (pastTimes.length) {
          window.__a1ConflictTimes = pastTimes;
          throw new Error('schedule_past_time_create');
        }

        if (!futureSlots(item, nowMs).length) {
          throw new Error('schedule_no_future_intake');
        }
      }

      if (prefix === 'edit_') {
        const before = getState().medications.find(
          med => med.id === window.__editingMedicationId
        );

        if (before) {
          item.id = before.id;

          if (temporalChanged(before, item)) {
            const retroactiveTimes = newlyAddedPastTimes(before, item, nowMs);
            if (retroactiveTimes.length) {
              window.__a1ConflictTimes = retroactiveTimes;
              throw new Error('schedule_retroactive_time_edit');
            }

            if (!futureSlots(item, nowMs).length) {
              throw new Error('schedule_no_future_intake');
            }
          }
        }
      }

      return item;
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

  function correctionCount(medicationId, plannedAt) {
    return (getState().intakeCorrections || []).filter(
      item => item.medicationId === medicationId && item.plannedAt === plannedAt
    ).length;
  }

  function rowFromCommittedPlan(med, today, time, nowMs) {
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

    return {
      medication: med,
      plannedDate: today,
      plannedTime: time,
      plannedAt,
      plannedMs,
      status: plannedMs > nowMs ? 'waiting' : 'missed',
      actualAt: null,
      canTake: true,
      canCorrect: false,
      correctionCount: count,
      countdownMode: plannedMs > nowMs ? 'remaining' : 'late',
      countdownMs: Math.abs(plannedMs - nowMs)
    };
  }

  const originalBuildTimeline = window.buildMedControlTimeline;
  if (typeof originalBuildTimeline === 'function') {
    window.buildMedControlTimeline = function() {
      const baseRows = originalBuildTimeline() || [];
      const state = getState();
      const today = currentLocalDate();
      const nowMs = Date.now();
      const byKey = new Map();

      baseRows.forEach(row => {
        const key = `${row?.medication?.id || ''}|${row?.plannedAt || ''}`;
        byKey.set(key, row);
      });

      (state.medications || []).forEach(med => {
        if (!med || med.cancelled || !med.active) return;

        committedPastTimesForToday(med, nowMs).forEach(time => {
          const plannedAt = getScheduledDateTime(today, time);
          const key = `${med.id}|${plannedAt}`;
          if (!byKey.has(key)) {
            byKey.set(key, rowFromCommittedPlan(med, today, time, nowMs));
          }
        });
      });

      return [...byKey.values()].sort(
        (a, b) => (a?.plannedMs ?? Infinity) - (b?.plannedMs ?? Infinity)
      );
    };
  }

  const originalRenderInputPage = window.renderInputPage;
  if (typeof originalRenderInputPage === 'function') {
    window.renderInputPage = function() {
      originalRenderInputPage();

      [...document.querySelectorAll('section')].forEach(section => {
        const heading = section.querySelector('h2');
        if (heading?.textContent?.trim() !== 'Завершённые курсы') return;
        section.querySelectorAll('.status').forEach(status => {
          status.textContent = '—';
          status.className = 'status';
        });
      });
    };
  }
})();
