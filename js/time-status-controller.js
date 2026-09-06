(function(){
  function normalizeTimeStatuses(med){
    if(!med)return false;
    const times=(med.times||[]).filter(Boolean);
    let changed=false;
    if(!med.timeStatuses||typeof med.timeStatuses!=='object'||Array.isArray(med.timeStatuses)){med.timeStatuses={};changed=true;}
    if(!Array.isArray(med.timeStatusHistory)){med.timeStatusHistory=[];changed=true;}
    times.forEach(time=>{if(typeof med.timeStatuses[time]!=='boolean'){med.timeStatuses[time]=true;changed=true;}});
    Object.keys(med.timeStatuses).forEach(time=>{if(!times.includes(time)){delete med.timeStatuses[time];changed=true;}});
    return changed;
  }
  function normalizeAll(){const state=getState();let changed=false;(state.medications||[]).forEach(med=>{if(normalizeTimeStatuses(med))changed=true;});if(changed)saveState(state);}
  function currentTimeStatus(med,time){normalizeTimeStatuses(med);return med.timeStatuses?.[time]!==false;}
  function timeStatusAt(med,time,plannedMs){const history=(med?.timeStatusHistory||[]).filter(item=>item&&item.time===time).map(item=>({item,ms:new Date(item.at||0).getTime()})).filter(x=>Number.isFinite(x.ms)&&x.ms<=plannedMs).sort((a,b)=>a.ms-b.ms);let active=true;history.forEach(x=>{if(typeof x.item.active==='boolean')active=x.item.active;});return active;}
  window.ensureMedicationTimeStatuses=function(med){normalizeTimeStatuses(med);return med?.timeStatuses||{};};
  window.isMedicationTimeActive=function(med,time){return currentTimeStatus(med,time);};
  window.isMedicationTimeActiveAt=function(med,time,plannedMs){return timeStatusAt(med,time,plannedMs);};
  window.toggleMedicationTimeStatus=function(medicationId,time){const state=getState();const med=(state.medications||[]).find(item=>item.id===medicationId);if(!med||med.cancelled)return;normalizeTimeStatuses(med);if(!(med.times||[]).includes(time))return;const next=!currentTimeStatus(med,time),at=nowISO();med.timeStatuses[time]=next;med.timeStatusHistory.push({time,active:next,at,action:next?'time_activated':'time_deactivated'});if(!Array.isArray(med.rowHistory))med.rowHistory=[];med.rowHistory.push({at,action:'edited',payload:`Время ${time}: статус изменён на «${next?'Активно':'Пассивно'}».`,changes:{timeStatus:{time,active:next}}});saveState(state);mount('input');};
  const originalCreateMedicationFromForm=window.createMedicationFromForm;
  if(typeof originalCreateMedicationFromForm==='function')window.createMedicationFromForm=function(prefix){const item=originalCreateMedicationFromForm(prefix),state=getState(),now=nowISO();if(prefix==='create_'){item.timeStatuses={};item.timeStatusHistory=[];(item.times||[]).forEach(time=>{item.timeStatuses[time]=true;item.timeStatusHistory.push({time,active:true,at:now,action:'time_created_active'});});}else if(prefix==='edit_'){const before=(state.medications||[]).find(med=>med.id===window.__editingMedicationId),oldTimes=new Set(before?.times||[]),oldStatuses={...(before?.timeStatuses||{})},history=Array.isArray(before?.timeStatusHistory)?before.timeStatusHistory.slice():[];item.timeStatuses={};item.timeStatusHistory=history;(item.times||[]).forEach(time=>{if(oldTimes.has(time))item.timeStatuses[time]=oldStatuses[time]!==false;else{item.timeStatuses[time]=true;item.timeStatusHistory.push({time,active:true,at:now,action:'time_created_active'});}});}return item;};
  function decorateInputTimeStatuses(){
    const state=getState(),byOrder=new Map((state.medications||[]).filter(med=>!med.cancelled).map(med=>[String(med.order),med]));
    document.querySelectorAll('section').forEach(section=>{
      const title=section.querySelector('h2')?.textContent?.trim();
      if(title==='Пассивные препараты'){section.remove();return;}
      if(title!=='Активные препараты')return;
      section.querySelectorAll('tbody tr').forEach(row=>{const cells=row.querySelectorAll('td');if(cells.length<15)return;const med=byOrder.get(cells[0].textContent.trim());if(!med)return;normalizeTimeStatuses(med);cells[10].innerHTML=(med.times||[]).filter(Boolean).map(time=>{const active=currentTimeStatus(med,time);return `<div class="inline" style="margin-bottom:6px;white-space:nowrap"><strong>${escapeHtml(time)}</strong><span class="status ${active?'success':'upcoming'}">${active?'Активно':'Пассивно'}</span><button type="button" onclick="toggleMedicationTimeStatus('${med.id}','${escapeHtml(time)}')">${active?'Сделать пассивным':'Активировать'}</button></div>`;}).join('')||'—';});
    });
  }
  const originalRenderInputPage=window.renderInputPage;if(typeof originalRenderInputPage==='function')window.renderInputPage=function(){originalRenderInputPage();decorateInputTimeStatuses();};
  normalizeAll();
})();