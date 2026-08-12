function structuredOptions(max) {
  return Array.from({ length: max + 1 }, (_, value) => {
    const text = String(value).padStart(2, '0');
    return `<option value="${text}">${text}</option>`;
  }).join('');
}

function structuredTimeEditorHtml(prefix, times = []) {
  return `
    <div class="structured-editor full">
      <label>${escapeHtml(tr('time_slots'))}</label>
      <input id="${prefix}times" type="hidden" value="${escapeHtml(times.join(','))}">
      <div class="number-pickers">
        <div>
          <span class="field-caption">${escapeHtml(tr('hours'))}</span>
<select id="${prefix}timeHour" onfocus="guardMedicationSequence('${prefix}', 'scheduleType')" aria-label="${escapeHtml(tr('hours'))}">${structuredOptions(23)}</select>
        </div>
        <div>
          <span class="field-caption">${escapeHtml(tr('minutes'))}</span>
<select id="${prefix}timeMinute" onfocus="guardMedicationSequence('${prefix}', 'scheduleType')" aria-label="${escapeHtml(tr('minutes'))}">${structuredOptions(59)}</select>
        </div>
        <button
  type="button"
  onclick="
    if (guardMedicationSequence('${prefix}', 'scheduleType')) {
      addStructuredTime('${prefix}');
    }
  "
>${escapeHtml(tr('add_time'))}</button>
      </div>
      <div id="${prefix}timesList" class="choice-list"></div>
    </div>`;
}

function structuredWeekdayEditorHtml(prefix, selected = []) {
  const labels = tr('weekday_short');

  const days = [
    ['Mon', labels[0]],
    ['Tue', labels[1]],
    ['Wed', labels[2]],
    ['Thu', labels[3]],
    ['Fri', labels[4]],
    ['Sat', labels[5]],
    ['Sun', labels[6]]
  ];

  return `
    <div id="${prefix}weekdays_wrap" class="full" style="display:none">
      <label>${escapeHtml(tr('weekdays_selected'))}</label>
      <input id="${prefix}weekdays" type="hidden" value="${escapeHtml(selected.join(','))}">
      <div class="weekday-grid">
        ${days.map(([code, label]) => `
          <label class="weekday-choice">
            <input
  type="checkbox"
  data-prefix="${prefix}"
  data-weekday="${code}"
  ${selected.includes(code) ? 'checked' : ''}
  onclick="
    if (
      '${prefix}' === 'create_' &&
      !guardMedicationSequence('${prefix}', 'weekdays')
    ) {
      event.preventDefault();
      return false;
    }
  "
  onchange="syncStructuredWeekdays('${prefix}')"
>
            <span>${escapeHtml(label)}</span>
          </label>`).join('')}
      </div>
    </div>`;
}
function structuredDateEditorHtml(prefix, dates = []) {
  return `
    <div id="${prefix}dates_wrap" class="full" style="display:none">
      <label>${escapeHtml(tr('dates'))}</label>
      <input id="${prefix}explicitDates" type="hidden" value="${escapeHtml(dates.join(','))}">
      <div class="date-picker-row">
        <input
  id="${prefix}datePicker"
  type="date"
  aria-label="${escapeHtml(tr('date_label'))}"
  onfocus="
    if (
      '${prefix}' === 'create_' &&
      !guardMedicationSequence('${prefix}', 'explicitDates')
    ) {
      this.blur();
    }
  "
>

<button
  type="button"
  onclick="
    if (
      '${prefix}' !== 'create_' ||
      guardMedicationSequence('${prefix}', 'explicitDates')
    ) {
      addStructuredDate('${prefix}');
    }
  "
>
  ${escapeHtml(tr('add_date'))}
</button>
      </div>
      <div id="${prefix}datesList" class="choice-list"></div>
    </div>`;
}

function readHiddenList(id) {
  const element = document.getElementById(id);
  if (!element || !element.value.trim()) return [];
  return element.value.split(',').map(value => value.trim()).filter(Boolean);
}

function writeHiddenList(id, values) {
  const element = document.getElementById(id);
  if (element) element.value = [...new Set(values)].sort().join(',');
}

window.renderStructuredTimes = function(prefix) {
  const list = document.getElementById(`${prefix}timesList`);
  if (!list) return;
  const values = readHiddenList(`${prefix}times`);
  list.innerHTML = values.length
    ? values.map(value => `
        <div class="choice-chip">
          <strong>${escapeHtml(value)}</strong>
          <button type="button" aria-label="${escapeHtml(tr('remove'))} ${escapeHtml(value)}" onclick="removeStructuredTime('${prefix}','${escapeHtml(value)}')">${escapeHtml(tr('remove'))}</button>
        </div>`).join('')
    : `<div class="empty-choice">${escapeHtml(tr('no_time_added'))}</div>`;
};

