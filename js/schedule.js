function medicationRuleSummary(med) {
  const scheduleName =
    med.scheduleType === 'daily'
      ? tr('every_day')
      : med.scheduleType === 'weekdays'
        ? tr('weekdays')
        : tr('explicit_dates');

  const timesText =
    Array.isArray(med.times) && med.times.length
      ? med.times.join(', ')
      : '—';

  const medicationDetails =
    med.details && med.details.trim()
      ? med.details.trim()
      : '—';

  let ruleText = '—';

  if (med.scheduleType === 'daily') {
    const start = med.startDate ? formatDate(med.startDate) : '—';
    const end = med.endDate ? formatDate(med.endDate) : '—';

    ruleText = `${start} → ${end}`;
  }

  if (med.scheduleType === 'weekdays') {
    const days = Array.isArray(med.weekdays)
  ? med.weekdays
      .slice()
      .sort(
        (a, b) =>
          WEEKDAYS.findIndex(item => item[0] === a) -
          WEEKDAYS.findIndex(item => item[0] === b)
      )
      .map(code => WEEKDAYS.find(item => item[0] === code)?.[1] || code)
      .join(', ')
  : '—';

    const start = med.startDate ? formatDate(med.startDate) : '—';
    const end = med.endDate ? formatDate(med.endDate) : '—';

    ruleText = `${days || '—'}; ${start} → ${end}`;
  }

  if (med.scheduleType === 'explicit_dates') {
    ruleText =
      Array.isArray(med.explicitDates) && med.explicitDates.length
        ? med.explicitDates.map(date => formatDate(date)).join(', ')
        : '—';
  }

  return (
    `${scheduleName}; ` +
    `${tr('time_slots')}: ${timesText}; ` +
    `${tr('details')}: ${medicationDetails}; ` +
    `${tr('schedule_rule')}: ${ruleText}`
  );
}
function isMedicationApplicableOnDate(med, dateISO) {
  if (!med || !med.active || !dateISO) return false;

  if (med.scheduleType === 'explicit_dates') {
    const explicitDates = Array.isArray(med.explicitDates)
      ? med.explicitDates
      : [];

    return explicitDates.includes(dateISO);
  }

  if (med.startDate && dateISO < med.startDate) return false;
  if (med.endDate && dateISO > med.endDate) return false;

  if (med.scheduleType === 'daily') {
    return true;
  }

  if (med.scheduleType === 'weekdays') {
    const weekdays = Array.isArray(med.weekdays)
      ? med.weekdays
      : [];

    const date = new Date(`${dateISO}T00:00:00`);

    if (Number.isNaN(date.getTime())) return false;

    const weekdayCodes = [
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat'
    ];

    return weekdays.includes(weekdayCodes[date.getDay()]);
  }

  return false;
}
function getScheduledDateTime(dateISO, time) {
  return new Date(`${dateISO}T${time}:00`).toISOString();
}
function computeStatusForLog(plannedISO, actualISO, action) {
  const planned = new Date(plannedISO).getTime();
  const actual = new Date(actualISO).getTime();
  return computeTakenTemporalStatus(planned, actual, action);
}
