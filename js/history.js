function rowHistoryHtml(entries) {
  if (!entries || !entries.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  return `<table><thead><tr><th>${escapeHtml(tr('actual_time'))}</th><th>${escapeHtml(tr('result'))}</th><th>${escapeHtml(tr('details'))}</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${escapeHtml(formatDateTime(entry.at))}</td><td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.payload || '—')}</td></tr>`).join('')}</tbody></table>`;
}