window.addStructuredTime = function(prefix) {
  if (prefix === 'edit_' && !guardTemporalEdit('time')) return;
  const hour = document.getElementById(`${prefix}timeHour`)?.value;
  const minute = document.getElementById(`${prefix}timeMinute`)?.value;
  if (hour == null || minute == null) return;
  const value = `${hour}:${minute}`;
  const values = readHiddenList(`${prefix}times`);
  if (values.includes(value)) {
    showMedicationHint('duplicate_time');
    return;
  }
  values.push(value);
  writeHiddenList(`${prefix}times`, values);
  renderStructuredTimes(prefix);
};

window.removeStructuredTime = function(prefix, value) {
  if (prefix === 'edit_' && !guardTemporalEdit('time')) return;
  writeHiddenList(`${prefix}times`, readHiddenList(`${prefix}times`).filter(item => item !== value));
  renderStructuredTimes(prefix);
};

window.syncStructuredWeekdays = function(prefix) {
  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;
  const weekdayOrder = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun'
  ];

  const values = [
    ...document.querySelectorAll(
      `input[data-prefix="${prefix}"][data-weekday]:checked`
    )
  ]
    .map(input => input.dataset.weekday)
    .sort(
      (a, b) =>
        weekdayOrder.indexOf(a) -
        weekdayOrder.indexOf(b)
    );

  const element =
    document.getElementById(`${prefix}weekdays`);

  if (element) {
    element.value = values.join(',');
  }
};

window.renderStructuredDates = function(prefix) {
  const list = document.getElementById(`${prefix}datesList`);
  if (!list) return;
  const values = readHiddenList(`${prefix}explicitDates`);
  list.innerHTML = values.length
    ? values.map(value => `
        <div class="choice-chip">
          <strong>${escapeHtml(formatDate(value))}</strong>
         <button type="button" aria-label="${escapeHtml(tr('remove'))} ${escapeHtml(formatDate(value))}" onclick="removeStructuredDate('${prefix}','${escapeHtml(value)}')">${escapeHtml(tr('remove'))}</button>
        </div>`).join('')
    : `<div class="empty-choice">${escapeHtml(tr('no_date_added'))}</div>`;
};

window.addStructuredDate = function(prefix) {
  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;
  const picker = document.getElementById(`${prefix}datePicker`);
  if (!picker || !picker.value) {
    showMedicationHint('date_pick');
    return;
  }
  const values = readHiddenList(`${prefix}explicitDates`);
  if (values.includes(picker.value)) {
    showMedicationHint('duplicate_date');
    return;
  }
  values.push(picker.value);
  writeHiddenList(`${prefix}explicitDates`, values);
  picker.value = '';
  renderStructuredDates(prefix);
};

window.removeStructuredDate = function(prefix, value) {
  if (prefix === 'edit_' && !guardTemporalEdit('schedule')) return;
  writeHiddenList(`${prefix}explicitDates`, readHiddenList(`${prefix}explicitDates`).filter(item => item !== value));
  renderStructuredDates(prefix);
};

window.initializeStructuredEditors = function(prefix) {
  renderStructuredTimes(prefix);
  renderStructuredDates(prefix);
  syncStructuredWeekdays(prefix);
};

function medicationContentUnitLabel(unit, otherValue = '') {
  if (unit === 'other') {
    return otherValue || '—';
  }

  const labels = {
    mcg: 'мкг',
    mg: 'мг',
    g: 'г',
    kg: 'кг',
    ml: 'мл',
    l: 'л',
    '%': '%',
    'mg/ml': 'мг/мл',
    'mcg/ml': 'мкг/мл',
    'mg/g': 'мг/г',
    IU: 'МЕ',
    unit: 'ед.'
  };

  return labels[unit] || unit || '—';
}

function medicationIntakeUnitLabel(unit, otherValue = '') {
  if (unit === 'other') {
    return otherValue || '—';
  }

  const labels = {
    tablet: 'таблетка',
    capsule: 'капсула',
    ml: 'мл',
    drop: 'капля',
    teaspoon: 'чайная ложка',
    tablespoon: 'столовая ложка',
    dose: 'доза',
    puff: 'впрыск',
    ampoule: 'ампула',
    vial: 'флакон',
    packet: 'пакет',
    sachet: 'саше',
    suppository: 'суппозиторий',
    patch: 'пластырь',
    injection: 'инъекция',
    unit: 'единица'
  };

  return labels[unit] || unit || '—';
}

