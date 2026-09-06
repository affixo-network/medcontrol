(function(){
  const GENERAL_KEYS=['name','manufacturer','contentValue','contentUnit','contentUnitOther','intakeQuantity','intakeUnit','intakeUnitOther','details'];
  const SCOPE_LABELS={daily:'Ежедневно',today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  const PERIODS={today:'Сегодня','7':'7 дней','30':'30 дней',all:'Весь период'};

  function esc(v){return escapeHtml(v===undefined||v===null||v===''?'—':String(v));}
  function localDate(iso){try{return localDateFromISO(iso);}catch(_){return '';}}
  function formatSchedule(source){const type=source?.scheduleType||((source?.explicitDates||[]).length?'explicit_dates':(source?.weekdays||[]).length?'weekdays':'daily');return type==='daily'?'Каждый день':type==='weekdays'?'Дни недели':'Даты';}
  function createdEntry(med){return (med.rowHistory||[]).find(e=>e?.action==='created')||null;}
  function createdSnapshot(med){return createdEntry(med)?.snapshot||med;}
  function periodCutoff(period){if(period==='all')return null;const d=new Date();d.setHours(0,0,0,0);if(period==='7')d.setDate(d.getDate()-6);if(period==='30')d.setDate(d.getDate()-29);return d.getTime();}
  function inPeriod(at,period){const cut=periodCutoff(period);return cut===null||new Date(at).getTime()>=cut;}
  function periodSelector(id,fn,current){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="${id}" onchange="${fn}">${Object.entries(PERIODS).map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')}</select></div>`;}

  function currentScopeForTime(med,time){const list=(med.timeStatusHistory||[]).filter(x=>x?.time===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));const last=list[list.length-1];return last?.scope||'daily';}
  function timeActiveAt(med,time,plannedMs){
    const plannedDate=localDate(new Date(plannedMs).toISOString());
    let active=true;
    const list=(med.timeStatusHistory||[]).filter(x=>x?.time===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
    if(!list.length&&med.timeStatuses&&typeof med.timeStatuses[time]==='boolean')active=med.timeStatuses[time];
    list.forEach(item=>{
      const atMs=new Date(item.at||0).getTime();if(Number.isFinite(atMs)&&atMs>plannedMs)return;
      const scope=item.scope||'daily',changeDate=item.date||localDate(item.at);
      if(scope==='daily'||scope==='today_future')active=Boolean(item.active);
      else if(scope==='today'&&plannedDate===changeDate)active=Boolean(item.active);
      else if(scope==='future'&&plannedDate>changeDate)active=Boolean(item.active);
    });
    return active;
  }
  window.isMedicationTimeActiveAt=function(med,time,plannedMs){return timeActiveAt(med,time,plannedMs);};
  window.isMedicationTimeActive=function(med,time){return timeActiveAt(med,time,Date.now());};

  function generalFieldLabel(key){return {manufacturer:'Производитель',contentValue:'Количественное содержание',contentUnit:'Единица содержания',contentUnitOther:'Единица содержания',intakeQuantity:'Количество приёма',intakeUnit:'Единица приёма',intakeUnitOther:'Единица приёма',details:'Детали',name:'Препарат'}[key]||key;}
  function contentUnit(source){return medicationContentUnitLabel(source?.contentUnit,source?.contentUnitOther||'');}
  function intakeUnit(source){return medicationIntakeUnitLabel(source?.intakeUnit,source?.intakeUnitOther||'');}

  window.openEditMedication=function(id){
    window.__editingMedicationId=id;
    const med=(getState().medications||[]).find(x=>x.id===id),dialog=document.getElementById('editDialog'),host=document.getElementById('editDialogContent');if(!med||!dialog||!host||med.cancelled)return;
    dialog.querySelector('h2').textContent='Изменить данные препарата';
    host.innerHTML=`<div class="form-grid">
      <div><label>Препарат *</label><input id="general_name" value="${esc(med.name||'')}"></div>
      <div><label>Производитель</label><input id="general_manufacturer" value="${esc(med.manufacturer||'')}"></div>
      <div><label>Количественное содержание *</label><input id="general_contentValue" type="number" min="0" step="any" value="${esc(med.contentValue||'')}"></div>
      <div><label>Единица содержания *</label><select id="general_contentUnit"><option value="mcg">мкг</option><option value="mg">мг</option><option value="g">г</option><option value="kg">кг</option><option value="ml">мл</option><option value="l">л</option><option value="%">%</option><option value="mg/ml">мг/мл</option><option value="mcg/ml">мкг/мл</option><option value="mg/g">мг/г</option><option value="IU">МЕ</option><option value="unit">ед.</option><option value="other">Другое</option></select></div>
      <div><label>Количество приёма *</label><input id="general_intakeQuantity" type="number" min="0" step="any" value="${esc(med.intakeQuantity||'')}"></div>
      <div><label>Единица приёма *</label><select id="general_intakeUnit"><option value="tablet">таблетка</option><option value="capsule">капсула</option><option value="ml">мл</option><option value="drop">капля</option><option value="teaspoon">чайная ложка</option><option value="tablespoon">столовая ложка</option><option value="dose">доза</option><option value="puff">впрыск</option><option value="ampoule">ампула</option><option value="vial">флакон</option><option value="packet">пакет</option><option value="sachet">саше</option><option value="suppository">суппозиторий</option><option value="patch">пластырь</option><option value="injection">инъекция</option><option value="unit">единица</option><option value="other">Другое</option></select></div>
      <div class="full"><label>Детали *</label><textarea id="general_details">${esc(med.details||'')}</textarea></div>
      <div class="full right"><button type="button" onclick="saveMedicationGeneralEdit('${med.id}')">Сохранить</button><button type="button" onclick="document.getElementById('editDialog').close()">Закрыть</button></div>
    </div>`;
    document.getElementById('general_contentUnit').value=med.contentUnit||'mg';document.getElementById('general_intakeUnit').value=med.intakeUnit||'tablet';dialog.showModal();
  };

  window.saveMedicationGeneralEdit=function(id){
    const state=getState(),med=(state.medications||[]).find(x=>x.id===id);if(!med||med.cancelled)return;
    const updated={name:document.getElementById('general_name')?.value.trim()||'',manufacturer:document.getElementById('general_manufacturer')?.value.trim()||'',contentValue:document.getElementById('general_contentValue')?.value.trim()||'',contentUnit:document.getElementById('general_contentUnit')?.value||'',intakeQuantity:document.getElementById('general_intakeQuantity')?.value.trim()||'',intakeUnit:document.getElementById('general_intakeUnit')?.value||'',details:document.getElementById('general_details')?.value.trim()||''};
    if(!updated.name||!updated.contentValue||!updated.contentUnit||!updated.intakeQuantity||!updated.intakeUnit||!updated.details){alert('Заполните обязательные данные препарата.');return;}
    const changes={};GENERAL_KEYS.forEach(k=>{if(Object.prototype.hasOwnProperty.call(updated,k)&&String(med[k]??'')!==String(updated[k]??''))changes[k]=updated[k];});
    if(!Object.keys(changes).length){document.getElementById('editDialog')?.close();return;}
    Object.assign(med,updated);med.dose=`${med.intakeQuantity} ${med.intakeUnit==='other'?(med.intakeUnitOther||''):med.intakeUnit}`;
    if(!Array.isArray(med.rowHistory))med.rowHistory=[];med.rowHistory.push({at:nowISO(),action:'edited',changes,payload:'Изменены данные препарата.'});saveState(state);document.getElementById('editDialog')?.close();mount('input');
  };

  function renderGeneralHistory(med,period){
    const rows=[];const created=createdEntry(med),snap=created?.snapshot||med;if(created&&inPeriod(created.at,period))rows.push({at:created.at,event:'Создано',s:snap});
    (med.rowHistory||[]).filter(e=>e?.action==='edited'&&inPeriod(e.at,period)).forEach(e=>{const c=e.changes||{};if(c.timeStatus||e.scheduleScope||Object.keys(c).some(k=>['times','scheduleType','weekdays','explicitDates','startDate','endDate','active'].includes(k)))return;const general={};GENERAL_KEYS.forEach(k=>{if(Object.prototype.hasOwnProperty.call(c,k))general[k]=c[k];});if(Object.keys(general).length)rows.push({at:e.at,event:'Изменено',s:general});});
    if(!rows.length)return '<p class="muted">В выбранном периоде изменений данных препарата нет.</p>';
    return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Производитель</th><th>Количественное содержание</th><th>Единица содержания</th><th>Количество приёма</th><th>Единица приёма</th><th>Детали</th></tr></thead><tbody>${rows.sort((a,b)=>new Date(a.at)-new Date(b.at)).map(r=>`<tr><td>${esc(formatDateTime(r.at))}</td><td>${r.event}</td><td>${esc(r.s.manufacturer)}</td><td>${esc(r.s.contentValue)}</td><td>${Object.prototype.hasOwnProperty.call(r.s,'contentUnit')?esc(contentUnit(r.s)):'—'}</td><td>${esc(r.s.intakeQuantity)}</td><td>${Object.prototype.hasOwnProperty.call(r.s,'intakeUnit')?esc(intakeUnit(r.s)):'—'}</td><td>${esc(r.s.details)}</td></tr>`).join('')}</tbody></table>`;
  }
  window.showRowHistory=function(id){window.__rowHistoryMedicationId=id;window.__rowHistoryPeriod='all';const med=(getState().medications||[]).find(x=>x.id===id),dialog=document.getElementById('rowHistoryDialog');if(!med||!dialog)return;dialog.querySelector('h2').textContent=`История препарата «${med.name}»`;refreshGeneralMedicationHistory();dialog.showModal();};
  window.refreshGeneralMedicationHistory=function(){const med=(getState().medications||[]).find(x=>x.id===window.__rowHistoryMedicationId),host=document.getElementById('rowHistoryContent');if(!med||!host)return;const p=document.getElementById('generalHistoryPeriod')?.value||window.__rowHistoryPeriod||'all';window.__rowHistoryPeriod=p;host.innerHTML=periodSelector('generalHistoryPeriod','refreshGeneralMedicationHistory()',p)+renderGeneralHistory(med,p);};

  function timeHistoryEntries(med,time){
    const rows=[];const created=createdEntry(med),snap=createdSnapshot(med);if(created&&(snap.times||[]).includes(time))rows.push({at:created.at,event:'Создано',scope:'daily',active:true,schedule:formatSchedule(snap),start:snap.startDate?formatDate(snap.startDate):'—',end:snap.endDate?formatDate(snap.endDate):'—'});
    const seen=new Set();
    (med.timeStatusHistory||[]).filter(x=>x?.time===time).forEach(x=>{const key=`${x.at}|${x.active}|${x.scope||'daily'}`;if(seen.has(key))return;seen.add(key);rows.push({at:x.at,event:'Изменено',scope:x.scope||'daily',active:Boolean(x.active),schedule:formatSchedule(med),start:(x.scope==='today'&&x.date)?formatDate(x.date):'—',end:(x.scope==='today'&&x.date)?formatDate(x.date):'—'});});
    (med.rowHistory||[]).filter(e=>e?.changes?.timeStatus?.time===time).forEach(e=>{const t=e.changes.timeStatus,key=`${e.at}|${t.active}|${t.scope||e.scheduleScope||'daily'}`;if(seen.has(key))return;seen.add(key);const scope=t.scope||e.scheduleScope||'daily',date=t.date||localDate(e.at);rows.push({at:e.at,event:'Изменено',scope,active:Boolean(t.active),schedule:formatSchedule(med),start:scope==='today'?formatDate(date):'—',end:scope==='today'?formatDate(date):'—'});});
    return rows.sort((a,b)=>new Date(a.at)-new Date(b.at));
  }
  function renderTimeHistory(med,time,period){const rows=timeHistoryEntries(med,time).filter(r=>inPeriod(r.at,period));if(!rows.length)return '<p class="muted">В выбранном периоде изменений этого времени нет.</p>';return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Расписание</th><th>Параметры расписания</th><th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(formatDateTime(r.at))}</td><td>${r.event}</td><td>${esc(r.schedule)}</td><td>${esc(SCOPE_LABELS[r.scope]||'Ежедневно')}</td><td>${esc(r.start)}</td><td>${esc(r.end)}</td><td>${r.active?'Активно':'Пассивно'}</td></tr>`).join('')}</tbody></table>`;}
  window.showInputTimeHistory=function(id,plannedAt){const med=(getState().medications||[]).find(x=>x.id===id),dialog=document.getElementById('rowHistoryDialog');if(!med||!dialog)return;const time=formatDateTime(plannedAt).split(', ')[1]||'';window.__timeHistory={id,time,period:'all'};dialog.querySelector('h2').textContent=`История времени ${time} препарата «${med.name}»`;refreshInputTimeHistory();dialog.showModal();};
  window.refreshInputTimeHistory=function(){const ctx=window.__timeHistory,med=(getState().medications||[]).find(x=>x.id===ctx?.id),host=document.getElementById('rowHistoryContent');if(!ctx||!med||!host)return;const p=document.getElementById('timeHistoryPeriod')?.value||ctx.period||'all';ctx.period=p;host.innerHTML=periodSelector('timeHistoryPeriod','refreshInputTimeHistory()',p)+renderTimeHistory(med,ctx.time,p);};

  function ensureTimeDialog(){let d=document.getElementById('timeStatusEditDialog');if(!d){d=document.createElement('dialog');d.id='timeStatusEditDialog';document.body.appendChild(d);}return d;}
  window.editMedicationTimeStatus=function(id,time){const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;const d=ensureTimeDialog(),scope=currentScopeForTime(med,time),active=timeActiveAt(med,time,Date.now());window.__timeEdit={id,time};d.innerHTML=`<h2>Изменить время ${esc(time)}</h2><div class="form-grid"><div><label>Статус</label><select id="timeEditStatus"><option value="active" ${active?'selected':''}>Активно</option><option value="passive" ${!active?'selected':''}>Пассивно</option></select></div><div><label>Параметры расписания</label><select id="timeEditScope"><option value="daily" ${scope==='daily'?'selected':''}>Ежедневно</option><option value="today" ${scope==='today'?'selected':''}>Только сегодня</option><option value="future" ${scope==='future'?'selected':''}>Только на последующие дни расписания</option><option value="today_future" ${scope==='today_future'?'selected':''}>Сегодня и на последующие дни расписания</option></select></div><div class="full right"><button type="button" onclick="saveSeparatedTimeEdit()">Сохранить</button><button type="button" onclick="document.getElementById('timeStatusEditDialog').close()">Закрыть</button></div></div>`;d.showModal();};
  window.saveSeparatedTimeEdit=function(){const ctx=window.__timeEdit,state=getState(),med=(state.medications||[]).find(x=>x.id===ctx?.id);if(!ctx||!med)return;const active=document.getElementById('timeEditStatus')?.value==='active',scope=document.getElementById('timeEditScope')?.value||'daily',at=nowISO(),date=currentLocalDate();if(!Array.isArray(med.timeStatusHistory))med.timeStatusHistory=[];med.timeStatusHistory.push({time:ctx.time,active,scope,date,at,action:active?'time_activated':'time_deactivated'});if(scope==='daily'||scope==='today_future') {med.timeStatuses=med.timeStatuses||{};med.timeStatuses[ctx.time]=active;}if(!Array.isArray(med.rowHistory))med.rowHistory=[];med.rowHistory.push({at,action:'edited',changes:{timeStatus:{time:ctx.time,active,scope,date}},payload:`Изменено время ${ctx.time}.`});saveState(state);document.getElementById('timeStatusEditDialog')?.close();mount('input');};

  function enhanceInputRows(){const state=getState();document.querySelectorAll('tr[data-time-subrow="1"]').forEach(tr=>{const med=(state.medications||[]).find(m=>m.id===tr.dataset.medicationId),cells=tr.querySelectorAll('td');if(!med||cells.length<15)return;const time=cells[10].textContent.trim();const scope=currentScopeForTime(med,time),last=(med.timeStatusHistory||[]).filter(x=>x.time===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0)).pop();const active=last?Boolean(last.active):timeActiveAt(med,time,Date.now());cells[9].textContent=SCOPE_LABELS[scope]||'Ежедневно';cells[13].innerHTML=`<span class="status ${active?'success':'upcoming'}">${active?'Активно':'Пассивно'}</span>`;if(scope==='today'&&last?.date){cells[11].textContent=formatDate(last.date);cells[12].textContent=formatDate(last.date);}});}
  const prevRender=window.renderInputPage;if(typeof prevRender==='function')window.renderInputPage=function(){prevRender();enhanceInputRows();};
})();