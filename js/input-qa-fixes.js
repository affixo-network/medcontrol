(function(){
  const originalCreateMedicationFromForm = window.createMedicationFromForm;
  if (typeof originalCreateMedicationFromForm === 'function') {
    window.createMedicationFromForm = function(prefix) {
      const item = originalCreateMedicationFromForm(prefix);
      if (prefix === 'create_') item.active = true;
      return item;
    };
  }

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

  const originalRenderInputPage = window.renderInputPage;
  if (typeof originalRenderInputPage === 'function') {
    window.renderInputPage = function() {
      originalRenderInputPage();

      const active = document.getElementById('create_active');
      if (active) {
        active.checked = true;
        active.disabled = true;
      }

      document.querySelectorAll('button[onclick^="toggleMedicationMode("]').forEach(button => {
        const match = button.getAttribute('onclick')?.match(/toggleMedicationMode\('([^']+)'\)/);
        const id = match?.[1];
        const med = id ? (getState().medications || []).find(item => item.id === id) : null;
        if (med) button.textContent = med.active ? 'Сделать пассивным' : 'Активировать';
      });
    };
  }
})();
