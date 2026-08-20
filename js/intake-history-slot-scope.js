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
    const d=new Date(iso);
    return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Yerevan'}).format(d);
  }

  window.intakeHistoryRows=function(medId,period,plannedAt){
    if(!plannedAt) return typeof baseRows==='function'?baseRows(medId,period):'';
    const state=getState(); const events=[];
    (state.intakeLogs||[]).filter(l=>l.medicationId===medId&&l.plannedAt===plannedAt).forEach(l=>events.push({occurredAt:l.actualAt,event:'Принято',actualAt:l.actualAt,correctionAt:null,reason:null}));
    (state.intakeCorrections||[]).filter(c=>c.medicationId===medId&&c.plannedAt===plannedAt).forEach(c=>{
      const base=(state.intakeLogs||[]).find(l=>l.medicationId===c.medicationId&&l.plannedAt===c.plannedAt&&(!c.primaryLogId||l.id===c.primaryLogId));
      events.push({occurredAt:c.correctedAt,event:'Отмена «Принято»',actualAt:c.before?.actualAt||base?.actualAt||null,correctionAt:c.correctedAt,reason:reasonLabel(c.reason)});
    });
    const filtered=events.filter(e=>filterPeriod(e.occurredAt,period)).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
    if(!filtered.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
    const rows=filtered.map(e=>`<tr><td>${escapeHtml(formatDateTime(e.occurredAt))}</td><td>${escapeHtml(e.event)}</td><td>${e.actualAt?escapeHtml(formatDateTime(e.actualAt)):'—'}</td><td>${e.correctionAt?escapeHtml(formatDateTime(e.correctionAt)):'—'}</td><td>${e.reason?escapeHtml(e.reason):'—'}</td></tr>`).join('');
    return `<table><thead><tr><th>Время события</th><th>Событие</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  window.showIntakeHistory=function(medicationId,plannedAt){
    window.__historyMedicationId=medicationId; window.__historyPlannedAt=plannedAt||null;
    refreshIntakeHistory();
    const dialog=document.getElementById('intakeHistoryDialog');
    const med=(getState().medications||[]).find(item=>item.id===medicationId);
    const title=dialog?.querySelector('h2');
    if(title&&med) title.textContent=plannedAt?`История приёма препарата «${med.name}» — расчётное время ${timeOnly(plannedAt)}`:`История приёма препарата «${med.name}»`;
    dialog?.showModal();
  };

  window.refreshIntakeHistory=function(){
    const medicationId=window.__historyMedicationId; if(!medicationId) return;
    const period=document.getElementById('historyPeriodSelect')?.value||'today';
    const content=document.getElementById('intakeHistoryContent');
    if(content) content.innerHTML=window.intakeHistoryRows(medicationId,period,window.__historyPlannedAt||null);
  };

  function bindHistoryButtons(){
    const tables=[...document.querySelectorAll('table')];
    tables.forEach(table=>{
      const historyIndex=[...table.querySelectorAll('thead th')].findIndex(th=>th.textContent.trim()==='История');
      if(historyIndex<0) return;
      [...table.querySelectorAll('tbody tr')].forEach(row=>{
        const cells=[...row.children];
        const button=[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='История');
        if(!button) return;
        const medId=Number(cells[0]?.textContent.trim());
        const dateText=cells.find(td=>/^\d{2}\.\d{2}\.\d{4}$/.test(td.textContent.trim()))?.textContent.trim();
        const times=cells.map(td=>td.textContent.trim()).filter(v=>/^\d{2}:\d{2}$/.test(v));
        const plannedTime=times[0];
        if(!medId||!dateText||!plannedTime) return;
        const [dd,mm,yyyy]=dateText.split('.');
        const plannedAt=`${yyyy}-${mm}-${dd}T${plannedTime}:00+04:00`;
        button.onclick=function(ev){ ev.preventDefault(); ev.stopPropagation(); window.showIntakeHistory(medId,plannedAt); };
      });
    });
  }

  function scheduleBind(){ setTimeout(bindHistoryButtons,0); setTimeout(bindHistoryButtons,100); }
  const ra=window.renderActionPage; if(typeof ra==='function') window.renderActionPage=function(){const r=ra.apply(this,arguments);scheduleBind();return r;};
  const rd=window.renderDashboardPage; if(typeof rd==='function') window.renderDashboardPage=function(){const r=rd.apply(this,arguments);scheduleBind();return r;};
  document.addEventListener('DOMContentLoaded',scheduleBind);
})();