function createMedicationFromForm(prefix) {
  const name = document.getElementById(`${prefix}name`)?.value.trim() || '';
const manufacturer = document.getElementById(`${prefix}manufacturer`)?.value.trim() || '';

const contentValue = document.getElementById(`${prefix}contentValue`)?.value.trim() || '';
const contentValueNumber = Number(contentValue);
const contentUnit = document.getElementById(`${prefix}contentUnit`)?.value || '';
const contentUnitOther = document.getElementById(`${prefix}contentUnitOther`)?.value.trim() || '';

const intakeQuantity = document.getElementById(`${prefix}intakeQuantity`)?.value.trim() || '';
const intakeQuantityNumber = Number(intakeQuantity);
const intakeUnit = document.getElementById(`${prefix}intakeUnit`)?.value || '';
const intakeUnitOther = document.getElementById(`${prefix}intakeUnitOther`)?.value.trim() || '';

const details = document.getElementById(`${prefix}details`)?.value.trim() || '';
  const scheduleType = document.getElementById(`${prefix}scheduleType`)?.value || 'daily';
  const times = readHiddenList(`${prefix}times`);
  const startDate = document.getElementById(`${prefix}startDate`)?.value || '';
  const endDate = document.getElementById(`${prefix}endDate`)?.value || '';
  const active = Boolean(document.getElementById(`${prefix}active`)?.checked);
  const weekdays = scheduleType === 'weekdays' ? readHiddenList(`${prefix}weekdays`) : [];
  const explicitDates = scheduleType === 'explicit_dates' ? readHiddenList(`${prefix}explicitDates`) : [];

  if (!name) throw new Error('name');

if (
  !contentValue ||
  !Number.isFinite(contentValueNumber) ||
  contentValueNumber < 0
) {
  throw new Error('contentValue');
}
if (!contentUnit) throw new Error('contentUnit');
if (contentUnit === 'other' && !contentUnitOther) {
  throw new Error('contentUnitOther');
}

if (
  !intakeQuantity ||
  !Number.isFinite(intakeQuantityNumber) ||
  intakeQuantityNumber < 0
) {
  throw new Error('intakeQuantity');
}

if (!intakeUnit) {
  throw new Error('intakeUnit');
}

if (intakeUnit === 'other' && !intakeUnitOther) {
  throw new Error('intakeUnitOther');
}

if (!details) throw new Error('details');
if (!times.length) throw new Error('times');

if (scheduleType === 'daily') {
  if (!startDate) {
    throw new Error('startDate');
  }

  if (!endDate) {
    throw new Error('endDate');
  }

  if (startDate > endDate) {
    throw new Error('period');
  }
}

if (scheduleType === 'weekdays') {
  if (!weekdays.length) throw new Error('weekdays');
  if (!endDate) throw new Error('endDate');
}

if (scheduleType === 'explicit_dates' && !explicitDates.length) {
  throw new Error('dates');
}

 

const resolvedIntakeUnit =
  intakeUnit === 'other'
    ? intakeUnitOther
    : intakeUnit;

const dose =
  `${intakeQuantity} ${resolvedIntakeUnit}`;

return {
  name,
  manufacturer,

  contentValue,
  contentUnit,
  contentUnitOther,

  intakeQuantity,
  intakeUnit,
  intakeUnitOther,

  dose,
  details,
  scheduleType,

  times: [...new Set(times)].sort(),

  startDate:
    scheduleType === 'daily'
      ? startDate
      : '',

  endDate:
    scheduleType === 'explicit_dates'
      ? ''
      : endDate,

  active,

  weekdays:
    scheduleType === 'weekdays'
      ? [...new Set(weekdays)]
      : [],

  explicitDates:
    scheduleType === 'explicit_dates'
      ? [...new Set(explicitDates)].sort()
      : []
};}

function showMedicationHint(code) {
 const messages = {
  name: tr('hint_name'),
   
  contentValue: 'Введите количественное содержание препарата.',
contentUnit: 'Выберите единицу содержания.',
contentUnitOther: 'Укажите другую единицу содержания.',
intakeQuantity: 'Введите количество приёма.',
intakeUnit: 'Выберите единицу приёма.',
intakeUnitOther: 'Укажите другую единицу приёма.',

startDate: 'Дата начала не заполнена.',
endDate: 'Дата окончания не заполнена.',
  details: tr('hint_details'),
   schedule: 'Выберите режим расписания.',
  times: tr('hint_times'),
  weekdays: tr('hint_weekdays'),
  dates: tr('hint_dates'),
  period: tr('hint_period'),
  duplicate_time: tr('hint_duplicate_time'),
  duplicate_date: tr('hint_duplicate_date'),
  date_pick: tr('hint_date_pick'),
  save_failed: tr('hint_save_failed'),
  temporal_schedule_locked: 'Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».',
  temporal_time_locked: 'Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».'
};
 alert(`${tr('hint_title')}\n\n${messages[code] || messages.save_failed}`);
}

