(function () {
  'use strict';

  function medicationRowsHtml(state) {
    const meds = (state.medications || []).slice().sort((a,b) => (a.order || 0) - (b.order || 0));
    if (!meds.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;

    return `<table>
      <thead><tr>
        <th>${escapeHtml(tr('row'))}</th>
        <th>${escapeHtml(tr('medication'))}</th>
        <th>${escapeHtml(tr('status'))}</th>
        <th>${escapeHtml(tr('history'))}</th>
      </tr></thead>
      <tbody>${meds.map(med => `
        <tr>
          <td>${escapeHtml(String(med.order ?? '—'))}</td>
          <td>${escapeHtml(med.name || '—')}</td>
          <td>${escapeHtml(med.cancelled ? tr('cancelled') : (med.active ? tr('active') : tr('passive')))}</td>
          <td><button type="button" onclick="showStoredMedicationHistory('${String(med.id).replace(/'/g, "\\'")}')">${escapeHtml(tr('history'))}</button></td>
        </tr>`).join('')}</tbody>
    </table>`;
  }

  function intakeRowsHtml(state) {
    const medications = new Map((state.medications || []).map(med => [med.id, med]));
    const logs = (state.intakeLogs || [])
      .slice()
      .sort((a, b) => new Date(b.actualAt || b.plannedAt) - new Date(a.actualAt || a.plannedAt));

    if (!logs.length) return '';

    return `<table>
      <thead><tr>
        <th>${escapeHtml(tr('medication'))}</th>
        <th>${escapeHtml(tr('planned_time'))}</th>
        <th>${escapeHtml(tr('actual_time'))}</th>
        <th>${escapeHtml(tr('result'))}</th>
        <th>${escapeHtml(tr('status'))}</th>
      </tr></thead>
      <tbody>${logs.map(log => {
        const med = medications.get(log.medicationId);
        const result = log.action === 'taken' ? tr('take') : tr('cancel');
        return `<tr>
          <td>${escapeHtml(med?.name || '—')}</td>
          <td>${escapeHtml(formatDateTime(log.plannedAt))}</td>
          <td>${escapeHtml(formatDateTime(log.actualAt))}</td>
          <td>${escapeHtml(result)}</td>
          <td>${escapeHtml(statusLabel(log.status))}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  function allHistoryHtml() {
    const state = getState();
    const intake = intakeRowsHtml(state);
    if (intake) return intake;
    return medicationRowsHtml(state);
  }

  function ensureDialog() {
    let dialog = document.getElementById('allIntakeHistoryDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'allIntakeHistoryDialog';
    dialog.className = 'row-history-dialog';
    dialog.innerHTML = `
      <h2>${escapeHtml(tr('history_title'))}</h2>
      <div id="allIntakeHistoryContent"></div>
      <div class="right" style="margin-top:14px">
        <button type="button" onclick="document.getElementById('allIntakeHistoryDialog').close()">${escapeHtml(tr('close'))}</button>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  window.showStoredMedicationHistory = function (medicationId) {
    const med = (getState().medications || []).find(item => String(item.id) === String(medicationId));
    const dialog = ensureDialog();
    const content = dialog.querySelector('#allIntakeHistoryContent');
    content.innerHTML = med && Array.isArray(med.rowHistory) && med.rowHistory.length
      ? rowHistoryHtml(med.rowHistory)
      : `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
    dialog.showModal();
  };

  window.showAllIntakeHistory = function () {
    const dialog = ensureDialog();
    dialog.querySelector('#allIntakeHistoryContent').innerHTML = allHistoryHtml();
    dialog.showModal();
  };

  const originalRenderActionPage = window.renderActionPage;
  if (typeof originalRenderActionPage !== 'function') return;

  window.renderActionPage = function () {
    originalRenderActionPage.apply(this, arguments);
    if (buildTodayEntries().length !== 0) return;
    const emptyCell = document.querySelector('section.card table tbody td[colspan="8"]');
    if (!emptyCell) return;
    emptyCell.innerHTML = `${escapeHtml(tr('no_items'))} <button type="button" onclick="showAllIntakeHistory()" style="margin-left:10px">${escapeHtml(tr('history'))}</button>`;
  };
})();
