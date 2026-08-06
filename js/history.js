function rowHistoryActionLabel(action) {
  const labels = {
    created: 'Создано',
    edited: 'Изменено',
    activated: 'Активировано',
    deactivated: 'Деактивировано',

    // Поддержка старых записей
    active: 'Активировано',
    passive: 'Деактивировано'
  };

  return labels[action] || action || '—';
}

function rowHistoryHtml(entries) {
  if (!entries || !entries.length) {
    return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  }

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.at) - new Date(a.at)
  );

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(tr('actual_time'))}</th>
          <th>${escapeHtml(tr('result'))}</th>
          <th>${escapeHtml(tr('details'))}</th>
        </tr>
      </thead>

      <tbody>
        ${sortedEntries.map(entry => `
          <tr>
            <td>${escapeHtml(formatDateTime(entry.at))}</td>
            <td>${escapeHtml(rowHistoryActionLabel(entry.action))}</td>
            <td>${escapeHtml(entry.payload || '—')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
