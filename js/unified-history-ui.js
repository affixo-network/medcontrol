(function(){
  const SCOPE_LABELS={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  function cutoff(period){if(period==='all')return null;const now=new Date(),days=period==='today'?0:Number(period||7)-1;const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-days);return d.getTime();}
  function filtered(entries,period){const min=cutoff(period);return (entries||[]).filter(e=>min==null||new Date(e.at).getTime()>=min);}
  function selector(id,onchange){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="${id}" onchange="${onchange}"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div>`;}
  function stripMedicationColumn(html){
    const box=document.createElement('div');box.innerHTML=html;const table=box.querySelector('table');if(!table)return html;
    const head=table.querySelector('thead tr');if(head&&head.lastElementChild)head.lastElementChild.remove();
    table.querySelectorAll('tbody tr').forEach(tr=>tr.lastElementChild?.remove());
    return box.innerHTML;
  }
  window.showRowHistory=function(id){const med=getState().medications.find(x=>x.id===id);if(!med)return;window.__rowHistoryMedicationId=id;const dialog=document.getElementById('rowHistoryDialog'),title=dialog?.querySelector('h2');if(title)title.textContent=`Журнал изменений показателей препарата «${med.name}»`;refreshRowHistory();dialog?.showModal();};
  window.refreshRowHistory=function(){const med=getState().medications.find(x=>x.id===window.__rowHistoryMedicationId);if(!med)return;const host=document.getElementById('rowHistoryContent');if(!host)return;const existing=document.getElementById('rowHistoryPeriodSelect')?.value||'today';host.innerHTML=selector('rowHistoryPeriodSelect','refreshRowHistory()')+stripMedicationColumn(rowHistoryHtml(filtered(med.rowHistory||[],existing)));const select=document.getElementById('rowHistoryPeriodSelect');if(select)select.value=existing;};

  function currentHistoryMedication(dialog){const title=dialog?.querySelector('h2')?.textContent||'',match=title.match(/«([^»]+)»/);return match?getState().medications.find(m=>m.name===match[1]):null;}
  function matchEntry(med,dateTimeText){if(!med)return null;return (med.rowHistory||[]).find(e=>{try{return formatDateTime(e.at)===dateTimeText.trim();}catch(_){return false;}})||null;}
  function enhanceIntakeHistory(){
    const dialog=document.getElementById('intakeHistoryDialog');if(!dialog)return;const table=dialog.querySelector('#intakeHistoryContent table');if(!table)return;const med=currentHistoryMedication(dialog);
    let scopeIndex=[...table.querySelectorAll('thead th')].findIndex(th=>th.textContent.trim()==='Область изменения');
    if(scopeIndex<0){const headers=table.querySelectorAll('thead tr th');if(headers.length<2)return;const th=document.createElement('th');th.textContent='Область изменения';headers[1].after(th);scopeIndex=2;table.querySelectorAll('tbody tr').forEach(tr=>{const td=document.createElement('td');tr.cells[1]?.after(td);});}
    const headers=[...table.querySelectorAll('thead th')];const endIndex=headers.findIndex(th=>th.textContent.trim()==='Дата окончания');
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.cells],at=cells[0]?.textContent||'',entry=matchEntry(med,at);const app=med?.temporalApplication;let scope='';
      if(entry?.scheduleScope)scope=entry.scheduleScopeLabel||SCOPE_LABELS[entry.scheduleScope]||'';
      else if(app?.changedAt){try{if(formatDateTime(app.changedAt)===at.trim())scope=SCOPE_LABELS[app.scope]||'';}catch(_){}}
      if(cells[scopeIndex])cells[scopeIndex].textContent=scope||'—';
      const isTodayOnly=(entry?.scheduleScope==='today')||(!entry?.scheduleScope&&app?.scope==='today'&&scope);
      if(isTodayOnly&&endIndex>=0){try{cells[endIndex].textContent=formatDate(localDateFromISO(entry?.at||app.changedAt));}catch(_){}}
    });
  }
  const observer=new MutationObserver(()=>enhanceIntakeHistory());observer.observe(document.documentElement,{subtree:true,childList:true});
  window.enhanceIntakeHistory=enhanceIntakeHistory;
})();
