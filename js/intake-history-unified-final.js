(function(){
  const SCOPE_LABELS={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};

  function eventDate(entry){try{return localDateFromISO(entry.at);}catch(_){return '';}}
  function dateFromPlannedAt(plannedAt){try{return localDateFromISO(plannedAt);}catch(_){return '';}}
  function timeFromPlannedAt(plannedAt){try{return (formatDateTime(plannedAt).split(', ')[1]||'').trim();}catch(_){return '';}}
  function scopeForClock(med,clock,dateISO){
    const entries=(med?.rowHistory||[]).filter(e=>e?.scheduleScope&&eventDate(e)===dateISO).sort((a,b)=>new Date(a.at)-new Date(b.at));
    for(let i=entries.length-1;i>=0;i--){
      const e=entries[i];
      const changed=Array.isArray(e.changedTimeValues)?e.changedTimeValues:[];
      const removed=Array.isArray(e.removedTimeValues)?e.removedTimeValues:[];
      if(changed.includes(clock)||removed.includes(clock)) return e;
      const todayTimes=e.scopeTodayTemporal?.times||[];
      if(todayTimes.includes(clock)) return e;
    }
    const app=med?.temporalApplication;
    if(app&&app.date===dateISO&&app.scope&&((app.todayTemporal?.times||[]).includes(clock))) return {scheduleScope:app.scope,scheduleScopeLabel:SCOPE_LABELS[app.scope],at:app.changedAt};
    return null;
  }

  function enhanceHistoryTable(){
    const content=document.getElementById('intakeHistoryContent');
    const table=content?.querySelector('table');
    if(!table) return;
    const med=(getState().medications||[]).find(m=>m.id===window.__historyMedicationId);
    const plannedAt=window.__historyPlannedAt;
    const clock=timeFromPlannedAt(plannedAt);
    const dateISO=dateFromPlannedAt(plannedAt)||currentLocalDate();
    const scopeEntry=scopeForClock(med,clock,dateISO);

    const headRow=table.querySelector('thead tr');
    if(!headRow) return;
    let headers=[...headRow.children];
    let scopeIndex=headers.findIndex(th=>th.textContent.trim()==='Область изменения');
    if(scopeIndex<0){
      const th=document.createElement('th');th.textContent='Область изменения';
      if(headers[1]) headers[1].after(th); else headRow.appendChild(th);
      scopeIndex=2;
      table.querySelectorAll('tbody tr').forEach(tr=>{const td=document.createElement('td');if(tr.cells[1])tr.cells[1].after(td);else tr.appendChild(td);});
    }
    headers=[...headRow.children];
    const endIndex=headers.findIndex(th=>th.textContent.trim()==='Дата окончания');
    const timeIndex=headers.findIndex(th=>th.textContent.trim()==='Время');

    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.cells];
      const eventText=cells[1]?.textContent.trim()||'';
      const rowClock=timeIndex>=0?cells[timeIndex]?.textContent.trim()||'':'';
      const relates=scopeEntry&&(rowClock===clock||rowClock==='—'||eventText==='Создано'||eventText==='Изменено');
      if(cells[scopeIndex]) cells[scopeIndex].textContent=relates?(scopeEntry.scheduleScopeLabel||SCOPE_LABELS[scopeEntry.scheduleScope]||'—'):'—';
      if(relates&&scopeEntry?.scheduleScope==='today'&&endIndex>=0&&cells[endIndex]) cells[endIndex].textContent=formatDate(dateISO);
    });
  }

  const baseRefresh=window.refreshIntakeHistory;
  window.refreshIntakeHistory=function(){
    if(typeof baseRefresh==='function') baseRefresh.apply(this,arguments);
    setTimeout(enhanceHistoryTable,0);
  };

  const baseShow=window.showIntakeHistory;
  window.showIntakeHistory=function(medicationId,plannedAt){
    window.__historyMedicationId=medicationId;
    if(plannedAt) window.__historyPlannedAt=plannedAt;
    if(typeof baseShow==='function') baseShow.call(this,medicationId,plannedAt);
    setTimeout(enhanceHistoryTable,0);
  };

  window.enhanceHistoryTableFinal=enhanceHistoryTable;
})();
