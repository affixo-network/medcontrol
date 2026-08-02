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
<select id="${prefix}timeHour" aria-label="${escapeHtml(tr('hours'))}">${structuredOptions(23)}</select>
        </div>
        <div>
          <span class="field-caption">${escapeHtml(tr('minutes'))}</span>
<select id="${prefix}timeMinute" aria-label="${escapeHtml(tr('minutes'))}">${structuredOptions(59)}</select>
        </div>
        <button type="button" onclick="addStructuredTime('${prefix}')">${escapeHtml(tr('add_time'))}</button>
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
            <input type="checkbox" data-prefix="${prefix}" data-weekday="${code}" ${selected.includes(code) ? 'checked' : ''} onchange="syncStructuredWeekdays('${prefix}')">
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
        <input id="${prefix}datePicker" type="date" aria-label="${escapeHtml(tr('date_label'))}">
<button type="button" onclick="addStructuredDate('${prefix}')">${escapeHtml(tr('add_date'))}</button>
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
  writeHiddenList(`${prefix}times`, readHiddenList(`${prefix}times`).filter(item => item !== value));
  renderStructuredTimes(prefix);
};

window.syncStructuredWeekdays = function(prefix) {
  const values = [...document.querySelectorAll(`input[data-prefix="${prefix}"][data-weekday]:checked`)]
    .map(input => input.dataset.weekday);
  writeHiddenList(`${prefix}weekdays`, values);
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
  writeHiddenList(`${prefix}explicitDates`, readHiddenList(`${prefix}explicitDates`).filter(item => item !== value));
  renderStructuredDates(prefix);
};

window.initializeStructuredEditors = function(prefix) {
  renderStructuredTimes(prefix);
  renderStructuredDates(prefix);
  syncStructuredWeekdays(prefix);
};

function createMedicationFromForm(prefix) {
  const name = document.getElementById(`${prefix}name`)?.value.trim() || '';
  const dose = document.getElementById(`${prefix}dose`)?.value.trim() || '';
  const details = document.getElementById(`${prefix}details`)?.value.trim() || '';
  const scheduleType = document.getElementById(`${prefix}scheduleType`)?.value || 'daily';
  const times = readHiddenList(`${prefix}times`);
  const startDate = document.getElementById(`${prefix}startDate`)?.value || '';
  const endDate = document.getElementById(`${prefix}endDate`)?.value || '';
  const active = Boolean(document.getElementById(`${prefix}active`)?.checked);
  const weekdays = scheduleType === 'weekdays' ? readHiddenList(`${prefix}weekdays`) : [];
  const explicitDates = scheduleType === 'explicit_dates' ? readHiddenList(`${prefix}explicitDates`) : [];

  if (!name) throw new Error('name');
  if (!dose) throw new Error('dose');
  if (!details) throw new Error('details');
  if (!times.length) throw new Error('times');
  if (scheduleType === 'weekdays' && !weekdays.length) throw new Error('weekdays');
  if (scheduleType === 'explicit_dates' && !explicitDates.length) throw new Error('dates');
  if (scheduleType !== 'explicit_dates' && startDate && endDate && startDate > endDate) {
    throw new Error('period');
  }

  return {
    name,
    dose,
    details,
    scheduleType,
    times: [...new Set(times)].sort(),
    startDate: scheduleType === 'explicit_dates' ? '' : startDate,
    endDate: scheduleType === 'explicit_dates' ? '' : endDate,
    active,
    weekdays: [...new Set(weekdays)],
    explicitDates: [...new Set(explicitDates)].sort()
  };
}

