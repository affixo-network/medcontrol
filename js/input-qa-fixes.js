(function(){
  const originalCreateMedicationFromForm = window.createMedicationFromForm;
  if (typeof originalCreateMedicationFromForm === 'function') {
    window.createMedicationFromForm = function(prefix) {
      const item = originalCreateMedicationFromForm(prefix);
      if (prefix === 'create_') item.active = true;
      return item;
    };
  }

  function medicationLastDate(med) {
    if (med.scheduleType === 'explicit_dates') {
      const dates = (med.explicitDates || []).filter(Boolean).slice().sort();
      return dates.length ? dates[dates.length - 1] : '';
    }
    return med.endDate || '';
  }

  function isCompletedCourse(med) {
    if (!med || med.cancelled) return false;
    const lastDate = medicationLastDate(med);
    return Boolean(lastDate && lastDate < currentLocalDate());
  }

  window.isCompletedMedicationCourse = isCompletedCourse;

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
      const html = originalRowHistoryHtml(entries);
      const template = document.createElement('template');
      template.innerHTML = html;
      const table = template.content.querySelector('table');
      if (!table) return html;
      table.querySelectorAll('tr').forEach(row => {
        if (row.children.length === 15) row.lastElementChild?.remove();
      });
      return template.innerHTML;
    };
  }

  function sectionTitleBefore(table, title) {
    if (!table || table.previousElementSibling?.dataset?.medSectionTitle) return;
    const heading = document.createElement('h2');
    heading.dataset.medSectionTitle = '1';
    heading.textContent = title;
    table.parentNode.insertBefore(heading, table);
  }

  function cloneMedicationTable(sourceTable, title, medications, mode) {
    if (!sourceTable || !medications.length) return;
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);
    const table = sourceTable.cloneNode(true);
    const tbody = table.querySelector('tbody');
    if (tbody) tbody.innerHTML = '';
    medications.forEach(med => {
      const sourceRow = sourceTable.querySelector(`button[onclick*="'${med.id}'"]`)?.closest('tr');
      if (!sourceRow || !tbody) return;
      const row = sourceRow.cloneNode(true);
      const status = row.querySelector('.status');
      if (status) status.textContent = mode === 'completed' ? 'Курс завершён' : 'Пассивно';
      const actionCell = row.lastElementChild;
      if (actionCell) {
        if (mode === 'completed') {
          actionCell.innerHTML = `<button onclick="showRowHistory('${med.id}')">История</button>`;
        } else {
          actionCell.querySelectorAll('button').forEach(button => {
            if (!button.getAttribute('onclick')?.startsWith('toggleMedicationMode(') && !button.getAttribute('onclick')?.startsWith('showRowHistory(')) button.remove();
          });
        }
      }
      tbody.appendChild(row);
    });
    sourceTable.closest('section')?.after(section);
    section.appendChild(table);
  }

  const originalRenderInputPage = window.renderInputPage;
  if (typeof originalRenderInputPage === 'function') {
    window.renderInputPage = function() {
      originalRenderInputPage();

      const active = document.getElementById('create_active');
      if (active) {
        active.checked = true;
        active.disabled = true;
      }

      const state = getState();
      const current = (state.medications || []).filter(med => !med.cancelled);
      const activeMeds = current.filter(med => med.active && !isCompletedCourse(med));
      const passiveMeds = current.filter(med => !med.active && !isCompletedCourse(med));
      const completedMeds = current.filter(isCompletedCourse);

      document.querySelectorAll('button[onclick^="toggleMedicationMode("]').forEach(button => {
        const match = button.getAttribute('onclick')?.match(/toggleMedicationMode\('([^']+)'\)/);
        const id = match?.[1];
        const med = id ? current.find(item => item.id === id) : null;
        if (med) button.textContent = med.active ? 'Сделать пассивным' : 'Активировать';
      });

      const sourceTable = [...document.querySelectorAll('table')].find(table => table.querySelector('button[onclick^="openEditMedication("]'));
      if (!sourceTable) return;
      sectionTitleBefore(sourceTable, 'Активные препараты');

      const activeIds = new Set(activeMeds.map(med => med.id));
      sourceTable.querySelectorAll('tbody tr').forEach(row => {
        const button = row.querySelector('button[onclick]');
        const match = button?.getAttribute('onclick')?.match(/'([^']+)'/);
        if (match && !activeIds.has(match[1])) row.remove();
      });

      let anchor = sourceTable.closest('section');
      const appendSection = (title, meds, mode) => {
        if (!meds.length) return;
        const section = document.createElement('section');
        section.className = 'card';
        section.innerHTML = `<h2>${title}</h2>`;
        const table = sourceTable.cloneNode(true);
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.innerHTML = '';
        meds.forEach(med => {
          const allRows = [...document.querySelectorAll('tr')];
          const original = allRows.find(row => [...row.querySelectorAll('button[onclick]')].some(b => b.getAttribute('onclick')?.includes(`'${med.id}'`)));
          if (!original || !tbody) return;
          const row = original.cloneNode(true);
          const status = row.querySelector('.status');
          if (status) status.textContent = mode === 'completed' ? 'Курс завершён' : 'Пассивно';
          const actions = row.lastElementChild;
          if (actions && mode === 'completed') actions.innerHTML = `<button onclick="showRowHistory('${med.id}')">История</button>`;
          else if (actions) {
            actions.querySelectorAll('button').forEach(button => {
              const onclick = button.getAttribute('onclick') || '';
              if (!onclick.startsWith('toggleMedicationMode(') && !onclick.startsWith('showRowHistory(')) button.remove();
            });
          }
          tbody.appendChild(row);
        });
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
      if (med && isCompletedCourse(med)) return;
      return originalToggleMedicationMode(id);
    };
  }
})();
