(function(){
  const SCOPE_LABELS={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  function cutoff(period){if(period==='all')return null;const now=new Date(),days=period==='today'?0:Number(period||7)-1;const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-days);return d.getTime();}
  function filtered(entries,period){const min=cutoff(period);return (entries||[]).filter(e=>min==null||new Date(e.at).getTime()>=min);}
  function selector(id,onchange){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="${id}" onchange="${onchange}"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div>`;}
  const originalShow=window.showRowHistory;
  window.showRowHistory=function(id){
    const med=getState().medications.find(x=>x.id===id);if(!med)return;
    window.__rowHistoryMedicationId=id;
    const dialog=document.getElementById('rowHistoryDialog'),title=dialog?.querySelector('h2');
    if(title)title.textContent=`Журнал изменений показателей препарата «${med.name}»`;
    refreshRowHistory();dialog?.showModal();
  };
  window.refreshRowHistory=function(){
    const med=getState().medications.find(x=>x.id===window.__rowHistoryMedicationId);if(!med)return;
    const host=document.getElementById('rowHistoryContent');if(!host)return;
    const existing=document.getElementById('rowHistoryPeriodSelect')?.value||'today';
    host.innerHTML=selector('rowHistoryPeriodSelect','refreshRowHistory()')+rowHistoryHtml(filtered(med.rowHistory||[],existing));
    const select=document.getElementById('rowHistoryPeriodSelect');if(select)select.value=existing;
  };
  function addScopeColumn(){
    const dialog=document.getElementById('intakeHistoryDialog');if(!dialog)return;
    const table=dialog.querySelector('#intakeHistoryContent table');if(!table||table.dataset.scopeColumn==='1')return;
    const headers=table.querySelectorAll('thead tr th');if(headers.length<2)return;
    const th=document.createElement('th');th.textContent='Область изменения';headers[1].after(th);
    const title=dialog.querySelector('h2')?.textContent||'',match=title.match(/«([^»]+)»/),med=match?getState().medications.find(m=>m.name===match[1]):null;
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{const td=document.createElement('td');let label='';if(med){const dateText=tr.cells[0]?.textContent||'';const entries=(med.rowHistory||[]).filter(e=>e.scheduleScope);const same=entries.find(e=>{try{return formatDate(localDateFromISO(e.at))===dateText.split(',')[0].trim();}catch(_){return false;}});if(same)label=same.scheduleScopeLabel||SCOPE_LABELS[same.scheduleScope]||'';}td.textContent=label;tr.cells[1]?.after(td);});
    table.dataset.scopeColumn='1';
  }
  const observer=new MutationObserver(()=>addScopeColumn());observer.observe(document.documentElement,{subtree:true,childList:true});
})();