function syncScheduleFields(prefix) {
  const type = document.getElementById(`${prefix}scheduleType`)?.value;
  const weekdaysWrap = document.getElementById(`${prefix}weekdays_wrap`);
  const datesWrap = document.getElementById(`${prefix}dates_wrap`);
  const startWrap = document.getElementById(`${prefix}start_wrap`);
  const endWrap = document.getElementById(`${prefix}end_wrap`);
  if (!type || !weekdaysWrap || !datesWrap || !startWrap || !endWrap) return;
  weekdaysWrap.style.display = type === 'weekdays' ? 'block' : 'none';
  datesWrap.style.display = type === 'explicit_dates' ? 'block' : 'none';
  startWrap.style.display =
  type === 'daily'
    ? 'block'
    : 'none';

endWrap.style.display =
  type === 'explicit_dates'
    ? 'none'
    : 'block';
}

window.syncCreateScheduleFields = function() { syncScheduleFields('create_'); };
window.changeCreateScheduleType = function(select) {
  const previousValue =
    select.dataset.previousValue || 'daily';

  const details =
    document
      .getElementById('create_details')
      ?.value
      ?.trim() || '';

  if (!details) {
    select.value = previousValue;
    window.syncCreateScheduleFields();

    showMedicationHint('details');

    window.setTimeout(() => {
      document
        .getElementById('create_details')
        ?.focus();
    }, 0);

    return;
  }

  select.dataset.previousValue = select.value;
  window.syncCreateScheduleFields();
};
window.syncEditScheduleFields = function() { syncScheduleFields('edit_'); };
window.changeEditScheduleType = function(select) {
  const previous = select.dataset.previousValue || select.value;
  if (!guardTemporalEdit('schedule')) {
    select.value = previous;
    syncEditScheduleFields();
    return;
  }
  select.dataset.previousValue = select.value;
  syncEditScheduleFields();
};
window.syncMedicationOtherUnit = function(prefix, type) {
  const select = document.getElementById(`${prefix}${type}Unit`);
  const wrap = document.getElementById(`${prefix}${type}UnitOther_wrap`);
  const input = document.getElementById(`${prefix}${type}UnitOther`);

  if (!select || !wrap) return;

  const isOther = select.value === 'other';

  wrap.style.display = isOther
    ? 'block'
    : 'none';

  if (!isOther && input) {
    input.value = '';
  }
};

let medicationSequenceGuardActive = false;