function showMedicationHint(code) {
 const messages = {
  name: tr('hint_name'),
  dose: tr('hint_dose'),
  details: tr('hint_details'),
  times: tr('hint_times'),
  weekdays: tr('hint_weekdays'),
  dates: tr('hint_dates'),
  period: tr('hint_period'),
  duplicate_time: tr('hint_duplicate_time'),
  duplicate_date: tr('hint_duplicate_date'),
  date_pick: tr('hint_date_pick'),
  save_failed: tr('hint_save_failed')
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
  startWrap.style.display = type === 'explicit_dates' ? 'none' : 'block';
  endWrap.style.display = type === 'explicit_dates' ? 'none' : 'block';
}

window.syncCreateScheduleFields = function() { syncScheduleFields('create_'); };
window.syncEditScheduleFields = function() { syncScheduleFields('edit_'); };

window.toggleMedicationMode = function(id) {
  const state = getState();
  const med = state.medications.find(item => item.id === id);
  if (!med) return;
  med.active = !med.active;
  recordRowHistory(med, med.active ? 'active' : 'passive', med.active ? tr('active') : tr('passive'));
  saveState(state);
  mount('input');
};

window.openEditMedication = function(id) {
  const med = getState().medications.find(item => item.id === id);
  if (!med) return;
  const dialog = document.getElementById('editDialog');
  const content = document.getElementById('editDialogContent');
  content.innerHTML = `<div class="form-grid">
    <div><label>${escapeHtml(tr('medication'))}</label><input id="edit_name" value="${escapeHtml(med.name)}"></div>
    <div><label>${escapeHtml(tr('dose'))}</label><input id="edit_dose" value="${escapeHtml(med.dose)}"></div>
    <div class="full"><label>${escapeHtml(tr('details'))}</label><textarea id="edit_details">${escapeHtml(med.details || '')}</textarea></div>
    <div><label>${escapeHtml(tr('schedule'))}</label><select id="edit_scheduleType" onchange="syncEditScheduleFields()"><option value="daily" ${med.scheduleType === 'daily' ? 'selected' : ''}>${escapeHtml(tr('every_day'))}</option><option value="weekdays" ${med.scheduleType === 'weekdays' ? 'selected' : ''}>${escapeHtml(tr('weekdays'))}</option><option value="explicit_dates" ${med.scheduleType === 'explicit_dates' ? 'selected' : ''}>${escapeHtml(tr('explicit_dates'))}</option></select></div>
    <div><label>${escapeHtml(tr('mode'))}</label><label class="active-choice"><input id="edit_active" type="checkbox" ${med.active ? 'checked' : ''}> ${escapeHtml(tr('active'))}</label></div>
    ${structuredTimeEditorHtml('edit_', med.times || [])}
    ${structuredWeekdayEditorHtml('edit_', med.weekdays || [])}
    ${structuredDateEditorHtml('edit_', med.explicitDates || [])}
    <div id="edit_start_wrap"><label>${escapeHtml(tr('start_date'))}</label><input id="edit_startDate" type="date" value="${escapeHtml(med.startDate || '')}"></div>
    <div id="edit_end_wrap"><label>${escapeHtml(tr('end_date'))}</label><input id="edit_endDate" type="date" value="${escapeHtml(med.endDate || '')}"></div>
    <div class="full right"><button onclick="saveMedicationEdit('${med.id}')">${escapeHtml(tr('save'))}</button> <button onclick="document.getElementById('editDialog').close()">${escapeHtml(tr('close'))}</button></div>
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
    Object.assign(med, createMedicationFromForm('edit_'));
    recordRowHistory(med, 'edited', medicationRuleSummary(med));
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
  document.getElementById('rowHistoryContent').innerHTML = rowHistoryHtml(med.rowHistory || []);
  document.getElementById('rowHistoryDialog').showModal();
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

    document.getElementById('medicationConfirmContent').innerHTML = `
      <table class="confirm-table">
        <tr><td>${escapeHtml(tr('medication'))}</td><td>${escapeHtml(item.name)}</td></tr>
        <tr><td>${escapeHtml(tr('dose'))}</td><td>${escapeHtml(item.dose)}</td></tr>
        <tr><td>${escapeHtml(tr('details'))}</td><td>${escapeHtml(item.details)}</td></tr>
        <tr><td>${escapeHtml(tr('schedule'))}</td><td>${escapeHtml(scheduleText)}</td></tr>
        <tr><td>${escapeHtml(tr('time_slots'))}</td><td>${escapeHtml(item.times.join(', '))}</td></tr>
        <tr><td>${escapeHtml(tr('period'))}</td><td>${escapeHtml(periodText)}</td></tr>
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
