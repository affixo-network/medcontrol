(function(){
  const baseRows=window.intakeHistoryRows;

  function filterPeriod(eventAt,period){
    if(period==='all') return true;
    const ms=new Date(eventAt).getTime();
    const now=Date.now();
    if(period==='today') return localDateFromISO(eventAt)===currentLocalDate();
    if(period==='7') return ms>=now-7*86400000;
    if(period==='30') return ms>=now-30*86400000;
    return true;
  }

  function reasonLabel(reason){
    return reason==='accident'?'Случайность':reason==='error'?'Ошибка':'—';
  }

  window.intakeHistoryRows=function(medId,period,plannedAt){
    if(!plannedAt) return typeof baseRows==='function'?baseRows(medId,period):'';
    const state=getState();
    const events=[];

    (state.intakeLogs||[])
      .filter(log=>log.medicationId===medId&&log.plannedAt===plannedAt)
      .forEach(log=>events.push({
        occurredAt:log.actualAt,
        event:'Принято',
        plannedAt:log.plannedAt,
        actualAt:log.actualAt,
        correctionAt:null,
        reason:null
      }));

    (state.intakeCorrections||[])
      .filter(c=>c.medicationId===medId&&c.plannedAt===plannedAt)
      .forEach(c=>{
        const base=(state.intakeLogs||[]).find(log=>
          log.medicationId===c.medicationId&&
          log.plannedAt===c.plannedAt&&
          (!c.primaryLogId||log.id===c.primaryLogId)
        );
        events.push({
          occurredAt:c.correctedAt,
          event:'Отмена «Принято»',
          plannedAt:c.plannedAt,
          actualAt:c.before?.actualAt||base?.actualAt||null,
          correctionAt:c.correctedAt,
          reason:reasonLabel(c.reason)
        });
      });

    const filtered=events
      .filter(event=>filterPeriod(event.occurredAt,period))
      .sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));

    if(!filtered.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;

    const rows=filtered.map(event=>`<tr>
      <td>${escapeHtml(formatDateTime(event.occurredAt))}</td>
      <td>${escapeHtml(event.event)}</td>
      <td>${escapeHtml(formatDateTime(event.plannedAt))}</td>
      <td>${event.actualAt?escapeHtml(formatDateTime(event.actualAt)):'—'}</td>
      <td>${event.correctionAt?escapeHtml(formatDateTime(event.correctionAt)):'—'}</td>
      <td>${event.reason?escapeHtml(event.reason):'—'}</td>
    </tr>`).join('');

    return `<table><thead><tr><th>Время события</th><th>Событие</th><th>Расчётное время</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  window.showIntakeHistory=function(medicationId,plannedAt){
    window.__historyMedicationId=medicationId;
    window.__historyPlannedAt=plannedAt||null;
    refreshIntakeHistory();
    const dialog=document.getElementById('intakeHistoryDialog');
    const med=(getState().medications||[]).find(item=>item.id===medicationId);
    const title=dialog?.querySelector('h2');
    if(title&&med){
      title.textContent=plannedAt
        ? `История приёма препарата «${med.name}» — ${formatDateTime(plannedAt)}`
        : `История приёма препарата «${med.name}»`;
    }
    dialog?.showModal();
  };

  window.refreshIntakeHistory=function(){
    const medicationId=window.__historyMedicationId;
    if(!medicationId) return;
    const period=document.getElementById('historyPeriodSelect')?.value||'today';
    const content=document.getElementById('intakeHistoryContent');
    if(content) content.innerHTML=window.intakeHistoryRows(medicationId,period,window.__historyPlannedAt||null);
  };

  function bindHistoryButtons(){
    const timeline=buildMedControlTimeline();
    const table=[...document.querySelectorAll('section.card table')].find(t=>
      [...t.querySelectorAll('th')].some(th=>th.textContent.trim()==='История')
    );
    if(!table) return;
    const rows=[...table.querySelectorAll('tbody tr')];
    rows.forEach((row,index)=>{
      const item=timeline[index];
      if(!item?.plannedAt) return;
      const button=[...row.querySelectorAll('button')].find(btn=>btn.textContent.trim()==='История');
      if(!button) return;
      button.onclick=()=>window.showIntakeHistory(item.medication.id,item.plannedAt);
      button.removeAttribute('onclick');
    });
  }

  const renderAction=window.renderActionPage;
  if(typeof renderAction==='function'){
    window.renderActionPage=function(){
      const result=renderAction.apply(this,arguments);
      bindHistoryButtons();
      return result;
    };
  }

  const renderDashboard=window.renderDashboardPage;
  if(typeof renderDashboard==='function'){
    window.renderDashboardPage=function(){
      const result=renderDashboard.apply(this,arguments);
      bindHistoryButtons();
      return result;
    };
  }
})();
