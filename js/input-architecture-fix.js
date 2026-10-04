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

  // Keep the full medication editor from medications.js active.
  // This architecture layer must not replace it with a reduced general-fields-only dialog.

  function renderGeneralHistory(med,period){
    const rows=[],created=createdEntry(med),snap=created?.snapshot||med;
    const week={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
    const scheduleName=s=>s?.scheduleType==='weekdays'?'Дни недели':s?.scheduleType==='explicit_dates'?'Даты':'Каждый день';
    const scheduleParams=s=>s?.scheduleType==='weekdays'?(s.weekdays||[]).map(x=>week[x]||x).join(', ')||'—':s?.scheduleType==='explicit_dates'?(s.explicitDates||[]).map(formatDate).join(', ')||'—':'Ежедневно';
    const state=s=>({manufacturer:s?.manufacturer||'',contentValue:s?.contentValue||'',contentUnit:s?.contentUnit||'',contentUnitOther:s?.contentUnitOther||'',intakeQuantity:s?.intakeQuantity||'',intakeUnit:s?.intakeUnit||'',intakeUnitOther:s?.intakeUnitOther||'',details:s?.details||'',scheduleType:s?.scheduleType||'daily',weekdays:[...(s?.weekdays||[])],explicitDates:[...(s?.explicitDates||[])],times:[...(s?.times||[])],startDate:s?.startDate||'',endDate:s?.endDate||'',active:s?.active!==false});
    const blank=()=>({manufacturer:0,contentValue:0,contentUnit:0,intakeQuantity:0,intakeUnit:0,details:0,schedule:0,params:0,times:0,timeMask:[],startDate:0,endDate:0,status:0});
    let current=state(snap);
    if(created&&inPeriod(created.at,period))rows.push({at:created.at,event:'Создано',s:state(current),show:{manufacturer:1,contentValue:1,contentUnit:1,intakeQuantity:1,intakeUnit:1,details:1,schedule:1,params:1,times:1,timeMask:'all',startDate:1,endDate:1,status:1}});
    (med.rowHistory||[]).filter(e=>e&&e!==created&&inPeriod(e.at,period)).sort((a,b)=>new Date(a.at)-new Date(b.at)).forEach(e=>{
      const c=e.changes||{},show=blank(),beforeTimes=[...(current.times||[])];
      if(e.action==='cancelled'){current.active=false;show.status=1;rows.push({at:e.at,event:'Отменено',s:state(current),show});return;}
      if(e.action!=='edited')return;
      show.manufacturer='manufacturer'in c; show.contentValue='contentValue'in c;
      show.contentUnit='contentUnit'in c||'contentUnitOther'in c; show.intakeQuantity='intakeQuantity'in c;
      show.intakeUnit='intakeUnit'in c||'intakeUnitOther'in c; show.details='details'in c;
      show.schedule='scheduleType'in c; show.params='weekdays'in c||'explicitDates'in c;
      show.times='times'in c||Boolean(c.timeStatus); show.startDate='startDate'in c; show.endDate='endDate'in c; show.status='active'in c;
      Object.keys(c).forEach(k=>{if(k==='timeStatus'||k==='times')return;current[k]=Array.isArray(c[k])?[...c[k]]:c[k];});
      if(Object.prototype.hasOwnProperty.call(c,'times')){
        const desired=[...new Set((c.times||[]).filter(Boolean))].sort();
        const slots=[...(current.times||[])];
        const active=slots.filter(Boolean);
        const removed=active.filter(t=>!desired.includes(t));
        const added=desired.filter(t=>!active.includes(t));
        const pairs=Math.min(removed.length,added.length);
        for(let i=0;i<pairs;i++){const pos=slots.indexOf(removed[i]);if(pos>=0)slots[pos]=added[i];}
        for(let i=pairs;i<removed.length;i++){const pos=slots.indexOf(removed[i]);if(pos>=0)slots[pos]=null;}
        for(let i=pairs;i<added.length;i++)slots.push(added[i]);
        current.times=slots;
      }
      if(c.timeStatus){
        const x=c.timeStatus,t=[...(current.times||[])],oldTime=x.oldTime||x.time||'',newTime=x.newTime||x.time||'';
        if(x.deleted){const i=t.indexOf(oldTime);if(i>=0)t[i]=null;}
        else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){const i=t.indexOf(x.oldTime);if(i>=0)t[i]=x.newTime;}
        current.times=t;
      }
      if(show.times){const afterTimes=[...(current.times||[])],n=Math.max(beforeTimes.length,afterTimes.length);show.timeMask=Array.from({length:n},(_,i)=>beforeTimes[i]!==afterTimes[i]);}
      if(show.schedule&&!show.params)show.params=1;
      rows.push({at:e.at,event:'Изменено',s:state(current),show});
    });
    if(!rows.length)return '<p class="muted">В выбранном периоде изменений данных препарата нет.</p>';
    const maxTimes=Math.max(1,...rows.map(r=>r.s.times.length)),timeHeaders=Array.from({length:maxTimes},(_,i)=>`<th>Время ${i+1}</th>`).join('');
    const cv=(flag,v)=>flag?esc(v):'';
    return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Производитель</th><th>Количественное содержание</th><th>Единица содержания</th><th>Количество приёма</th><th>Единица приёма</th><th>Детали</th><th>Расписание</th><th>Параметры расписания</th>${timeHeaders}<th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${rows.map(r=>{const tc=Array.from({length:maxTimes},(_,i)=>`<td>${r.show.times&&(r.show.timeMask==='all'||r.show.timeMask?.[i])?esc(r.s.times[i]||'—'):''}</td>`).join('');return `<tr><td>${esc(formatDateTime(r.at))}</td><td>${esc(r.event)}</td><td>${cv(r.show.manufacturer,r.s.manufacturer)}</td><td>${cv(r.show.contentValue,r.s.contentValue)}</td><td>${cv(r.show.contentUnit,contentUnit(r.s))}</td><td>${cv(r.show.intakeQuantity,r.s.intakeQuantity)}</td><td>${cv(r.show.intakeUnit,intakeUnit(r.s))}</td><td>${cv(r.show.details,r.s.details)}</td><td>${cv(r.show.schedule,scheduleName(r.s))}</td><td>${cv(r.show.params,scheduleParams(r.s))}</td>${tc}<td>${r.show.startDate?(r.s.startDate?esc(formatDate(r.s.startDate)):'—'):''}</td><td>${r.show.endDate?(r.s.endDate?esc(formatDate(r.s.endDate)):'—'):''}</td><td>${r.show.status?(r.s.active?'Активно':'Пассивно'):''}</td></tr>`;}).join('')}</tbody></table>`;
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