window.guardMedicationSequence = function(prefix, targetKey) {
  if (medicationSequenceGuardActive) {
    return true;
  }

  const valueOf = id =>
    document.getElementById(`${prefix}${id}`)?.value?.trim() || '';

  const contentUnit = valueOf('contentUnit');
  const intakeUnit = valueOf('intakeUnit');
  const scheduleType =
  valueOf('scheduleType') || 'daily';

  const times = readHiddenList(`${prefix}times`);
  const weekdays = readHiddenList(`${prefix}weekdays`);
  const explicitDates =
  readHiddenList(`${prefix}explicitDates`);
  
  const sequence = [
    {
      key: 'name',
      code: 'name',
      elementId: 'name',
      valid: () => Boolean(valueOf('name'))
    },
    {
      key: 'contentValue',
      code: 'contentValue',
      elementId: 'contentValue',
      valid: () => Boolean(valueOf('contentValue'))
    },
    {
      key: 'contentUnit',
      code: 'contentUnit',
      elementId: 'contentUnit',
      valid: () => Boolean(contentUnit)
    },
    {
      key: 'contentUnitOther',
      code: 'contentUnitOther',
      elementId: 'contentUnitOther',
      valid: () =>
        contentUnit !== 'other' ||
        Boolean(valueOf('contentUnitOther'))
    },
    {
      key: 'intakeQuantity',
      code: 'intakeQuantity',
      elementId: 'intakeQuantity',
      valid: () => Boolean(valueOf('intakeQuantity'))
    },
    {
      key: 'intakeUnit',
      code: 'intakeUnit',
      elementId: 'intakeUnit',
      valid: () => Boolean(intakeUnit)
    },
    {
      key: 'intakeUnitOther',
      code: 'intakeUnitOther',
      elementId: 'intakeUnitOther',
      valid: () =>
        intakeUnit !== 'other' ||
        Boolean(valueOf('intakeUnitOther'))
    },
    {
      key: 'details',
      code: 'details',
      elementId: 'details',
      valid: () => Boolean(valueOf('details'))
    },
    {
  key: 'scheduleType',
  code: 'schedule',
  elementId: 'scheduleType',
  valid: () => Boolean(valueOf('scheduleType'))
},
{
  key: 'times',
  code: 'times',
  elementId: 'timeHour',
  valid: () => times.length > 0
},
{
  key: 'weekdays',
  code: 'weekdays',
  elementId: 'weekdays_wrap',
  valid: () =>
    scheduleType !== 'weekdays' ||
    weekdays.length > 0
},
{
  key: 'explicitDates',
  code: 'dates',
  elementId: 'datePicker',
  valid: () =>
    scheduleType !== 'explicit_dates' ||
    explicitDates.length > 0
},
{
  key: 'startDate',
  code: 'startDate',
  elementId: 'startDate',
  valid: () =>
    scheduleType !== 'daily' ||
    Boolean(valueOf('startDate'))
},
{
  key: 'endDate',
  code: 'endDate',
  elementId: 'endDate',
  valid: () =>
    scheduleType === 'explicit_dates' ||
    Boolean(valueOf('endDate'))
},
{
  key: 'submit',
  code: 'save_failed',
  elementId: 'name',
  valid: () => true
}
  ];

  const targetIndex = sequence.findIndex(
    item => item.key === targetKey
  );

  if (targetIndex < 0) {
    return true;
  }

  for (let index = 0; index < targetIndex; index += 1) {
    const item = sequence[index];

    if (item.valid()) {
      continue;
    }

    medicationSequenceGuardActive = true;

    showMedicationHint(item.code);

    window.setTimeout(() => {
      document
        .getElementById(`${prefix}${item.elementId}`)
        ?.focus();

      medicationSequenceGuardActive = false;
    }, 0);

    return false;
  }

  return true;
};

