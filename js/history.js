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

  const cellValue = (entry, field, formatter = value => value) => {
    const source =
      entry.action === 'created'
        ? entry.snapshot
        : entry.changes;

    if (!source || !(field in source)) {
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
          const scheduleType =
            entry.snapshot?.scheduleType ||
            entry.changes?.scheduleType ||
            '';

          const scheduleText =
            scheduleType === 'daily'
              ? 'Каждый день'
              : scheduleType === 'weekdays'
                ? 'Дни недели'
                : scheduleType === 'explicit_dates'
                  ? 'Даты'
                  : '';

          let scheduleParameters = '';

          const source =
            entry.action === 'created'
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
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}
