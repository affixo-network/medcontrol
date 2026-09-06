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
  function normalizedScheduleType(med){return med?.scheduleType||((med?.explicitDates||[]).length?'explicit_dates':(med?.weekdays||[]).length?'weekdays':'daily');}
  function baseStartDate(med){return normalizedScheduleType(med)==='daily'&&med?.startDate?formatDate(med.startDate):'—';}
  function baseEndDate(med){return normalizedScheduleType(med)==='explicit_dates'?'—':med?.endDate?formatDate(med.endDate):'—';}
  function scopeFor(med){const app=med?.temporalApplication,today=typeof currentLocalDate==='function'?currentLocalDate():'';return app&&app.date===today&&['today','future','today_future'].includes(app.scope)?app:null;}
  function diff(a,b){const other=new Set(Array.isArray(b)?b:[]);return (Array.isArray(a)?a:[]).filter(x=>!other.has(x));}
  function timeRowsForMedication(med){
    normalizeTimeStatuses(med);
    const rows=[],today=typeof currentLocalDate==='function'?currentLocalDate():'',app=scopeFor(med),baseTimes=(med.times||[]).filter(Boolean).slice().sort();
    const todayTimes=Array.isArray(app?.todayTemporal?.times)?app.todayTemporal.times.filter(Boolean).slice().sort():baseTimes.slice();
    const todayOnly=app?.scope==='today'||app?.scope==='future'?diff(todayTimes,baseTimes):[];
    const futureOnly=app?.scope==='future'?diff(baseTimes,todayTimes):[];
    baseTimes.forEach(time=>{
      if(futureOnly.includes(time))rows.push({time,status:'Только на последующие дни расписания',start:'—',end:'—',scope:'future'});
      else rows.push({time,status:currentTimeStatus(med,time)?'Активно':'Пассивно',start:baseStartDate(med),end:baseEndDate(med),scope:'base'});
    });
    todayOnly.forEach(time=>rows.push({time,status:'Только сегодня',start:today?formatDate(today):'—',end:today?formatDate(today):'—',scope:'today'}));
    return rows.sort((a,b)=>a.time.localeCompare(b.time));
  }
  function historyPlannedAt(row){return getScheduledDateTime(currentLocalDate(),row.time);}
  function stripTimeHistoryMedicationData(html){
    const box=document.createElement('div');box.innerHTML=html;const table=box.querySelector('table');if(!table)return html;
    const headers=[...table.querySelectorAll('thead th')];
    const keepNames=new Set(['Дата/время','Событие','Область изменения','Расписание','Параметры расписания','Время','Дата начала','Дата окончания','Статус','Фактическое время «Принято»','Локальное время исправления','Причина исправления']);
    const remove=[];headers.forEach((th,i)=>{if(!keepNames.has(th.textContent.trim()))remove.push(i);});
    remove.sort((a,b)=>b-a).forEach(i=>{table.querySelectorAll('tr').forEach(tr=>tr.children[i]?.remove());});
    return box.innerHTML;
  }
  window.ensureMedicationTimeStatuses=function(med){normalizeTimeStatuses(med);return med?.timeStatuses||{};};
  window.isMedicationTimeActive=function(med,time){return currentTimeStatus(med,time);};
  window.isMedicationTimeActiveAt=function(med,time,plannedMs){return timeStatusAt(med,time,plannedMs);};
  window.editMedicationTimeStatus=function(medicationId,time){const state=getState(),med=(state.medications||[]).find(item=>item.id===medicationId);if(!med)return;normalizeTimeStatuses(med);const dialog=document.getElementById('timeStatusEditDialog');if(!dialog)return;window.__timeStatusEdit={medicationId,time};dialog.querySelector('h2').textContent=`Изменить время ${time}`;dialog.querySelector('#timeStatusEditSelect').value=currentTimeStatus(med,time)?'active':'passive';dialog.showModal();};
  window.saveMedicationTimeStatus=function(){const pending=window.__timeStatusEdit,select=document.getElementById('timeStatusEditSelect');if(!pending||!select)return;if(select.value==='temporal'){document.getElementById('timeStatusEditDialog')?.close();window.__timeStatusEdit=null;openEditMedication(pending.medicationId);return;}const state=getState(),med=(state.medications||[]).find(item=>item.id===pending.medicationId);if(!med)return;normalizeTimeStatuses(med);const next=select.value==='active',current=currentTimeStatus(med,pending.time);if(next!==current){const at=nowISO();med.timeStatuses[pending.time]=next;med.timeStatusHistory.push({time:pending.time,active:next,at,action:next?'time_activated':'time_deactivated'});if(!Array.isArray(med.rowHistory))med.rowHistory=[];med.rowHistory.push({at,action:'edited',payload:`Время ${pending.time}: статус изменён на «${next?'Активно':'Пассивно'}».`,changes:{timeStatus:{time:pending.time,active:next}}});saveState(state);}document.getElementById('timeStatusEditDialog')?.close();window.__timeStatusEdit=null;mount('input');};
  window.editTemporalTimeRow=function(medicationId){openEditMedication(medicationId);};
  window.showInputTimeHistory=function(medicationId,plannedAt){const med=(getState().medications||[]).find(x=>x.id===medicationId),dialog=document.getElementById('rowHistoryDialog'),host=document.getElementById('rowHistoryContent'),title=dialog?.querySelector('h2');if(!med||!dialog||!host)return;const clock=formatDateTime(plannedAt).split(', ')[1]||'—';if(title)title.textContent=`История времени ${clock} препарата «${med.name}»`;const html=typeof window.intakeHistoryRows==='function'?window.intakeHistoryRows(medicationId,'all',plannedAt):'<p class="muted">История времени недоступна.</p>';host.innerHTML=stripTimeHistoryMedicationData(html);dialog.showModal();};
  const originalCreateMedicationFromForm=window.createMedicationFromForm;
  if(typeof originalCreateMedicationFromForm==='function')window.createMedicationFromForm=function(prefix){const item=originalCreateMedicationFromForm(prefix),state=getState(),now=nowISO();if(prefix==='create_'){item.timeStatuses={};item.timeStatusHistory=[];(item.times||[]).forEach(time=>{item.timeStatuses[time]=true;item.timeStatusHistory.push({time,active:true,at:now,action:'time_created_active'});});}else if(prefix==='edit_'){const before=(state.medications||[]).find(med=>med.id===window.__editingMedicationId),oldTimes=new Set(before?.times||[]),oldStatuses={...(before?.timeStatuses||{})},history=Array.isArray(before?.timeStatusHistory)?before.timeStatusHistory.slice():[];item.timeStatuses={};item.timeStatusHistory=history;(item.times||[]).forEach(time=>{if(oldTimes.has(time))item.timeStatuses[time]=oldStatuses[time]!==false;else{item.timeStatuses[time]=true;item.timeStatusHistory.push({time,active:true,at:now,action:'time_created_active'});}});}return item;};
  function ensureTimeDialog(){if(document.getElementById('timeStatusEditDialog'))return;const d=document.createElement('dialog');d.id='timeStatusEditDialog';d.innerHTML='<h2>Изменить время</h2><label>Изменение</label><select id="timeStatusEditSelect"><option value="active">Статус: Активно</option><option value="passive">Статус: Пассивно</option><option value="temporal">Изменить время / область применения…</option></select><p class="muted" style="margin-top:10px">Для изменения самого времени далее доступны: «Только сегодня», «Только на последующие дни расписания», «Сегодня и на последующие дни расписания».</p><div class="dialog-actions"><button type="button" onclick="saveMedicationTimeStatus()">Продолжить</button><button type="button" onclick="document.getElementById(\'timeStatusEditDialog\').close()">Закрыть</button></div>';document.body.appendChild(d);}
  function restructureInputTable(){
    const state=getState(),byOrder=new Map((state.medications||[]).filter(med=>!med.cancelled).map(med=>[String(med.order),med]));
    document.querySelectorAll('section').forEach(section=>{
      const title=section.querySelector('h2')?.textContent?.trim();if(title==='Пассивные препараты'){section.remove();return;}if(title!=='Активные препараты')return;
      const table=section.querySelector('table'),head=table?.querySelector('thead tr');if(!table||!head)return;const headers=head.querySelectorAll('th');if(headers[13])headers[13].textContent='Статус';const tbody=table.querySelector('tbody');if(!tbody)return;
      [...tbody.querySelectorAll('tr')].filter(r=>!r.dataset.timeSubrow).forEach(baseRow=>{
        const cells=baseRow.querySelectorAll('td');if(cells.length<15)return;const med=byOrder.get(cells[0].textContent.trim());if(!med)return;cells[10].textContent='—';cells[13].textContent='—';cells[14].innerHTML=`<div class="inline"><button type="button" onclick="openEditMedication('${med.id}')">Изменить</button><button type="button" onclick="showRowHistory('${med.id}')">История</button><button type="button" onclick="startMedicationCancellation('${med.id}')">Отменить</button></div>`;let anchor=baseRow;
        timeRowsForMedication(med).forEach(item=>{const tr=document.createElement('tr');tr.dataset.timeSubrow='1';tr.dataset.medicationId=med.id;const statusClass=item.status==='Активно'?'success':'upcoming';const action=item.scope==='base'?`<button type="button" onclick="editMedicationTimeStatus('${med.id}','${escapeHtml(item.time)}')">Изменить</button>`:`<button type="button" onclick="editTemporalTimeRow('${med.id}')">Изменить</button>`;const plannedAt=historyPlannedAt(item);tr.innerHTML=`<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td><strong>${escapeHtml(item.time)}</strong></td><td>${escapeHtml(item.start)}</td><td>${escapeHtml(item.end)}</td><td><span class="status ${statusClass}">${escapeHtml(item.status)}</span></td><td><div class="inline">${action}<button type="button" onclick="showInputTimeHistory('${med.id}','${plannedAt}')">История</button></div></td>`;anchor.after(tr);anchor=tr;});
      });
    });ensureTimeDialog();
  }
  const originalRenderInputPage=window.renderInputPage;if(typeof originalRenderInputPage==='function')window.renderInputPage=function(){originalRenderInputPage();restructureInputTable();};
  normalizeAll();
})();