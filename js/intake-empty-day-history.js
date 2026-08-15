(function () {
  'use strict';

  function allIntakeHistoryHtml() {
    const state = getState();
    const medications = new Map((state.medications || []).map(med => [med.id, med]));
    const logs = (state.intakeLogs || [])
      .slice()
      .sort((a, b) => new Date(b.actualAt || b.plannedAt) - new Date(a.actualAt || a.plannedAt));

    if (!logs.length) {
      return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
    }

    const rows = logs.map(log => {
      const med = medications.get(log.medicationId);
      const medicationName = med?.name || '—';
      const result = log.action === 'taken' ? tr('take') : tr('cancel');
      return `<tr>
        <td>${escapeHtml(medicationName)}</td>
        <td>${escapeHtml(formatDateTime(log.plannedAt))}</td>
        <td>${escapeHtml(formatDateTime(log.actualAt))}</td>
        <td>${escapeHtml(result)}</td>
        <td>${escapeHtml(statusLabel(log.status))}</td>
      </tr>`;
    }).join('');

    return `<table>
      <thead><tr>
        <th>${escapeHtml(tr('medication'))}</th>
        <th>${escapeHtml(tr('planned_time'))}</th>
        <th>${escapeHtml(tr('actual_time'))}</th>
        <th>${escapeHtml(tr('result'))}</th>
        <th>${escapeHtml(tr('status'))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function ensureAllHistoryDialog() {
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

  window.showAllIntakeHistory = function () {
    const dialog = ensureAllHistoryDialog();
    const content = dialog.querySelector('#allIntakeHistoryContent');
    content.innerHTML = allIntakeHistoryHtml();
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
