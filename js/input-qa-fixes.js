(function(){
  const originalCreateMedicationFromForm = window.createMedicationFromForm;
  if (typeof originalCreateMedicationFromForm === 'function') {
    window.createMedicationFromForm = function(prefix) {
      const item = originalCreateMedicationFromForm(prefix);
      if (prefix === 'create_') item.active = true;
      return item;
    };
  }

  function dateISOPlusDays(dateISO, days) {
    const [y, m, d] = dateISO.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  function weekdayCode(dateISO) { const [y,m,d]=dateISO.split('-').map(Number); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(Date.UTC(y,m-1,d,12)).getUTCDay()]; }
  function medicationLastDate(med) { if (med.scheduleType === 'explicit_dates') { const dates=(med.explicitDates||[]).filter(Boolean).slice().sort(); return dates.length?dates[dates.length-1]:''; } return med.endDate||''; }
  function scheduleAppliesIgnoringMode(med,dateISO){ if(!med||med.cancelled)return false;if(med.scheduleType==='explicit_dates')return(med.explicitDates||[]).includes(dateISO);if(med.startDate&&dateISO<med.startDate)return false;if(med.endDate&&dateISO>med.endDate)return false;if(med.scheduleType==='weekdays')return(med.weekdays||[]).includes(weekdayCode(dateISO));return med.scheduleType==='daily'||!med.scheduleType; }
  function shouldCompleteCourse(med){if(!med||med.cancelled)return false;const lastDate=medicationLastDate(med);if(!lastDate)return false;return lastDate<currentLocalDate();}
  function effectiveTakenAt(state,medicationId,plannedAt){
    const logs=(state.intakeLogs||[]).filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt).sort((a,b)=>new Date(b.actualAt||b.at||0)-new Date(a.actualAt||a.at||0));
    const primary=logs[0]||null;
    if(!primary)return '';
    const corrections=(state.intakeCorrections||[]).filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt).sort((a,b)=>new Date(a.correctedAt||0)-new Date(b.correctedAt||0));
    const last=corrections[corrections.length-1]||null;
    if(last&&new Date(last.correctedAt||0)>new Date(primary.actualAt||primary.at||0)){
      if(last.after?.action==='reset')return '';
      if(last.after?.action==='taken'&&last.after?.actualAt)return last.after.actualAt;
    }
    return primary.action==='taken'?(primary.actualAt||primary.at||''):'';
  }
  function courseCompletionAt(state,med){
    const lastDate=medicationLastDate(med);
    if(!lastDate)return nowISO();
    const times=[...(med.times||[])].filter(Boolean).sort();
    const lastTime=times[times.length-1]||'23:59';
    const plannedAt=getScheduledDateTime(lastDate,lastTime);
    const takenAt=effectiveTakenAt(state,med.id,plannedAt);
    if(takenAt)return takenAt;
    const endOfDay=getScheduledDateTime(lastDate,'23:59');
    return new Date(new Date(endOfDay).getTime()+59000).toISOString();
  }
  function reconcileCompletedCourses(state){let changed=false;(state.medications||[]).forEach(med=>{if(med.cancelled)return;const shouldBeCompleted=shouldCompleteCourse(med);if(shouldBeCompleted){const completedAt=courseCompletionAt(state,med);if(!med.courseCompleted){med.courseCompleted=true;med.active=false;recordRowHistory(med,'course_completed','Курс приёма препарата завершён автоматически.');const createdEntry=(med.rowHistory||[]).find(entry=>entry?.action==='course_completed');if(createdEntry)createdEntry.at=completedAt;changed=true;}else{const completedEntry=(med.rowHistory||[]).find(entry=>entry?.action==='course_completed');if(completedEntry&&completedAt&&completedEntry.at!==completedAt){completedEntry.at=completedAt;changed=true;}}}if(!shouldBeCompleted&&med.courseCompleted){med.courseCompleted=false;changed=true;}if(Array.isArray(med.rowHistory)){const filtered=med.rowHistory.filter(entry=>entry?.action!=='course_status_corrected'&&entry?.event!=='course_status_corrected');if(filtered.length!==med.rowHistory.length){med.rowHistory=filtered;changed=true;}}});if(changed)saveState(state);}
  window.isCompletedMedicationCourse=function(med){return Boolean(med&&!med.cancelled&&shouldCompleteCourse(med));};

  const originalCreateMedication=window.createMedication;
  if(typeof originalCreateMedication==='function'){window.createMedication=function(){originalCreateMedication();const content=document.getElementById('medicationConfirmContent');const table=content?.querySelector('table');if(table&&!table.querySelector('[data-confirm-status]')){const row=document.createElement('tr');row.setAttribute('data-confirm-status','1');row.innerHTML='<td>Статус</td><td>Активно</td>';table.appendChild(row);}};}

  const originalRowHistoryHtml=window.rowHistoryHtml;
  if(typeof originalRowHistoryHtml==='function'){window.rowHistoryHtml=function(entries){const visibleEntries=Array.isArray(entries)?entries.filter(entry=>entry?.action!=='course_status_corrected'&&entry?.event!=='course_status_corrected'):entries;const html=originalRowHistoryHtml(visibleEntries);const template=document.createElement('template');template.innerHTML=html;const table=template.content.querySelector('table');if(!table)return html;table.querySelectorAll('tr').forEach(row=>{if(row.children.length===15)row.lastElementChild?.remove();const eventCell=row.children[1];const statusCell=row.children[13];const eventText=eventCell?.textContent?.trim();if(eventText==='course_completed'){eventCell.textContent='Курс завершён';if(statusCell)statusCell.textContent='—';}});return template.innerHTML;};}

  const originalRenderInputPage=window.renderInputPage;
  if(typeof originalRenderInputPage==='function'){
    window.renderInputPage=function(){
      const stateBefore=getState();reconcileCompletedCourses(stateBefore);originalRenderInputPage();
      const active=document.getElementById('create_active');if(active){active.checked=true;active.disabled=true;}
      const state=getState();const current=(state.medications||[]).filter(med=>!med.cancelled&&!med.archivedCompleted);const activeMeds=current.filter(med=>med.active&&!med.courseCompleted);const passiveMeds=current.filter(med=>!med.active&&!med.courseCompleted);const completedMeds=current.filter(med=>med.courseCompleted);
      document.querySelectorAll('button[onclick^="toggleMedicationMode("]').forEach(button=>{const match=button.getAttribute('onclick')?.match(/toggleMedicationMode\('([^']+)'\)/);const id=match?.[1];const med=id?current.find(item=>item.id===id):null;if(med)button.textContent=med.active?'Сделать пассивным':'Активировать';});
      const sourceTable=[...document.querySelectorAll('table')].find(table=>table.querySelector('button[onclick^="openEditMedication("]'));if(!sourceTable)return;
      const rowById=new Map();sourceTable.querySelectorAll('tbody tr').forEach(row=>{const onclick=[...row.querySelectorAll('button[onclick]')].map(b=>b.getAttribute('onclick')||'').join(' ');const med=current.find(item=>onclick.includes(`'${item.id}'`));if(med)rowById.set(med.id,row.cloneNode(true));});
      const originalHeading=sourceTable.closest('section')?.querySelector('h2');if(originalHeading)originalHeading.textContent='Активные препараты';
      const renderRows=(table,meds,mode)=>{const tbody=table.querySelector('tbody');if(!tbody)return;tbody.innerHTML='';meds.forEach(med=>{const source=rowById.get(med.id);if(!source)return;const row=source.cloneNode(true);const status=row.querySelector('.status');if(status)status.textContent=mode==='active'?'Активно':'Пассивно';const actions=row.lastElementChild;if(actions&&mode==='passive'){actions.querySelectorAll('button').forEach(button=>{const onclick=button.getAttribute('onclick')||'';if(!onclick.startsWith('toggleMedicationMode(')&&!onclick.startsWith('showRowHistory('))button.remove();});const toggle=actions.querySelector('button[onclick^="toggleMedicationMode("]');if(toggle)toggle.textContent='Активировать';}if(actions&&mode==='completed'){actions.querySelectorAll('button').forEach(button=>button.remove());const repeat=document.createElement('button');repeat.type='button';repeat.textContent='Повторить курс';repeat.setAttribute('onclick',`repeatCompletedCourse('${med.id}')`);const archive=document.createElement('button');archive.type='button';archive.textContent='Отправить в архив';archive.setAttribute('onclick',`archiveCompletedCourse('${med.id}')`);const history=document.createElement('button');history.type='button';history.textContent='История';history.setAttribute('onclick',`showArchiveMedicationHistory('${med.id}')`);actions.appendChild(repeat);actions.appendChild(archive);actions.appendChild(history);}tbody.appendChild(row);});};
      renderRows(sourceTable,activeMeds,'active');
      const anchor=sourceTable.closest('section');
      const passiveSection=document.createElement('section');passiveSection.className='card';const passiveHeading=document.createElement('h2');passiveHeading.textContent='Пассивные препараты';passiveSection.appendChild(passiveHeading);const passiveTable=sourceTable.cloneNode(true);renderRows(passiveTable,passiveMeds,'passive');passiveSection.appendChild(passiveTable);anchor.after(passiveSection);
      const completedSection=document.createElement('section');completedSection.className='card';const completedHeading=document.createElement('h2');completedHeading.textContent='Завершённые курсы';completedSection.appendChild(completedHeading);const completedTable=sourceTable.cloneNode(true);renderRows(completedTable,completedMeds,'completed');completedSection.appendChild(completedTable);passiveSection.after(completedSection);
    };
  }
  window.repeatCompletedCourse=function(id){
    const med=(getState().medications||[]).find(item=>item.id===id);
    if(!med||!med.courseCompleted||med.archivedCompleted)return;
    window.__repeatCompletedCourseSourceId=id;

    const set=(key,value)=>{const el=document.getElementById('create_'+key);if(el)el.value=value==null?'':String(value);};
    set('name',med.name||'');
    set('manufacturer',med.manufacturer||'');
    set('contentValue',med.contentValue||'');
    set('contentUnit',med.contentUnit||'');
    set('contentUnitOther',med.contentUnitOther||'');
    set('intakeQuantity',med.intakeQuantity||'');
    set('intakeUnit',med.intakeUnit||'');
    set('intakeUnitOther',med.intakeUnitOther||'');
    set('details',med.details||'');
    set('scheduleType',med.scheduleType||((med.explicitDates||[]).length?'explicit_dates':(med.weekdays||[]).length?'weekdays':'daily'));

    const times=document.getElementById('create_times');
    if(times)times.value=[...new Set((med.times||[]).filter(Boolean))].sort().join(',');

    const weekdays=document.getElementById('create_weekdays');
    if(weekdays)weekdays.value=[...new Set((med.weekdays||[]).filter(Boolean))].join(',');
    document.querySelectorAll('input[data-prefix="create_"][data-weekday]').forEach(input=>{
      input.checked=(med.weekdays||[]).includes(input.dataset.weekday);
    });

    const explicit=document.getElementById('create_explicitDates');
    if(explicit)explicit.value='';
    set('startDate','');
    set('endDate','');

    const schedule=document.getElementById('create_scheduleType');
    if(schedule)schedule.dataset.previousValue=schedule.value;

    if(typeof window.syncMedicationOtherUnit==='function'){
      window.syncMedicationOtherUnit('create_','content');
      window.syncMedicationOtherUnit('create_','intake');
    }
    if(typeof window.syncCreateScheduleFields==='function')window.syncCreateScheduleFields();
    if(typeof window.renderStructuredTimes==='function')window.renderStructuredTimes('create_');
    if(typeof window.renderStructuredDates==='function')window.renderStructuredDates('create_');

    const formCard=document.getElementById('create_name')?.closest('.card');
    if(formCard){
      let notice=formCard.querySelector('[data-repeat-course-notice]');
      if(!notice){
        notice=document.createElement('div');
        notice.setAttribute('data-repeat-course-notice','1');
        notice.className='help';
        notice.style.marginBottom='14px';
        formCard.insertBefore(notice,formCard.querySelector('.form-grid'));
      }
      notice.innerHTML=`<strong>Повтор курса: ${escapeHtml(med.name||'')}</strong><br><span class="muted">Данные препарата перенесены. Укажите новые даты курса и сохраните новый курс.</span>`;
    }
    const createButton=document.getElementById('createMedicationButton');
    if(createButton)createButton.textContent='Создать новый курс';

    const target=formCard||document.getElementById('create_name');
    if(target){
      window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-20),behavior:'auto'});
    }
    const scheduleType=document.getElementById('create_scheduleType')?.value||'daily';
    window.setTimeout(()=>{
      if(scheduleType==='explicit_dates')document.getElementById('create_datePicker')?.focus();
      else document.getElementById('create_startDate')?.focus();
    },0);
  };

  window.archiveCompletedCourse=function(id){
    const state=getState();
    const med=(state.medications||[]).find(item=>item.id===id);
    if(!med||!med.courseCompleted||med.archivedCompleted)return;
    if(!confirm(`Отправить завершённый курс «${med.name||''}» в Архив?`))return;
    med.archivedCompleted=true;
    med.archivedAt=nowISO();
    if(!saveState(state))return;
    if(window.__repeatCompletedCourseSourceId===id)window.__repeatCompletedCourseSourceId=null;
    mount('input');
  };

  const originalConfirmMedicationCreate=window.confirmMedicationCreate;
  if(typeof originalConfirmMedicationCreate==='function'){
    window.confirmMedicationCreate=function(){
      const sourceId=window.__repeatCompletedCourseSourceId||null;
      const beforeCount=(getState().medications||[]).length;
      const result=originalConfirmMedicationCreate();
      const afterState=getState();
      const createdSuccessfully=(afterState.medications||[]).length>beforeCount;
      if(sourceId&&createdSuccessfully){
        const source=(afterState.medications||[]).find(item=>item.id===sourceId);
        if(source&&source.courseCompleted&&!source.archivedCompleted){
          source.archivedCompleted=true;
          source.archivedAt=nowISO();
          saveState(afterState);
          window.__repeatCompletedCourseSourceId=null;
          mount('input');
        }
      }
      return result;
    };
  }

  const originalToggleMedicationMode=window.toggleMedicationMode;if(typeof originalToggleMedicationMode==='function'){window.toggleMedicationMode=function(id){const med=(getState().medications||[]).find(item=>item.id===id);if(med&&med.courseCompleted)return;return originalToggleMedicationMode(id);};}
})();