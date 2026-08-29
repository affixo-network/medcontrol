(function(){
  const baseRenderActionPage = window.renderActionPage;
  if (typeof baseRenderActionPage !== 'function') return;

  function bindDirectHistoryButtons() {
    const rows = [...document.querySelectorAll('section.card table tbody tr')];
    const entries = typeof buildTodayEntries === 'function' ? buildTodayEntries() : [];

    rows.forEach((row, index) => {
      const entry = entries[index];
      if (!entry) return;
      const button = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'История');
      if (!button) return;
      button.onclick = function(event) {
        event.preventDefault();
        event.stopPropagation();
        window.showIntakeHistory(entry.medication.id, entry.plannedAt);
      };
    });
  }

  window.renderActionPage = function() {
    const result = baseRenderActionPage.apply(this, arguments);
    bindDirectHistoryButtons();
    return result;
  };
})();
