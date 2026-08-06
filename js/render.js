function appShell(title, activePage, body) {
  const tz = escapeHtml(getState().settings.timezone);
  return `<!doctype html><html lang="${escapeHtml(getState().settings.interfaceLanguage)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>${escapeHtml(title)}</title><style>
    :root{--fg:#111827;--muted:#6b7280;--bd:#e5e7eb;--bg:#f8fafc;--card:#ffffff;--soft:#f3f4f6;--ok:#ecfdf5;--warn:#fff7ed;--bad:#fef2f2}
    *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--fg);line-height:1.45}
    .wrap{max-width:1380px;margin:0 auto;padding:20px 16px 48px}.topbar,.card{background:var(--card);border:1px solid var(--bd);border-radius:16px}
    .topbar{padding:14px;margin-bottom:16px}.nav{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.nav a,.nav button{display:inline-flex;align-items:center;gap:6px;text-decoration:none;padding:10px 14px;border-radius:12px;border:1px solid var(--bd);background:#fff;color:var(--fg);cursor:pointer;font:inherit}
    .nav .active{border-color:#111827;background:#111827;color:#fff}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid var(--bd);background:#fff;font-size:12px}
    .card{padding:18px;margin-bottom:16px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .muted{color:var(--muted)} h1,h2,h3{margin:0 0 12px} p{margin:0 0 12px} ul{margin:8px 0 0 18px;padding:0} li{margin:6px 0}
    table{width:100%;border-collapse:collapse} th,td{padding:10px 8px;border-bottom:1px solid var(--bd);text-align:left;vertical-align:top} th{font-size:13px;background:#fafafa}
    .status{display:inline-flex;padding:4px 10px;border-radius:999px;border:1px solid var(--bd);font-size:12px}.expected{background:var(--warn)}.upcoming{background:#eff6ff}.overdue{background:var(--bad)}.success{background:var(--ok)}
    label{display:block;font-weight:bold;margin-bottom:6px} input,select,textarea,button{font:inherit} input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:#fff}
    textarea{min-height:88px;resize:vertical}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.full{grid-column:1 / -1}.inline{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.slot{padding:10px;border:1px solid var(--bd);border-radius:12px;background:#fff;margin-bottom:10px}
    dialog{border:1px solid var(--bd);border-radius:16px;padding:18px;max-width:820px;width:calc(100% - 24px)} dialog::backdrop{background:rgba(0,0,0,.3)} .right{text-align:right}
    .small{font-size:12px}.mono{font-family:ui-monospace,Consolas,monospace}.help{padding:12px;border-radius:12px;background:#fafafa;border:1px solid var(--bd)}
    .structured-editor{padding:14px;border:1px solid var(--bd);border-radius:14px;background:#fafafa}.number-pickers,.date-picker-row{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.number-pickers>div{min-width:120px}.number-pickers select{min-width:110px}.field-caption{display:block;font-weight:bold;margin-bottom:6px}.choice-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.choice-chip{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--bd);border-radius:12px;background:#fff}.choice-chip button{padding:5px 9px}.empty-choice{color:var(--muted);padding:8px 0}.weekday-grid{display:grid;grid-template-columns:repeat(7,minmax(62px,1fr));gap:8px}.weekday-choice{margin:0;padding:10px;border:1px solid var(--bd);border-radius:12px;background:#fff;text-align:center;cursor:pointer}.weekday-choice input{width:auto;margin-right:6px}.active-choice input{width:auto}.date-picker-row input{max-width:280px}.confirm-table td:first-child{width:170px;font-weight:600;color:#444}.confirm-table tr:not(:last-child){border-bottom:1px solid #ececec}.dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap}
    @media(max-width:960px){.grid2,.grid3,.form-grid{grid-template-columns:1fr}}
  </style></head><body><div class="wrap">
    <section class="topbar"><div class="nav">
      <a class="${activePage==='input'?'active':''}" href="input.html">${escapeHtml(tr('nav_input'))}</a>
     <a class="${activePage==='action'?'active':''}" href="action.html">${escapeHtml(tr('nav_action'))}</a>
      <a class="${activePage==='dashboard'?'active':''}" href="dashboard.html">${escapeHtml(tr('nav_dashboard'))}</a>
     
    </div>
    <div class="meta">
      <span class="pill">${escapeHtml(tr('current_date'))}: <strong id="topCurrentDate"></strong></span>
      <span class="pill">${escapeHtml(tr('current_time'))}: <strong id="topCurrentTime"></strong></span>
      <span class="pill">${escapeHtml(tr('timezone'))}: <strong class="mono">${tz}</strong></span>
      <span class="pill">
  ${escapeHtml(tr('language'))}:
  <select onchange="changeInterfaceLanguage(this.value)" style="width:auto;padding:4px 8px;">
  

  ${SUPPORTED_LANGUAGES
    .filter(([id]) => !!TRANSLATIONS[id])
    .map(([id, label]) => `
      <option
        value="${id}"
        ${getState().settings.interfaceLanguage === id ? 'selected' : ''}
      >
        ${escapeHtml(label)}
      </option>
    `)
    .join('')}
</select>
</span>
    </div></section>
    ${body}
  </div></body></html>`;
}
function renderDashboardPage() {
  const entries = buildTodayEntries().filter(item => !item.log);
  const rows = entries.map(item => {
    const label = item.boardState === 'expected' ? tr('expected_at') : item.boardState === 'upcoming' ? tr('upcoming_at') : tr('overdue_at');
    return `<tr><td>${item.medication.order}</td><td>${escapeHtml(item.medication.name)}</td><td>${escapeHtml(item.medication.dose)}</td><td>${escapeHtml(medicationRuleSummary(item.medication))}</td><td><span class="${statusClass(item.boardState)}">${escapeHtml(label)} — ${escapeHtml(item.plannedTime)}</span></td></tr>`;
  }).join('');
  const body = `
    <section class="card"><h1>${escapeHtml(tr('title_dashboard'))}</h1><p>${escapeHtml(tr('dashboard_intro'))}</p></section>
    <section class="card"><h2>${escapeHtml(tr('dashboard_title_1'))}</h2><table><thead><tr><th>${escapeHtml(tr('row'))}</th><th>${escapeHtml(tr('medication'))}</th><th>${escapeHtml(tr('dose'))}</th><th>${escapeHtml(tr('schedule_rule'))}</th><th>${escapeHtml(tr('state'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${escapeHtml(tr('no_items'))}</td></tr>`}</tbody></table></section>`;
  document.body.innerHTML = appShell(tr('title_dashboard'), 'dashboard', body);
  scheduleClock();
}
function renderActionPage() {
  const entries = buildTodayEntries();
  const rows = entries.map(item => {
    const log = item.log;
    const actionButtons = !log
      ? `<button onclick="markTaken('${item.medication.id}','${item.plannedAt}')">${escapeHtml(tr('take'))}</button> <button onclick="markCancelled('${item.medication.id}','${item.plannedAt}')">${escapeHtml(tr('cancel'))}</button>`
      : `<button onclick="openCorrection('${item.medication.id}','${item.plannedAt}')">${escapeHtml(tr('correct'))}</button> <button onclick="showIntakeHistory('${item.medication.id}')">${escapeHtml(tr('history'))}</button>`;
    return `<tr><td>${item.medication.order}</td><td>${escapeHtml(item.medication.name)}</td><td>${escapeHtml(item.medication.dose)}</td><td>${escapeHtml(item.plannedTime)}</td><td><span class="${statusClass(item.displayStatus)}">${escapeHtml(statusLabel(item.displayStatus))}</span></td><td>${log ? escapeHtml(formatDateTime(log.actualAt)) : '—'}</td><td>${actionButtons}</td><td><button onclick="showIntakeHistory('${item.medication.id}')">${escapeHtml(tr('history'))}</button></td></tr>`;
  }).join('');
  const body = `
    <section class="card"><h1>${escapeHtml(tr('title_action'))}</h1><p>${escapeHtml(tr('action_intro'))}</p></section>
    <section class="card"><h2>${escapeHtml(tr('action_title_1'))}</h2><table><thead><tr><th>${escapeHtml(tr('row'))}</th><th>${escapeHtml(tr('medication'))}</th><th>${escapeHtml(tr('dose'))}</th><th>${escapeHtml(tr('planned_time'))}</th><th>${escapeHtml(tr('status'))}</th><th>${escapeHtml(tr('actual_time'))}</th><th>${escapeHtml(tr('actions'))}</th><th>${escapeHtml(tr('history'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="8">${escapeHtml(tr('no_items'))}</td></tr>`}</tbody></table></section>
    <dialog id="intakeHistoryDialog"><h2>${escapeHtml(tr('history_title'))}</h2><div class="inline" style="margin-bottom:12px"><label>${escapeHtml(tr('history_period'))}</label><select id="historyPeriodSelect" onchange="refreshIntakeHistory()"><option value="today">${escapeHtml(tr('period_today'))}</option><option value="7">${escapeHtml(tr('period_7'))}</option><option value="30">${escapeHtml(tr('period_30'))}</option><option value="all">${escapeHtml(tr('period_all'))}</option></select></div><div id="intakeHistoryContent"></div><div class="right" style="margin-top:14px"><button onclick="document.getElementById('intakeHistoryDialog').close()">${escapeHtml(tr('close'))}</button></div></dialog>
    <dialog id="correctionDialog"><h2>${escapeHtml(tr('correct'))}</h2><div id="correctionContent"></div></dialog>`;
  document.body.innerHTML = appShell(tr('title_action'), 'action', body);
  scheduleClock();
}
function renderInputPage() {
  const state = getState();
  const rows = state.medications
  .slice()
  .sort((a, b) => a.order - b.order)
  .map(med => {
    const contentUnitText =
      medicationContentUnitLabel(
        med.contentUnit,
        med.contentUnitOther
      );

    const intakeUnitText =
      medicationIntakeUnitLabel(
        med.intakeUnit,
        med.intakeUnitOther
      );

    const weekdayLabels = {
  Mon: tr('weekday_short')[0],
  Tue: tr('weekday_short')[1],
  Wed: tr('weekday_short')[2],
  Thu: tr('weekday_short')[3],
  Fri: tr('weekday_short')[4],
  Sat: tr('weekday_short')[5],
  Sun: tr('weekday_short')[6]
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
   const normalizedScheduleType =
  med.scheduleType ||
  (
    (med.explicitDates || []).length
      ? 'explicit_dates'
      : (med.weekdays || []).length
        ? 'weekdays'
        : 'daily'
  );
    const scheduleText =
  normalizedScheduleType === 'daily'
    ? tr('every_day')
    : normalizedScheduleType === 'weekdays'
      ? tr('weekdays')
      : tr('explicit_dates');

const scheduleParametersText =
  normalizedScheduleType === 'daily'
    ? 'Ежедневно'
    : normalizedScheduleType === 'weekdays'
      ? (med.weekdays || [])
  .slice()
  .sort(
    (a, b) =>
      weekdayOrder.indexOf(a) -
      weekdayOrder.indexOf(b)
  )
  .map(day => weekdayLabels[day] || day)
  .join(', ') || '—'
      : normalizedScheduleType === 'explicit_dates'
        ? (med.explicitDates || [])
            .map(date => formatDate(date))
            .join(', ') || '—'
        : '—';

    return `
      <tr>
        <td>${med.order}</td>

        <td>${escapeHtml(med.name || '—')}</td>

        <td>${escapeHtml(med.manufacturer || '—')}</td>

        <td>${escapeHtml(med.contentValue || '—')}</td>

        <td>${escapeHtml(contentUnitText)}</td>

        <td>${escapeHtml(med.intakeQuantity || '—')}</td>

        <td>${escapeHtml(intakeUnitText)}</td>

       <td>${escapeHtml(med.details || '—')}</td>

<td>${escapeHtml(scheduleText)}</td>

<td>${escapeHtml(scheduleParametersText)}</td>

<td>
  ${escapeHtml((med.times || []).join(', ') || '—')}
</td>

<td>
  ${
    normalizedScheduleType === 'daily'
      ? escapeHtml(formatDate(med.startDate))
      : '—'
  }
</td>
        <td>
          ${
            normalizedScheduleType === 'explicit_dates'
              ? '—'
              : escapeHtml(formatDate(med.endDate))
          }
        </td>

        <td>
          <span class="status ${
            med.active ? 'success' : 'upcoming'
          }">
            ${
              escapeHtml(
                med.active
                  ? tr('active')
                  : tr('passive')
              )
            }
          </span>
        </td>

        <td>
          <div class="inline">
            <button onclick="openEditMedication('${med.id}')">
              ${escapeHtml(tr('edit'))}
            </button>

            <button onclick="toggleMedicationMode('${med.id}')">
              ${
                escapeHtml(
                  med.active
                    ? tr('passive')
                    : tr('active')
                )
              }
            </button>

            <button onclick="showRowHistory('${med.id}')">
              ${escapeHtml(tr('history'))}
            </button>
          </div>
        </td>
      </tr>
    `;
  })
  .join('');

  const body = `
    <section class="card"><h1>${escapeHtml(tr('title_input'))}</h1><p>${escapeHtml(tr('input_intro'))}</p></section>
    <section class="grid2">
      <div class="card">
        <h2>${escapeHtml(tr('input_title_1'))}</h2>
        <div class="form-grid">
          <div>
  <label>${escapeHtml(tr('medication'))} *</label>
  <input
    id="create_name"
    placeholder="${escapeHtml(tr('name_hint'))}"
    required
  >
</div>

<div>
  <label>Производитель</label>
  <input
    id="create_manufacturer"
    placeholder="Название производителя"
  >
</div>

<div class="full">
  <h3>Данные производителя</h3>
</div>

<div>
  <label>Количественное содержание *</label>
 <input
  id="create_contentValue"
  type="number"
  onfocus="guardMedicationSequence('create_', 'contentValue')"
    min="0"
    step="any"
    placeholder="Например: 500"
    required
  >
</div>

<div>
  <label>Единица содержания *</label>
 <select
  id="create_contentUnit"
  onfocus="guardMedicationSequence('create_', 'contentUnit')"
  onchange="syncMedicationOtherUnit('create_', 'content')"
    required
  >
    <option value="">Выберите</option>
    <option value="mcg">мкг</option>
    <option value="mg">мг</option>
    <option value="g">г</option>
    <option value="kg">кг</option>
    <option value="ml">мл</option>
    <option value="l">л</option>
    <option value="%">%</option>
    <option value="mg/ml">мг/мл</option>
    <option value="mcg/ml">мкг/мл</option>
    <option value="mg/g">мг/г</option>
    <option value="IU">МЕ</option>
    <option value="unit">ед.</option>
    <option value="other">Другое</option>
  </select>
</div>

<div
  id="create_contentUnitOther_wrap"
  style="display:none"
>
  <label>Другая единица содержания *</label>
  <input
  id="create_contentUnitOther"
  onfocus="guardMedicationSequence('create_', 'contentUnitOther')"
>
</div>

<div class="full">
  <h3>Доза</h3>
</div>

<div>
  <label>Количество приёма *</label>
  <input
  id="create_intakeQuantity"
  type="number"
  onfocus="guardMedicationSequence('create_', 'intakeQuantity')"
    min="0"
    step="any"
    placeholder="Например: 1"
    required
  >
</div>

<div>
  <label>Единица приёма *</label>
  <select
  id="create_intakeUnit"
  onfocus="guardMedicationSequence('create_', 'intakeUnit')"
  onchange="syncMedicationOtherUnit('create_', 'intake')"
    required
  >
    <option value="">Выберите</option>
    <option value="tablet">таблетка</option>
    <option value="capsule">капсула</option>
    <option value="ml">мл</option>
    <option value="drop">капля</option>
    <option value="teaspoon">чайная ложка</option>
    <option value="tablespoon">столовая ложка</option>
    <option value="dose">доза</option>
    <option value="puff">впрыск</option>
    <option value="ampoule">ампула</option>
    <option value="vial">флакон</option>
    <option value="packet">пакет</option>
    <option value="sachet">саше</option>
    <option value="suppository">суппозиторий</option>
    <option value="patch">пластырь</option>
    <option value="injection">инъекция</option>
    <option value="unit">единица</option>
    <option value="other">Другое</option>
  </select>
</div>
<div
  id="create_intakeUnitOther_wrap"
  style="display:none"
>
  <label>Другая единица приёма *</label>
  <input
  id="create_intakeUnitOther"
  onfocus="guardMedicationSequence('create_', 'intakeUnitOther')"
>
</div>

<div class="full">
  <label>${escapeHtml(tr('details'))} *</label>
  <textarea
  id="create_details"
  onfocus="guardMedicationSequence('create_', 'details')"
  placeholder="${escapeHtml(tr('details'))}"
    required
  ></textarea>
</div>
          <div>
  <label>${escapeHtml(tr('schedule'))} *</label>

  <select
    id="create_scheduleType"
    data-previous-value="daily"
  onchange="changeCreateScheduleType(this)"
>
    <option value="daily">
      ${escapeHtml(tr('every_day'))}
    </option>

    <option value="weekdays">
      ${escapeHtml(tr('weekdays'))}
    </option>

    <option value="explicit_dates">
      ${escapeHtml(tr('explicit_dates'))}
    </option>
  </select>
</div>
          <div><label>${escapeHtml(tr('mode'))}</label><label class="active-choice"><input id="create_active" type="checkbox" checked> ${escapeHtml(tr('active'))}</label></div>
          ${structuredTimeEditorHtml('create_', [])}
          ${structuredWeekdayEditorHtml('create_', [])}
          ${structuredDateEditorHtml('create_', [])}
          <div id="create_start_wrap"><label>${escapeHtml(tr('start_date'))} *</label><input
  id="create_startDate"
  type="date"
  onfocus="guardMedicationSequence('create_', 'startDate')"
></div>
          <div id="create_end_wrap"><label>${escapeHtml(tr('end_date'))} *</label><input
  id="create_endDate"
  type="date"
  onfocus="guardMedicationSequence('create_', 'endDate')"
></div>
          <div class="full right">
  <button
  id="createMedicationButton"
  type="button"
  onclick="createMedication()"
>
  ${escapeHtml(tr('add'))}
</button>
</div>
        </div>
      </div>
      <div class="card">
        <h2>${escapeHtml(tr('input_title_3'))}</h2>
        <div class="help"><ul>
  <li>${escapeHtml(tr('input_fill_help_1'))}</li>
  <li>${escapeHtml(tr('input_fill_help_2'))}</li>
  <li>${escapeHtml(tr('input_fill_help_3'))}</li>
  <li>${escapeHtml(tr('input_fill_help_4'))}</li>
</ul></div>
      </div>
    </section>
    <section class="card"><h2>${escapeHtml(tr('input_title_2'))}</h2><table><thead><tr><th>${escapeHtml(tr('row'))}</th><th>${escapeHtml(tr('medication'))}</th><th>Производитель</th><th>Количественное содержание</th><th>Единица содержания</th><th>Количество приёма</th><th>Единица приёма</th><th>${escapeHtml(tr('details'))}</th><th>${escapeHtml(tr('schedule'))}</th><th>Параметры расписания</th><th>${escapeHtml(tr('time_slots'))}</th><th>${escapeHtml(tr('start_date'))}</th><th>${escapeHtml(tr('end_date'))}</th><th>${escapeHtml(tr('mode'))}</th><th>${escapeHtml(tr('actions'))}</th></tr></thead><tbody>${rows || `<tr><td colspan="15">—</td></tr>`}</tbody></table></section>
    <dialog id="rowHistoryDialog"><h2>${escapeHtml(tr('row_history_title'))}</h2><div id="rowHistoryContent"></div><div class="right" style="margin-top:14px"><button onclick="document.getElementById('rowHistoryDialog').close()">${escapeHtml(tr('close'))}</button></div></dialog>
    <dialog id="editDialog"><h2>${escapeHtml(tr('edit'))}</h2><div id="editDialogContent"></div></dialog>
    <dialog id="medicationConfirmDialog"><h2>${escapeHtml(tr('confirm_medication_title'))}</h2><div id="medicationConfirmContent"></div><div class="dialog-actions"><button type="button" onclick="cancelMedicationCreate()">${escapeHtml(tr('confirm_back'))}</button><button
  id="confirmMedicationCreateButton"
  type="button"
  onclick="confirmMedicationCreate()"
>
  ${escapeHtml(tr('confirm_save'))}
</button></div></dialog>`;
  document.body.innerHTML = appShell(tr('title_input'), 'input', body);
  scheduleClock();
  initializeStructuredEditors('create_');
  syncCreateScheduleFields();
}
