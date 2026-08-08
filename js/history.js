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

  const result = {};

  const parts = entry.payload
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length) {
    result.scheduleText = parts[0];
  }

  parts.forEach(part => {
    if (part.startsWith('Время:')) {
      result.times = part
        .replace('Время:', '')
        .trim();
    }

    if (part.startsWith('Детали:')) {
      result.details = part
        .replace('Детали:', '')
        .trim();
    }

    if (part.startsWith('Правило приёма:')) {
      const rule = part
        .replace('Правило приёма:', '')
        .trim();

      const dateRange = rule.split('→');

      if (dateRange.length === 2) {
        result.startDate =
          dateRange[0].trim();

        result.endDate =
          dateRange[1].trim();
      } else {
        result.scheduleParameters = rule;
      }
    }
  });

  if (result.scheduleText === 'Каждый день') {
    result.scheduleParameters = 'Ежедневно';
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

    return formatter(value);
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
        </tr>
      </thead>

      <tbody>
        ${sortedEntries.map(entry => {
          const isCancelled =
          entry.action === 'cancelled';
          const legacy =
  parseLegacyHistoryPayload(entry);
          const scheduleType =
  isCancelled
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

          const source =
  isCancelled
    ? {}
    : entry.action === 'created'
      ? entry.snapshot
      : entry.changes;

          if (source) {
            if (
              scheduleType === 'daily' &&
              (
                entry.action === 'created' ||
                'scheduleType' in source
              )
            ) {
              scheduleParameters = 'Ежедневно';
            }

            if ('weekdays' in source) {
              scheduleParameters =
                formatWeekdays(source.weekdays);
            }

            if ('explicitDates' in source) {
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

              <td>
                ${escapeHtml(
                  cellValue(
                    entry,
                    'contentUnit',
                    value =>
                      medicationContentUnitLabel(
                        value,
                        entry.snapshot?.contentUnitOther || ''
                      )
                  )
                )}
              </td>

              <td>${escapeHtml(cellValue(entry, 'intakeQuantity'))}</td>

              <td>
                ${escapeHtml(
                  cellValue(
                    entry,
                    'intakeUnit',
                    value =>
                      medicationIntakeUnitLabel(
                        value,
                        entry.snapshot?.intakeUnitOther || ''
                      )
                  )
                )}
              </td>

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
      : cellValue(
          entry,
          'active',
          value =>
            value
              ? 'Активно'
              : 'Пассивно'
        )
  )}
</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}
