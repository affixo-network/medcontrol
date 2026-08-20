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
  function reasonLabel(reason){ return reason==='accident'?'Случайность':reason==='error'?'Ошибка':'—'; }
  function timeOnly(iso){
    if(!iso) return '';
    const parts=formatDateTime(iso).split(', ');
    return parts[1]||'';
  }
  function medicationHistory(med){
    const entries=Array.isArray(med?.rowHistory)?med.rowHistory:[];
    if(!entries.length) return '<p class="muted">История препарата пока пуста.</p>';
    if(typeof rowHistoryHtml==='function') return rowHistoryHtml(entries);
    return '<p class="muted">История препарата недоступна.</p>';
  }

  window.intakeHistoryRows=function(medId,period,plannedAt){
    if(!plannedAt) return typeof baseRows==='function'?baseRows(medId,period):'';
    const state=getState();
    const med=(state.medications||[]).find(item=>item.id===medId);
    const events=[];

    (state.intakeLogs||[])
      .filter(log=>log.medicationId===medId&&log.plannedAt===plannedAt)
      .forEach(log=>events.push({
        occurredAt:log.actualAt,
        event:'Принято',
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
          actualAt:c.before?.actualAt||base?.actualAt||null,
          correctionAt:c.correctedAt,
          reason:reasonLabel(c.reason)
        });
      });

    const filtered=events
      .filter(event=>filterPeriod(event.occurredAt,period))
      .sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));

    const intakeHtml=filtered.length
      ? `<table><thead><tr><th>Время события</th><th>Событие</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${filtered.map(event=>`<tr><td>${escapeHtml(formatDateTime(event.occurredAt))}</td><td>${escapeHtml(event.event)}</td><td>${event.actualAt?escapeHtml(formatDateTime(event.actualAt)):'—'}</td><td>${event.correctionAt?escapeHtml(formatDateTime(event.correctionAt)):'—'}</td><td>${event.reason?escapeHtml(event.reason):'—'}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Для выбранного расчётного времени событий приёма пока нет.</p>';

    return `<h3>История препарата</h3>${medicationHistory(med)}<h3 style="margin-top:18px">История выбранного расчётного приёма</h3>${intakeHtml}`;
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
        ? `История приёма препарата «${med.name}» — расчётное время ${timeOnly(plannedAt)}`
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
    const state=getState();
    document.querySelectorAll('table tbody tr').forEach(row=>{
      const button=[...row.querySelectorAll('button')].find(btn=>btn.textContent.trim()==='История');
      if(!button) return;

      const cells=[...row.children];
      const orderText=cells[0]?.textContent.trim();
      const med=(state.medications||[]).find(item=>String(item.order)===String(orderText));
      if(!med) return;

      const dateCell=cells.find(td=>/^\d{2}\.\d{2}\.\d{4}$/.test(td.textContent.trim()));
      const timeCell=cells.find(td=>/^\d{2}:\d{2}$/.test(td.textContent.trim()));
      if(!dateCell||!timeCell) return;

      const [dd,mm,yyyy]=dateCell.textContent.trim().split('.');
      const dateISO=`${yyyy}-${mm}-${dd}`;
      const plannedTime=timeCell.textContent.trim();
      const plannedAt=getScheduledDateTime(dateISO,plannedTime);

      button.onclick=function(event){
        event.preventDefault();
        event.stopPropagation();
        window.showIntakeHistory(med.id,plannedAt);
      };
    });
  }

  function scheduleBind(){
    setTimeout(bindHistoryButtons,0);
    setTimeout(bindHistoryButtons,100);
    setTimeout(bindHistoryButtons,500);
  }

  const renderAction=window.renderActionPage;
  if(typeof renderAction==='function'){
    window.renderActionPage=function(){
      const result=renderAction.apply(this,arguments);
      scheduleBind();
      return result;
    };
  }

  const renderDashboard=window.renderDashboardPage;
  if(typeof renderDashboard==='function'){
    window.renderDashboardPage=function(){
      const result=renderDashboard.apply(this,arguments);
      scheduleBind();
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded',scheduleBind);
})();
