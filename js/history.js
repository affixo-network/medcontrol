function rowHistoryActionLabel(action) {
  const labels = {
    created: 'Создано',
    edited: 'Изменено',
    cancelled: 'Отменено',
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
    (a, b) => new Date(a.at) - new Date(b.at)
  );

  const weekdayLabels = {
    Mon: 'Пн',
    Tue: 'Вт',
    Wed: 'Ср',
    Thu: 'Чт',
    Fri: 'Пт',
    Sat: 'Сб',
    Sun: 'Вс'
  };

  const weekdayOrder = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun'
  ];

  const formatWeekdays = values =>
    Array.isArray(values) && values.length
      ? values
          .slice()
          .sort(
            (a, b) =>
              weekdayOrder.indexOf(a) -
              weekdayOrder.indexOf(b)
          )
          .map(code => weekdayLabels[code] || code)
          .join(', ')
      : '';

  const formatDates = values =>
    Array.isArray(values) && values.length
      ? values.map(value => formatDate(value)).join(', ')
      : '';
const parseLegacyHistoryPayload = entry => {
  if (
    entry.snapshot ||
    entry.changes ||
    !entry.payload ||
    typeof entry.payload !== 'string'
  ) {
    return null;
  }

  const payload = entry.payload.trim();
  const result = {};

  const scheduleMatch = payload.match(
    /^(Каждый день|Дни недели|Даты)(?:;|$)/
  );

  if (scheduleMatch) {
    result.scheduleText = scheduleMatch[1];
  }

  const timeMatch = payload.match(
    /(?:^|;\s*)Время:\s*([^;]*)/
  );

  if (timeMatch) {
    result.times = timeMatch[1].trim();
  }

  const detailsMatch = payload.match(
    /(?:^|;\s*)Детали:\s*([^;]*)/
  );

  if (detailsMatch) {
    result.details = detailsMatch[1].trim();
  }

  const ruleMatch = payload.match(
    /(?:^|;\s*)Правило приёма:\s*(.*)$/
  );

  if (ruleMatch) {
    const rule = ruleMatch[1].trim();

    if (result.scheduleText === 'Каждый день') {
      const dateRange = rule.split('→');

      if (dateRange.length === 2) {
        result.startDate = dateRange[0].trim();
        result.endDate = dateRange[1].trim();
      }

      result.scheduleParameters = 'Ежедневно';
    }

    if (result.scheduleText === 'Дни недели') {
      const ruleParts = rule.split(';');

      const weekdaysText =
        ruleParts[0]?.trim() || '';

      const weekdayOrder = [
        'Пн',
        'Вт',
        'Ср',
        'Чт',
        'Пт',
        'Сб',
        'Вс'
      ];

      result.scheduleParameters =
        weekdaysText
          .split(',')
          .map(day => day.trim())
          .filter(Boolean)
          .sort(
            (a, b) =>
              weekdayOrder.indexOf(a) -
              weekdayOrder.indexOf(b)
          )
          .join(', ');

      const datePart =
        ruleParts.slice(1).join(';').trim();

      if (datePart) {
        const dateRange = datePart.split('→');

        if (dateRange.length === 2) {
          const startDate = dateRange[0].trim();
          const endDate = dateRange[1].trim();

          if (startDate && startDate !== '—') {
            result.startDate = startDate;
          }

          if (endDate && endDate !== '—') {
            result.endDate = endDate;
          }
        }
      }
    }

    if (result.scheduleText === 'Даты') {
      result.scheduleParameters = rule;
    }
  }

  return result;
};  
  
  const cellValue = (entry, field, formatter = value => value) => {
  if (entry.action === 'cancelled') {
    return '';
  }

  const source =
    entry.action === 'created'
      ? entry.snapshot
      : entry.changes;

  if (!source || !(field in source)) {
    const legacy =
      parseLegacyHistoryPayload(entry);

    if (
      legacy &&
      Object.prototype.hasOwnProperty.call(legacy, field)
    ) {
      return legacy[field];
    }

    return '';
  }
    const value = source[field];

    if (
      value === '' ||
      value === null ||
      value === undefined
    ) {
      return '—';
    }

    return formatter(value, source);
  };

  const unitCellValue = (entry, unitField, otherField, formatter) => {
    if (entry.action === 'cancelled') return '';

    const source =
      entry.action === 'created'
        ? entry.snapshot
        : entry.changes;

    if (!source) return '';

    if (Object.prototype.hasOwnProperty.call(source, unitField)) {
      const unit = source[unitField];
      if (unit === '' || unit === null || unit === undefined) return '—';
      return formatter(unit, source[otherField] || '');
    }

    if (Object.prototype.hasOwnProperty.call(source, otherField)) {
      const otherValue = source[otherField];
      if (otherValue === '' || otherValue === null || otherValue === undefined) return '—';
      return formatter('other', otherValue);
    }

    return '';
  };

  return `
    <table>
      <thead>
        <tr>
          <th>Дата/время</th>
          <th>Событие</th>
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
          <th>Статус</th>
          <th>${escapeHtml(tr('medication'))}</th>
        </tr>
      </thead>

      <tbody>
        ${sortedEntries.map(entry => {
          const legacyStatus =
  entry.action === 'activated'
    ? 'Активно'
    : entry.action === 'deactivated'
      ? 'Пассивно'
      : '';
          const isCancelled =
          entry.action === 'cancelled';
          const legacy =
  parseLegacyHistoryPayload(entry);

          const source =
  isCancelled
    ? {}
    : entry.action === 'created'
      ? entry.snapshot
      : entry.changes;

          const meaningfulScheduleChange =
  entry.action === 'created' ||
  Boolean(legacy?.scheduleText) ||
  Boolean(
    entry.action === 'edited' &&
    source &&
    ['weekdays', 'explicitDates', 'startDate', 'endDate']
      .some(field => Object.prototype.hasOwnProperty.call(source, field))
  );

          const scheduleType =
  isCancelled || !meaningfulScheduleChange
    ? ''
    : entry.snapshot?.scheduleType ||
      entry.changes?.scheduleType ||
      '';

          const scheduleText =
  legacy?.scheduleText ||
  (
    scheduleType === 'daily'
      ? 'Каждый день'
      : scheduleType === 'weekdays'
        ? 'Дни недели'
        : scheduleType === 'explicit_dates'
          ? 'Даты'
          : ''
  );

          let scheduleParameters =
  legacy?.scheduleParameters || '';

          if (source && meaningfulScheduleChange) {
            if (
              scheduleType === 'daily' &&
              entry.action === 'created'
            ) {
              scheduleParameters = 'Ежедневно';
            }

            if (
  scheduleType === 'weekdays' &&
  'weekdays' in source
) {
  scheduleParameters =
    formatWeekdays(source.weekdays);
}

if (
  scheduleType === 'explicit_dates' &&
  'explicitDates' in source
) {
  scheduleParameters =
    formatDates(source.explicitDates);
}
          }

          return `
            <tr>
              <td>${escapeHtml(formatDateTime(entry.at))}</td>

              <td>
                ${escapeHtml(
                  entry.action === 'activated' ||
                  entry.action === 'deactivated'
                    ? 'Изменено'
                    : rowHistoryActionLabel(entry.action)
                )}
              </td>

              <td>${escapeHtml(cellValue(entry, 'manufacturer'))}</td>

              <td>${escapeHtml(cellValue(entry, 'contentValue'))}</td>

              <td>${escapeHtml(unitCellValue(entry, 'contentUnit', 'contentUnitOther', medicationContentUnitLabel))}</td>

              <td>${escapeHtml(cellValue(entry, 'intakeQuantity'))}</td>

              <td>${escapeHtml(unitCellValue(entry, 'intakeUnit', 'intakeUnitOther', medicationIntakeUnitLabel))}</td>

              <td>${escapeHtml(cellValue(entry, 'details'))}</td>

              <td>${escapeHtml(scheduleText)}</td>

              <td>${escapeHtml(scheduleParameters)}</td>

              <td>
                ${escapeHtml(
                  cellValue(
                    entry,
                    'times',
                    value =>
                      Array.isArray(value)
                        ? value.join(', ')
                        : value
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  cellValue(
                    entry,
                    'startDate',
                    value => formatDate(value)
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  cellValue(
                    entry,
                    'endDate',
                    value => formatDate(value)
                  )
                )}
              </td>

              <td>
  ${escapeHtml(
    isCancelled
      ? 'Отменено'
      : legacyStatus ||
        cellValue(
          entry,
          'active',
          value =>
            value
              ? 'Активно'
              : 'Пассивно'
        )
  )}
</td>

              <td>${escapeHtml(cellValue(entry, 'name'))}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}
