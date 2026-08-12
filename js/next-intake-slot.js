(function () {
  function dateISOPlusDays(dateISO, days) {
    const [y, m, d] = dateISO.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function entryFor(med, dateISO, time, now) {
    const plannedAt = getScheduledDateTime(dateISO, time);
    const plannedMs = new Date(plannedAt).getTime();
    if (Number.isNaN(plannedMs)) return null;
    const log = getLogForSchedule(med.id, plannedAt);
    const boardState = log ? null : computePendingSlotStatus(plannedMs, now);
    return {
      medication: med,
      plannedDate: dateISO,
      plannedTime: time,
      plannedAt,
      log,
      boardState,
      displayStatus: log
        ? computeStatusForLog(plannedAt, log.actualAt, log.action)
        : boardState
    };
  }

  function nextApplicableEntry(med, todayISO, now) {
    const times = Array.isArray(med.times) ? med.times.filter(Boolean).slice().sort() : [];
    if (!times.length) return null;

    for (let offset = 0; offset <= 370; offset += 1) {
      const dateISO = dateISOPlusDays(todayISO, offset);
      if (!isMedicationApplicableOnDate(med, dateISO)) continue;

      for (const time of times) {
        const entry = entryFor(med, dateISO, time, now);
        if (!entry) continue;
        if (new Date(entry.plannedAt).getTime() >= now) return entry;
      }
    }
    return null;
  }

  window.buildActionEntries = function() {
    const todayISO = currentLocalDate();
    const now = Date.now();
    const state = getState();
    const output = [];

    (Array.isArray(state.medications) ? state.medications : []).forEach(med => {
      ensureTemporalChangeState(med);
      if (med.cancelled) return;
      if (med.temporalPending.schedule || med.temporalPending.time) return;

      const times = Array.isArray(med.times) ? med.times.filter(Boolean) : [];
      const todayEntries = [];

      if (isMedicationApplicableOnDate(med, todayISO)) {
        times.forEach(time => {
          const entry = entryFor(med, todayISO, time, now);
          if (entry) todayEntries.push(entry);
        });
      }

      if (todayEntries.length) {
        output.push(...todayEntries);
        return;
      }

      const next = nextApplicableEntry(med, todayISO, now);
      if (next) {
        next.boardState = 'upcoming';
        next.displayStatus = 'upcoming';
        output.push(next);
      }
    });

    return output.sort((a, b) => new Date(a.plannedAt) - new Date(b.plannedAt));
  };

  window.renderActionPage = function() {
    const entries = buildActionEntries();
    const rows = entries.map(item => {
      const log = item.log;
      const temporalButtons = `<button onclick="beginTemporalCancellation('${item.medication.id}','schedule')">Отменить Расписание</button> <button onclick="beginTemporalCancellation('${item.medication.id}','time')">Отменить Время</button>`;
      const isFutureDay = item.plannedDate !== currentLocalDate();
      const actionButtons = isFutureDay
        ? temporalButtons
        : !log
          ? `<button onclick="markTaken('${item.medication.id}','${item.plannedAt}')">${escapeHtml(tr('take'))}</button> ${temporalButtons}`
          : `<button onclick="openCorrection('${item.medication.id}','${item.plannedAt}')">${escapeHtml(tr('correct'))}</button> ${temporalButtons}`;

      return `<tr><td>${item.medication.order}</td><td>${escapeHtml(item.medication.name)}</td><td>${escapeHtml(item.medication.dose)}</td><td>${escapeHtml(formatDate(item.plannedDate))}</td><td>${escapeHtml(item.plannedTime)}</td><td><span class="${statusClass(item.displayStatus)}">${escapeHtml(statusLabel(item.displayStatus))}</span></td><td>${log ? escapeHtml(formatDateTime(log.actualAt)) : '—'}</td><td>${actionButtons}</td><td><button onclick="showIntakeHistory('${item.medication.id}')">${escapeHtml(tr('history'))}</button></td></tr>`;
    }).join('');

    const body = `
      <section class="card"><h1>${escapeHtml(tr('title_action'))}</h1><p>${escapeHtml(tr('action_intro'))}</p></section>
      ${temporalPendingNoticeHtml()}
      <section class="card"><h2>${escapeHtml(tr('action_title_1'))}</h2><table><thead><tr><th>${escapeHtml(tr('row'))}</th><th>${escapeHtml(tr('medication'))}</th><th>${escapeHtml(tr('dose'))}</th><th>Дата приёма</th><th>${escapeHtml(tr('planned_time'))}</th><th>${escapeHtml(tr('status'))}</th><th>${escapeHtml(tr('actual_time'))}</th><th>${escapeHtml(tr('actions'))}</th><th>${escapeHtml(tr('history'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="9">${escapeHtml(tr('no_items'))}</td></tr>`}</tbody></table></section>
      <dialog id="intakeHistoryDialog"><h2>${escapeHtml(tr('history_title'))}</h2><div class="inline" style="margin-bottom:12px"><label>${escapeHtml(tr('history_period'))}</label><select id="historyPeriodSelect" onchange="refreshIntakeHistory()"><option value="today">${escapeHtml(tr('period_today'))}</option><option value="7">${escapeHtml(tr('period_7'))}</option><option value="30">${escapeHtml(tr('period_30'))}</option><option value="all">${escapeHtml(tr('period_all'))}</option></select></div><div id="intakeHistoryContent"></div><div class="right" style="margin-top:14px"><button onclick="document.getElementById('intakeHistoryDialog').close()">${escapeHtml(tr('close'))}</button></div></dialog>
      <dialog id="correctionDialog"><h2>${escapeHtml(tr('correct'))}</h2><div id="correctionContent"></div></dialog>
      <dialog id="temporalCancellationDialog"><h2>Изменение временного назначения</h2><p id="temporalCancellationText"></p><div class="dialog-actions"><button onclick="saveTemporalCancellation()">Сохранить</button><button onclick="cancelTemporalCancellationDraft()">Закрыть</button></div></dialog>`;

    document.body.innerHTML = appShell(tr('title_action'), 'action', body);
    scheduleClock();
  };

  window.__nextIntakeSlotTest = function(med, todayISO, nowMs) {
    const entry = nextApplicableEntry(med, todayISO, nowMs);
    return entry ? { plannedDate: entry.plannedDate, plannedTime: entry.plannedTime } : null;
  };
})();
