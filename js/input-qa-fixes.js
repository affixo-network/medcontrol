(function(){
  const originalCreateMedicationFromForm = window.createMedicationFromForm;
  if (typeof originalCreateMedicationFromForm === 'function') {
    window.createMedicationFromForm = function(prefix) {
      const item = originalCreateMedicationFromForm(prefix);
      if (prefix === 'create_') item.active = true;
      return item;
    };
  }

  function dateISOPlusDays(dateISO, days) {
    const [y, m, d] = dateISO.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function weekdayCode(dateISO) {
    const [y, m, d] = dateISO.split('-').map(Number);
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  }

  function medicationLastDate(med) {
    if (med.scheduleType === 'explicit_dates') {
      const dates = (med.explicitDates || []).filter(Boolean).slice().sort();
      return dates.length ? dates[dates.length - 1] : '';
    }
    return med.endDate || '';
  }

  function scheduleAppliesIgnoringMode(med, dateISO) {
    if (!med || med.cancelled) return false;

    if (med.scheduleType === 'explicit_dates') {
      return (med.explicitDates || []).includes(dateISO);
    }

    if (med.startDate && dateISO < med.startDate) return false;
    if (med.endDate && dateISO > med.endDate) return false;

    if (med.scheduleType === 'weekdays') {
      return (med.weekdays || []).includes(weekdayCode(dateISO));
    }

    return med.scheduleType === 'daily' || !med.scheduleType;
  }

  function hasApplicableDateFromToday(med) {
    const today = currentLocalDate();
    const lastDate = medicationLastDate(med);
    if (!lastDate || lastDate < today) return false;

    for (let offset = 0; offset <= 370; offset += 1) {
      const dateISO = dateISOPlusDays(today, offset);
      if (dateISO > lastDate) break;
      if (scheduleAppliesIgnoringMode(med, dateISO)) return true;
    }
    return false;
  }

  function shouldCompleteCourse(med) {
    if (!med || med.cancelled) return false;
    const lastDate = medicationLastDate(med);
    if (!lastDate) return false;
    return lastDate < currentLocalDate();
  }

  function reconcileCompletedCourses(state) {
    let changed = false;
    (state.medications || []).forEach(med => {
      if (med.cancelled) return;
      const shouldBeCompleted = shouldCompleteCourse(med);

      if (shouldBeCompleted && !med.courseCompleted) {
        med.courseCompleted = true;
        med.active = false;
        recordRowHistory(med, 'course_completed', 'Курс приёма препарата завершён автоматически.');
        changed = true;
      }

      if (!shouldBeCompleted && med.courseCompleted) {
        med.courseCompleted = false;
        changed = true;
      }

      if (Array.isArray(med.rowHistory)) {
        const filtered = med.rowHistory.filter(entry =>
          entry?.action !== 'course_status_corrected' &&
          entry?.event !== 'course_status_corrected'
        );
        if (filtered.length !== med.rowHistory.length) {
          med.rowHistory = filtered;
          changed = true;
        }
      }
    });
    if (changed) saveState(state);
  }

  window.isCompletedMedicationCourse = function(med) {
    return Boolean(med && !med.cancelled && shouldCompleteCourse(med));
  };

  function completedHistoryPlannedAts(medicationId) {
    const state = getState();
    return [...new Set([
      ...(state.intakeLogs || []).filter(x => x.medicationId === medicationId).map(x => x.plannedAt),
      ...(state.intakeCorrections || []).filter(x => x.medicationId === medicationId).map(x => x.plannedAt)
    ].filter(Boolean))].sort((a, b) => new Date(a) - new Date(b));
  }

  function plannedTimeLabel(plannedAt) {
    const parts = formatDateTime(plannedAt).split(', ');
    return parts[1] || '—';
  }

  window.showCompletedCourseHistory = function(id) {
    const med = (getState().medications || []).find(item => item.id === id);
    if (!med) return;

    const dialog = document.getElementById('rowHistoryDialog');
    const content = document.getElementById('rowHistoryContent');
    const title = dialog?.querySelector('h2');
    if (!dialog || !content) return;

    if (title) title.textContent = `История препарата «${med.name}»`;

    const slots = completedHistoryPlannedAts(id);
    const slotHtml = slots.length
      ? `<div class="inline" style="gap:8px;flex-wrap:wrap">${slots.map(plannedAt => `<button type="button" onclick="showCompletedSlotHistory('${id}','${plannedAt}')">${escapeHtml(formatDateTime(plannedAt))}</button>`).join('')}</div>`
      : '<p class="muted">Событий расчётных приёмов пока нет.</p>';

    content.innerHTML = `${rowHistoryHtml(med.rowHistory || [])}<h3 style="margin-top:18px">История расчётных приёмов</h3>${slotHtml}`;
    dialog.showModal();
  };

  window.showCompletedSlotHistory = function(id, plannedAt) {
    const med = (getState().medications || []).find(item => item.id === id);
    if (!med) return;

    const dialog = document.getElementById('rowHistoryDialog');
    const content = document.getElementById('rowHistoryContent');
    const title = dialog?.querySelector('h2');
    if (!dialog || !content) return;

    if (title) title.textContent = `История приёма препарата «${med.name}» — расчётное время ${plannedTimeLabel(plannedAt)}`;

    const historyHtml = typeof window.intakeHistoryRows === 'function'
      ? window.intakeHistoryRows(id, 'all', plannedAt)
      : '<p class="muted">История приёма недоступна.</p>';

    content.innerHTML = `<div style="margin-bottom:12px"><button type="button" onclick="showCompletedCourseHistory('${id}')">Назад к истории препарата</button></div>${historyHtml}`;
    dialog.showModal();
  };

  const originalCreateMedication = window.createMedication;
  if (typeof originalCreateMedication === 'function') {
    window.createMedication = function() {
      originalCreateMedication();
      const content = document.getElementById('medicationConfirmContent');
      const table = content?.querySelector('table');
      if (table && !table.querySelector('[data-confirm-status]')) {
        const row = document.createElement('tr');
        row.setAttribute('data-confirm-status', '1');
        row.innerHTML = '<td>Статус</td><td>Активно</td>';
        table.appendChild(row);
      }
    };
  }

  const originalRowHistoryHtml = window.rowHistoryHtml;
  if (typeof originalRowHistoryHtml === 'function') {
    window.rowHistoryHtml = function(entries) {
      const visibleEntries = Array.isArray(entries)
        ? entries.filter(entry =>
            entry?.action !== 'course_status_corrected' &&
            entry?.event !== 'course_status_corrected'
          )
        : entries;
      const html = originalRowHistoryHtml(visibleEntries);
      const template = document.createElement('template');
      template.innerHTML = html;
      const table = template.content.querySelector('table');
      if (!table) return html;
      table.querySelectorAll('tr').forEach(row => {
        if (row.children.length === 15) row.lastElementChild?.remove();
        const eventCell = row.children[1];
        const statusCell = row.children[13];
        const eventText = eventCell?.textContent?.trim();
        if (eventText === 'course_completed') {
          eventCell.textContent = 'Курс завершён';
          if (statusCell) statusCell.textContent = 'Курс завершён';
        }
      });
      return template.innerHTML;
    };
  }

  const originalRenderInputPage = window.renderInputPage;
  if (typeof originalRenderInputPage === 'function') {
    window.renderInputPage = function() {
      const stateBefore = getState();
      reconcileCompletedCourses(stateBefore);
      originalRenderInputPage();

      const active = document.getElementById('create_active');
      if (active) {
        active.checked = true;
        active.disabled = true;
      }

      const state = getState();
      const current = (state.medications || []).filter(med => !med.cancelled);
      const activeMeds = current.filter(med => med.active && !med.courseCompleted);
      const passiveMeds = current.filter(med => !med.active && !med.courseCompleted);
      const completedMeds = current.filter(med => med.courseCompleted);

      document.querySelectorAll('button[onclick^="toggleMedicationMode("]').forEach(button => {
        const match = button.getAttribute('onclick')?.match(/toggleMedicationMode\('([^']+)'\)/);
        const id = match?.[1];
        const med = id ? current.find(item => item.id === id) : null;
        if (med) button.textContent = med.active ? 'Сделать пассивным' : 'Активировать';
      });

      const sourceTable = [...document.querySelectorAll('table')].find(table => table.querySelector('button[onclick^="openEditMedication("]'));
      if (!sourceTable) return;

      const rowById = new Map();
      sourceTable.querySelectorAll('tbody tr').forEach(row => {
        const onclick = [...row.querySelectorAll('button[onclick]')].map(b => b.getAttribute('onclick') || '').join(' ');
        const med = current.find(item => onclick.includes(`'${item.id}'`));
        if (med) rowById.set(med.id, row.cloneNode(true));
      });

      const originalHeading = sourceTable.closest('section')?.querySelector('h2');
      if (originalHeading) originalHeading.textContent = 'Активные препараты';

      const renderRows = (table, meds, mode) => {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        meds.forEach(med => {
          const source = rowById.get(med.id);
          if (!source) return;
          const row = source.cloneNode(true);
          const status = row.querySelector('.status');
          if (status) status.textContent = mode === 'completed' ? 'Курс завершён' : mode === 'passive' ? 'Пассивно' : 'Активно';
          const actions = row.lastElementChild;
          if (actions && mode === 'completed') {
            actions.innerHTML = `<button onclick="showCompletedCourseHistory('${med.id}')">История</button>`;
          } else if (actions && mode === 'passive') {
            actions.querySelectorAll('button').forEach(button => {
              const onclick = button.getAttribute('onclick') || '';
              if (!onclick.startsWith('toggleMedicationMode(') && !onclick.startsWith('showRowHistory(')) button.remove();
            });
            const toggle = actions.querySelector('button[onclick^="toggleMedicationMode("]');
            if (toggle) toggle.textContent = 'Активировать';
          }
          tbody.appendChild(row);
        });
      };

      renderRows(sourceTable, activeMeds, 'active');

      let anchor = sourceTable.closest('section');
      const appendSection = (title, meds, mode) => {
        const section = document.createElement('section');
        section.className = 'card';
        const heading = document.createElement('h2');
        heading.textContent = title;
        section.appendChild(heading);
        const table = sourceTable.cloneNode(true);
        renderRows(table, meds, mode);
        section.appendChild(table);
        anchor.after(section);
        anchor = section;
      };

      appendSection('Пассивные препараты', passiveMeds, 'passive');
      appendSection('Завершённые курсы', completedMeds, 'completed');
    };
  }

  const originalToggleMedicationMode = window.toggleMedicationMode;
  if (typeof originalToggleMedicationMode === 'function') {
    window.toggleMedicationMode = function(id) {
      const med = (getState().medications || []).find(item => item.id === id);
      if (med && med.courseCompleted) return;
      return originalToggleMedicationMode(id);
    };
  }
})();
