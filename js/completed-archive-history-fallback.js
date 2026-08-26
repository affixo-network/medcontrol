(function(){
  function text(value) {
    return escapeHtml(value === '' || value === null || value === undefined ? '—' : String(value));
  }

  function scheduleLabel(med) {
    if (med.scheduleType === 'daily' || !med.scheduleType) return 'Каждый день';
    if (med.scheduleType === 'weekdays') return 'Дни недели';
    if (med.scheduleType === 'explicit_dates') return 'Даты';
    return med.scheduleType || '—';
  }

  function scheduleParameters(med) {
    if (med.scheduleType === 'daily' || !med.scheduleType) return 'Ежедневно';
    if (med.scheduleType === 'weekdays') {
      const labels = { Mon:'Пн', Tue:'Вт', Wed:'Ср', Thu:'Чт', Fri:'Пт', Sat:'Сб', Sun:'Вс' };
      return (med.weekdays || []).map(code => labels[code] || code).join(', ') || '—';
    }
    if (med.scheduleType === 'explicit_dates') {
      return (med.explicitDates || []).map(value => formatDate(value)).join(', ') || '—';
    }
    return '—';
  }

  function contentUnitLabel(med) {
    if (typeof medicationContentUnitLabel === 'function') {
      return medicationContentUnitLabel(med.contentUnit, med.contentUnitOther || '');
    }
    return med.contentUnitOther || med.contentUnit || '—';
  }

  function intakeUnitLabel(med) {
    if (typeof medicationIntakeUnitLabel === 'function') {
      return medicationIntakeUnitLabel(med.intakeUnit, med.intakeUnitOther || '');
    }
    return med.intakeUnitOther || med.intakeUnit || '—';
  }

  function preservedCourseCardHtml(med) {
    return `
      <h3>Сохранённые данные курса</h3>
      <table>
        <thead>
          <tr>
            <th>Препарат</th>
            <th>Производитель</th>
            <th>Количественное содержание</th>
            <th>Единица содержания</th>
            <th>Количество приёма</th>
            <th>Единица приёма</th>
            <th>Детали</th>
            <th>Расписание</th>
            <th>Параметры расписания</th>
            <th>Время</th>
            <th>Дата начала</th>
            <th>Дата окончания</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${text(med.name)}</td>
            <td>${text(med.manufacturer)}</td>
            <td>${text(med.contentValue)}</td>
            <td>${text(contentUnitLabel(med))}</td>
            <td>${text(med.intakeQuantity)}</td>
            <td>${text(intakeUnitLabel(med))}</td>
            <td>${text(med.details)}</td>
            <td>${text(scheduleLabel(med))}</td>
            <td>${text(scheduleParameters(med))}</td>
            <td>${text((med.times || []).join(', '))}</td>
            <td>${text(med.startDate ? formatDate(med.startDate) : '—')}</td>
            <td>${text(med.endDate ? formatDate(med.endDate) : '—')}</td>
          </tr>
        </tbody>
      </table>`;
  }

  const previousShowCompletedCourseHistory = window.showCompletedCourseHistory;

  window.showCompletedCourseHistory = function(id) {
    const state = getState();
    const med = (state.medications || []).find(item => item.id === id);
    if (!med) return;

    const rowEntries = Array.isArray(med.rowHistory)
      ? med.rowHistory.filter(entry => {
          const action = entry?.action || entry?.event || '';
          return action !== 'course_completed' && action !== 'course_status_corrected';
        })
      : [];

    const intakeLogs = (state.intakeLogs || []).filter(item => item.medicationId === id);
    const corrections = (state.intakeCorrections || []).filter(item => item.medicationId === id);

    if (rowEntries.length || intakeLogs.length || corrections.length) {
      return previousShowCompletedCourseHistory(id);
    }

    const dialog = document.getElementById('rowHistoryDialog');
    const content = document.getElementById('rowHistoryContent');
    const title = dialog?.querySelector('h2');
    if (!dialog || !content) return;

    if (title) title.textContent = `История препарата «${med.name}»`;

    content.innerHTML = `
      ${preservedCourseCardHtml(med)}
      <h3 style="margin-top:18px">История событий</h3>
      <p class="muted">Для этой старой архивной записи журнал событий не был сохранён. Показанные выше данные — это сохранённая карточка курса, а не восстановленная история.</p>
      <h3 style="margin-top:18px">История расчётных приёмов</h3>
      <p class="muted">Сохранённых событий расчётных приёмов для этой старой записи нет.</p>`;

    dialog.showModal();
  };
})();
