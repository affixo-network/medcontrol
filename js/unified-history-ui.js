(function(){
  const SCOPE_LABELS={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  function cutoff(period){if(period==='all')return null;const now=new Date(),days=period==='today'?0:Number(period||7)-1;const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-days);return d.getTime();}
  function filtered(entries,period){const min=cutoff(period);return (entries||[]).filter(e=>min==null||new Date(e.at).getTime()>=min);}
  function selector(id,onchange){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="${id}" onchange="${onchange}"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div>`;}
  function isStatusOnlyEntry(entry){
    if(!entry)return false;
    if(entry?.changes?.timeStatus)return true;
    const payload=typeof entry.payload==='string'?entry.payload:'';
    if(/Статус препарата изменён|сделан пассивным|активирован/i.test(payload))return true;
    const changes=entry.changes&&typeof entry.changes==='object'?Object.keys(entry.changes):[];
    return changes.length>0&&changes.every(key=>['active','cancelled','courseCompleted','timeStatus'].includes(key));
  }
  function generalEntries(entries){return (entries||[]).filter(entry=>{
    if(entry?.action==='created')return true;
    if(entry?.action!=='edited')return false;
    return !isStatusOnlyEntry(entry);
  });}
  function simplifyGeneralHistory(html){
    const box=document.createElement('div');box.innerHTML=html;const table=box.querySelector('table');if(!table)return html;
    let headers=[...table.querySelectorAll('thead th')];
    const eventIndex=headers.findIndex(th=>th.textContent.trim()==='Событие');
    table.querySelectorAll('tbody tr').forEach(tr=>{const cell=tr.children[eventIndex];if(cell)cell.textContent=(cell.textContent.trim()==='Создано'?'Создано':'Изменено');});

    const removeNames=new Set(['Объект изменения','Область изменения']);
    const remove=[];headers.forEach((th,i)=>{if(removeNames.has(th.textContent.trim()))remove.push(i);});
    remove.sort((a,b)=>b-a).forEach(i=>table.querySelectorAll('tr').forEach(tr=>tr.children[i]?.remove()));

    headers=[...table.querySelectorAll('thead th')];
    const timeIndex=headers.findIndex(th=>th.textContent.trim()==='Время');
    if(timeIndex>=0){
      const rows=[...table.querySelectorAll('tbody tr')];
      const splitTimes=rows.map(tr=>(tr.children[timeIndex]?.textContent||'').split(',').map(v=>v.trim()).filter(v=>v&&v!=='—'));
      const maxTimes=Math.max(1,...splitTimes.map(v=>v.length));
      const headerRow=table.querySelector('thead tr');
      const originalTimeHeader=headerRow.children[timeIndex];
      for(let i=0;i<maxTimes;i++){
        const th=document.createElement('th');
        th.textContent=`Время ${i+1}`;
        originalTimeHeader.before(th);
      }
      originalTimeHeader.remove();

      rows.forEach((tr,rowIndex)=>{
        const originalTimeCell=tr.children[timeIndex];
        const values=splitTimes[rowIndex];
        for(let i=0;i<maxTimes;i++){
          const td=document.createElement('td');
          td.textContent=values[i]||'—';
          originalTimeCell.before(td);
        }
        originalTimeCell.remove();
      });
    }
    return box.innerHTML;
  }
  window.showRowHistory=function(id){const med=getState().medications.find(x=>x.id===id);if(!med)return;window.__rowHistoryMedicationId=id;const dialog=document.getElementById('rowHistoryDialog'),title=dialog?.querySelector('h2');if(title)title.textContent=`История препарата «${med.name}»`;refreshRowHistory();dialog?.showModal();};
  window.refreshRowHistory=function(){const med=getState().medications.find(x=>x.id===window.__rowHistoryMedicationId);if(!med)return;const host=document.getElementById('rowHistoryContent');if(!host)return;const existing=document.getElementById('rowHistoryPeriodSelect')?.value||'today';const entries=generalEntries(filtered(med.rowHistory||[],existing));const journal=simplifyGeneralHistory(rowHistoryHtml(entries));host.innerHTML=selector('rowHistoryPeriodSelect','refreshRowHistory()')+journal;const select=document.getElementById('rowHistoryPeriodSelect');if(select)select.value=existing;};
  function currentHistoryMedication(dialog){const title=dialog?.querySelector('h2')?.textContent||'',match=title.match(/«([^»]+)»/);return match?getState().medications.find(m=>m.name===match[1]):null;}
  function matchEntry(med,dateTimeText){if(!med)return null;return (med.rowHistory||[]).find(e=>{try{return formatDateTime(e.at)===dateTimeText.trim();}catch(_){return false;}})||null;}
  function enhanceIntakeHistory(){const dialog=document.getElementById('intakeHistoryDialog');if(!dialog)return;const table=dialog.querySelector('#intakeHistoryContent table');if(!table)return;const med=currentHistoryMedication(dialog);let scopeIndex=[...table.querySelectorAll('thead th')].findIndex(th=>th.textContent.trim()==='Область изменения');if(scopeIndex<0){const headers=table.querySelectorAll('thead tr th');if(headers.length<2)return;const th=document.createElement('th');th.textContent='Область изменения';headers[1].after(th);scopeIndex=2;table.querySelectorAll('tbody tr').forEach(tr=>{const td=document.createElement('td');tr.cells[1]?.after(td);});}const headers=[...table.querySelectorAll('thead th')];const endIndex=headers.findIndex(th=>th.textContent.trim()==='Дата окончания');table.querySelectorAll('tbody tr').forEach(tr=>{const cells=[...tr.cells],at=cells[0]?.textContent||'',entry=matchEntry(med,at);const app=med?.temporalApplication;let scope='';if(entry?.scheduleScope)scope=entry.scheduleScopeLabel||SCOPE_LABELS[entry.scheduleScope]||'';else if(app?.changedAt){try{if(formatDateTime(app.changedAt)===at.trim())scope=SCOPE_LABELS[app.scope]||'';}catch(_){}}if(cells[scopeIndex]){const next=scope||'—';if(cells[scopeIndex].textContent!==next)cells[scopeIndex].textContent=next;}const isTodayOnly=(entry?.scheduleScope==='today')||(!entry?.scheduleScope&&app?.scope==='today'&&scope);if(isTodayOnly&&endIndex>=0){try{const next=formatDate(localDateFromISO(entry?.at||app.changedAt));if(cells[endIndex]&&cells[endIndex].textContent!==next)cells[endIndex].textContent=next;}catch(_){}}});}
  const observer=new MutationObserver(()=>enhanceIntakeHistory());observer.observe(document.documentElement,{subtree:true,childList:true});window.enhanceIntakeHistory=enhanceIntakeHistory;
})();