window.toggleMedicationMode = function(id) {
  const state = getState();
  const med = state.medications.find(item => item.id === id);

  if (!med) return;
  if (med.cancelled) return;

  med.active = !Boolean(med.active);

  recordRowHistory(
    med,
    'edited',
    med.active
      ? 'Статус препарата изменён на «Активно».'
      : 'Статус препарата изменён на «Пассивно».'
  );

  saveState(state);
  mount('input');
};
window.startMedicationCancellation = function(id) {
  const state = getState();
  const med = state.medications.find(item => item.id === id);

  if (!med) return;
  if (med.cancelled) return;

  const scheduleText =
    med.scheduleType === 'daily'
      ? 'Каждый день'
      : med.scheduleType === 'weekdays'
        ? 'Дни недели'
        : 'Даты';

  const firstConfirm = window.confirm(
    `Вы собираетесь отменить приём препарата «${med.name}».\n\n` +
    `Текущее расписание: ${scheduleText}.\n\n` +
    `Важно: «Отменено» отличается от статуса «Пассивно».\n` +
    `Пассивно — временная остановка с возможностью продолжения.\n` +
    `Отменено — окончательное завершение этой карточки препарата.\n\n` +
    `Продолжить?`
  );

  if (!firstConfirm) return;

  const datesText =
    med.scheduleType === 'explicit_dates'
      ? (med.explicitDates || [])
          .map(date => formatDate(date))
          .join(', ')
      : `${formatDate(med.startDate)} → ${formatDate(med.endDate)}`;

  const secondConfirm = window.confirm(
    `Подтвердите прекращение действия дат приёма.\n\n` +
    `Текущий период / даты:\n${datesText || '—'}\n\n` +
    `После отмены эта карточка больше не будет использоваться ` +
    `для дальнейшего приёма.\n\n` +
    `Продолжить?`
  );

  if (!secondConfirm) return;

  const thirdConfirm = window.confirm(
    `ФИНАЛЬНОЕ ПОДТВЕРЖДЕНИЕ\n\n` +
    `Препарат: ${med.name}\n` +
    `Статус будет установлен: Отменено\n\n` +
    `Все ранее введённые данные и история сохранятся,\n` +
    `но эта карточка будет окончательно закрыта.\n\n` +
    `Если в будущем вы снова начнёте принимать этот препарат,\n` +
    `необходимо будет создать новую карточку и новую историю.\n\n` +
    `Подтвердить отмену?`
  );

  if (!thirdConfirm) return;

  window.cancelMedication(id);
};
window.cancelMedication = function(id) {
  const state = getState();
  const med = state.medications.find(item => item.id === id);

  if (!med) return;
  if (med.cancelled) return;

  med.cancelled = true;
  med.active = false;

  recordRowHistory(
    med,
    'cancelled',
    'Приём препарата отменён.'
  );

  saveState(state);
  mount('input');
};
window.openEditMedication = function(id) {
  window.__editingMedicationId = id;
  const med = getState().medications.find(item => item.id === id);
  if (!med) return;
  if (med.cancelled) return;
  const dialog = document.getElementById('editDialog');
  const content = document.getElementById('editDialogContent');
  content.innerHTML = `<div class="form-grid">
    <div>
  <label>${escapeHtml(tr('medication'))} *</label>
  <input
    id="edit_name"
    value="${escapeHtml(med.name || '')}"
    required
  >
</div>

<div>
  <label>Производитель</label>
  <input
    id="edit_manufacturer"
    value="${escapeHtml(med.manufacturer || '')}"
  >
</div>

<div class="full">
  <h3>Данные производителя</h3>
</div>

<div>
  <label>Количественное содержание *</label>
  <input
    id="edit_contentValue"
    type="number"
    min="0"
    step="any"
    value="${escapeHtml(med.contentValue || '')}"
    required
  >
</div>

<div>
  <label>Единица содержания *</label>
  <select
    id="edit_contentUnit"
    onchange="syncMedicationOtherUnit('edit_', 'content')"
    required
  >
    <option value="">Выберите</option>
    <option value="mcg" ${med.contentUnit === 'mcg' ? 'selected' : ''}>мкг</option>
    <option value="mg" ${med.contentUnit === 'mg' ? 'selected' : ''}>мг</option>
    <option value="g" ${med.contentUnit === 'g' ? 'selected' : ''}>г</option>
    <option value="kg" ${med.contentUnit === 'kg' ? 'selected' : ''}>кг</option>
    <option value="ml" ${med.contentUnit === 'ml' ? 'selected' : ''}>мл</option>
    <option value="l" ${med.contentUnit === 'l' ? 'selected' : ''}>л</option>
    <option value="%" ${med.contentUnit === '%' ? 'selected' : ''}>%</option>
    <option value="mg/ml" ${med.contentUnit === 'mg/ml' ? 'selected' : ''}>мг/мл</option>
    <option value="mcg/ml" ${med.contentUnit === 'mcg/ml' ? 'selected' : ''}>мкг/мл</option>
    <option value="mg/g" ${med.contentUnit === 'mg/g' ? 'selected' : ''}>мг/г</option>
    <option value="IU" ${med.contentUnit === 'IU' ? 'selected' : ''}>МЕ</option>
    <option value="unit" ${med.contentUnit === 'unit' ? 'selected' : ''}>ед.</option>
    <option value="other" ${med.contentUnit === 'other' ? 'selected' : ''}>Другое</option>
  </select>
</div>

<div
  id="edit_contentUnitOther_wrap"
  style="display:${med.contentUnit === 'other' ? 'block' : 'none'}"
>
  <label>Другая единица содержания *</label>
  <input
    id="edit_contentUnitOther"
    value="${escapeHtml(med.contentUnitOther || '')}"
  >
</div>

<div class="full">
  <h3>Доза</h3>
</div>

<div>
  <label>Единица приёма *</label>
  <select
    id="edit_intakeUnit"
    onchange="syncMedicationOtherUnit('edit_', 'intake')"
    required
  >
    <option value="">Выберите</option>
    <option value="tablet" ${med.intakeUnit === 'tablet' ? 'selected' : ''}>таблетка</option>
    <option value="capsule" ${med.intakeUnit === 'capsule' ? 'selected' : ''}>капсула</option>
    <option value="ml" ${med.intakeUnit === 'ml' ? 'selected' : ''}>мл</option>
    <option value="drop" ${med.intakeUnit === 'drop' ? 'selected' : ''}>капля</option>
    <option value="teaspoon" ${med.intakeUnit === 'teaspoon' ? 'selected' : ''}>чайная ложка</option>
    <option value="tablespoon" ${med.intakeUnit === 'tablespoon' ? 'selected' : ''}>столовая ложка</option>
    <option value="dose" ${med.intakeUnit === 'dose' ? 'selected' : ''}>доза</option>
    <option value="puff" ${med.intakeUnit === 'puff' ? 'selected' : ''}>впрыск</option>
    <option value="ampoule" ${med.intakeUnit === 'ampoule' ? 'selected' : ''}>ампула</option>
    <option value="vial" ${med.intakeUnit === 'vial' ? 'selected' : ''}>флакон</option>
    <option value="packet" ${med.intakeUnit === 'packet' ? 'selected' : ''}>пакет</option>
    <option value="sachet" ${med.intakeUnit === 'sachet' ? 'selected' : ''}>саше</option>
    <option value="suppository" ${med.intakeUnit === 'suppository' ? 'selected' : ''}>суппозиторий</option>
    <option value="patch" ${med.intakeUnit === 'patch' ? 'selected' : ''}>пластырь</option>
    <option value="injection" ${med.intakeUnit === 'injection' ? 'selected' : ''}>инъекция</option>
    <option value="unit" ${med.intakeUnit === 'unit' ? 'selected' : ''}>единица</option>
    <option value="other" ${med.intakeUnit === 'other' ? 'selected' : ''}>Другое</option>
  </select>
</div>

<div>
  <label>Количество приёма *</label>
  <input
    id="edit_intakeQuantity"
    type="number"
    min="0"
    step="any"
    value="${escapeHtml(med.intakeQuantity || '')}"
    required
  >
</div>

<div
  id="edit_intakeUnitOther_wrap"
  style="display:${med.intakeUnit === 'other' ? 'block' : 'none'}"
>
  <label>Другая единица приёма *</label>
  <input
    id="edit_intakeUnitOther"
    value="${escapeHtml(med.intakeUnitOther || '')}"
  >
</div>

<div class="full">
  <label>${escapeHtml(tr('details'))} *</label>
  <textarea id="edit_details" required>${escapeHtml(med.details || '')}</textarea>
</div>
    <div><label>${escapeHtml(tr('schedule'))}</label><select id="edit_scheduleType" data-previous-value="${escapeHtml(med.scheduleType || 'daily')}" onfocus="guardTemporalEdit('schedule')" onchange="changeEditScheduleType(this)"><option value="daily" ${med.scheduleType === 'daily' ? 'selected' : ''}>${escapeHtml(tr('every_day'))}</option><option value="weekdays" ${med.scheduleType === 'weekdays' ? 'selected' : ''}>${escapeHtml(tr('weekdays'))}</option><option value="explicit_dates" ${med.scheduleType === 'explicit_dates' ? 'selected' : ''}>${escapeHtml(tr('explicit_dates'))}</option></select></div>
    
    ${structuredTimeEditorHtml('edit_', med.times || [])}
    ${structuredWeekdayEditorHtml('edit_', med.weekdays || [])}
    ${structuredDateEditorHtml('edit_', med.explicitDates || [])}
    <div id="edit_start_wrap"><label>${escapeHtml(tr('start_date'))} *</label><input id="edit_startDate" type="date" onfocus="if(!guardTemporalEdit('schedule')) this.blur()" value="${escapeHtml(med.startDate || '')}"></div>
    <div id="edit_end_wrap"><label>${escapeHtml(tr('end_date'))} *</label><input id="edit_endDate" type="date" onfocus="if(!guardTemporalEdit('schedule')) this.blur()" value="${escapeHtml(med.endDate || '')}"></div>
    <div class="full right">
  <button onclick="saveMedicationEdit('${med.id}')">
    ${escapeHtml(tr('save'))}
  </button>
  <button onclick="document.getElementById('editDialog').close()">
    ${escapeHtml(tr('close'))}
  </button>
</div>
  </div>`;
  dialog.showModal();
  initializeStructuredEditors('edit_');
  syncEditScheduleFields();
};

window.saveMedicationEdit = function(id) {
  try {
    const state = getState();
    const med = state.medications.find(item => item.id === id);

    if (!med) return;
    if (med.cancelled) return;

    const currentActive = Boolean(med.active);
    const previousSnapshot = medicationHistorySnapshot(med);

    const updatedMedication =
      createMedicationFromForm('edit_');

    updatedMedication.active = currentActive;

    validateTemporalEditAuthorization(med, updatedMedication);
    Object.assign(med, updatedMedication);
    completeTemporalEdit(med, previousSnapshot, updatedMedication);

    recordRowHistory(
      med,
      'edited',
      medicationRuleSummary(med),
      previousSnapshot
    );

    saveState(state);
    document.getElementById('editDialog').close();
    mount('input');
  } catch (error) {
  showMedicationHint(error.message);
}
};
window.showRowHistory = function(id) {
  const med = getState().medications.find(item => item.id === id);
  if (!med) return;

  const dialog =
    document.getElementById('rowHistoryDialog');

  const title =
    dialog?.querySelector('h2');

  if (title) {
    title.textContent =
      `Журнал изменений показателей препарата «${med.name}»`;
  }

  document.getElementById('rowHistoryContent').innerHTML =
    rowHistoryHtml(med.rowHistory || []);

  dialog?.showModal();
};

let pendingMedicationCreate = null;

window.createMedication = function() {
  try {
    const state = getState();
    const item = {
      id: uid(),
      order: state.medications.length ? Math.max(...state.medications.map(item => item.order || 0)) + 1 : 1,
      ...createMedicationFromForm('create_'),
      rowHistory: []
    };
    pendingMedicationCreate = { state, item };

    const weekdayLabels = {
  Mon: tr('weekday_short')[0],
  Tue: tr('weekday_short')[1],
  Wed: tr('weekday_short')[2],
  Thu: tr('weekday_short')[3],
  Fri: tr('weekday_short')[4],
  Sat: tr('weekday_short')[5],
  Sun: tr('weekday_short')[6]
};

const scheduleText = item.scheduleType === 'daily'
  ? tr('every_day')
  : item.scheduleType === 'weekdays'
    ? `${tr('weekdays')}: ${item.weekdays.map(day => weekdayLabels[day] || day).join(', ')}`
    : `${tr('dates')}: ${item.explicitDates.map(formatDate).join(', ')}`;

const periodText = item.scheduleType === 'explicit_dates'
  ? tr('explicit_dates')
  : `${formatDate(item.startDate)} → ${formatDate(item.endDate)}`;

    const contentUnitText =
  medicationContentUnitLabel(
    item.contentUnit,
    item.contentUnitOther
  );

const intakeUnitText =
  medicationIntakeUnitLabel(
    item.intakeUnit,
    item.intakeUnitOther
  );

document.getElementById('medicationConfirmContent').innerHTML = `
  <table class="confirm-table">
    <tr>
      <td>${escapeHtml(tr('medication'))}</td>
      <td>${escapeHtml(item.name)}</td>
    </tr>
    <tr>
      <td>Производитель</td>
      <td>${escapeHtml(item.manufacturer || '—')}</td>
    </tr>
    <tr>
      <td>Количественное содержание</td>
      <td>${escapeHtml(item.contentValue)} ${escapeHtml(contentUnitText)}</td>
    </tr>
    <tr>
      <td>Доза</td>
      <td>${escapeHtml(item.intakeQuantity)} ${escapeHtml(intakeUnitText)}</td>
    </tr>
    <tr>
      <td>${escapeHtml(tr('details'))}</td>
      <td>${escapeHtml(item.details)}</td>
    </tr>
    <tr>
      <td>${escapeHtml(tr('schedule'))}</td>
      <td>${escapeHtml(scheduleText)}</td>
    </tr>
    <tr>
      <td>${escapeHtml(tr('time_slots'))}</td>
      <td>${escapeHtml(item.times.join(', '))}</td>
    </tr>
    <tr>
      <td>${escapeHtml(tr('period'))}</td>
      <td>${escapeHtml(periodText)}</td>
    </tr>
  </table>`;
    document.getElementById('medicationConfirmDialog').showModal();
  } catch (error) {
    showMedicationHint(error.message);
  }
};

window.cancelMedicationCreate = function() {
  document.getElementById('medicationConfirmDialog')?.close();
  pendingMedicationCreate = null;
};

window.confirmMedicationCreate = function() {
  if (!pendingMedicationCreate) return;
  const { state, item } = pendingMedicationCreate;
  recordRowHistory(item, 'created', medicationRuleSummary(item));
  state.medications.push(item);
  saveState(state);
  pendingMedicationCreate = null;
  document.getElementById('medicationConfirmDialog')?.close();
  mount('input');
};
window.startMedControlReset = function() {
  const state = getState();

  const activeMedications =
    state.medications.filter(med => !med.cancelled);

  const cancelledMedications =
    state.medications.filter(med => med.cancelled);

  if (activeMedications.length > 0) {
    alert(
      'Сброс невозможен, пока существуют действующие препараты.'
    );
    return;
  }

  if (cancelledMedications.length === 0) {
    alert('Нет данных для сброса.');
    return;
  }

  const confirmed = confirm(
    'Сброс полностью удалит архив отменённых препаратов, историю изменений и журнал приёмов. Продолжить?'
  );

  if (!confirmed) return;

  resetMedControlData();
};

function resetMedControlData() {
  const freshState = makeDefaultState();

  saveState(freshState);

  mount('input');
}
