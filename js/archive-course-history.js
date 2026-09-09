(function(){
  const esc=value=>escapeHtml(String(value==null?'':value));
  const cloneTemporal=source=>({
    scheduleType:source?.scheduleType||((source?.explicitDates||[]).length?'explicit_dates':(source?.weekdays||[]).length?'weekdays':'daily'),
    weekdays:Array.isArray(source?.weekdays)?[...source.weekdays]:[],
    explicitDates:Array.isArray(source?.explicitDates)?[...source.explicitDates]:[],
    startDate:source?.startDate||'',
    endDate:source?.endDate||'',
    times:Array.isArray(source?.times)?[...source.times].filter(Boolean).sort():[]
  });
  const historyDate=entry=>{try{return localDateFromISO(entry?.at||'');}catch(_){return '';}};
  const dateFromParts=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const nextDate=date=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+1);return dateFromParts(d);};
  const weekdayCodes=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function applies(temporal,date){
    if(!temporal||!date)return false;
    const type=temporal.scheduleType||'daily';
    if(type==='explicit_dates')return (temporal.explicitDates||[]).includes(date);
    if(temporal.startDate&&date<temporal.startDate)return false;
    if(temporal.endDate&&date>temporal.endDate)return false;
    if(type==='daily')return true;
    if(type==='weekdays'){
      const d=new Date(`${date}T12:00:00`);
      return !Number.isNaN(d.getTime())&&(temporal.weekdays||[]).includes(weekdayCodes[d.getDay()]);
    }
    return false;
  }

  function scheduleEntries(med){
    return (Array.isArray(med?.rowHistory)?[...med.rowHistory]:[])
      .filter(entry=>entry&&entry.at)
      .sort((a,b)=>new Date(a.at)-new Date(b.at));
  }

  function initialTemporal(med,entries){
    const created=entries.find(entry=>entry.action==='created'&&entry.snapshot);
    if(created)return cloneTemporal(created.snapshot);
    const firstSnapshot=entries.find(entry=>entry.snapshot);
    return cloneTemporal(firstSnapshot?.snapshot||med);
  }

  function effectiveTemporalForDate(med,date){
    const entries=scheduleEntries(med);
    let persistent=initialTemporal(med,entries);
    let current=cloneTemporal(persistent);
    entries.forEach(entry=>{
      const eventDate=historyDate(entry);
      if(!eventDate||eventDate>date)return;
      if(entry.action==='created'&&entry.snapshot){
        persistent=cloneTemporal(entry.snapshot);
        current=cloneTemporal(persistent);
        return;
      }
      if(entry.action!=='edited')return;
      const scope=entry.scheduleScope||'';
      if(scope==='today'){
        if(eventDate===date&&entry.scopeTodayTemporal)current=cloneTemporal(entry.scopeTodayTemporal);
        return;
      }
      if(scope==='future'){
        if(eventDate===date){
          if(entry.scopeTodayTemporal)current=cloneTemporal(entry.scopeTodayTemporal);
        }else if(eventDate<date){
          persistent=cloneTemporal(entry.scopeFutureTemporal||entry.snapshot||persistent);
          current=cloneTemporal(persistent);
        }
        return;
      }
      if(scope==='today_future'){
        persistent=cloneTemporal(entry.scopeFutureTemporal||entry.scopeTodayTemporal||entry.snapshot||persistent);
        current=cloneTemporal(persistent);
        return;
      }
      if(entry.snapshot&&(
        Array.isArray(entry.snapshot.times)||entry.snapshot.scheduleType||
        Array.isArray(entry.snapshot.weekdays)||Array.isArray(entry.snapshot.explicitDates)
      )){
        persistent=cloneTemporal(entry.snapshot);
        current=cloneTemporal(persistent);
      }
    });
    return current;
  }

  function collectBounds(med){
    const dates=[];
    const addTemporal=source=>{
      if(!source)return;
      const t=cloneTemporal(source);
      if(t.startDate)dates.push(t.startDate);
      if(t.endDate)dates.push(t.endDate);
      (t.explicitDates||[]).forEach(d=>d&&dates.push(d));
    };
    addTemporal(med);
    scheduleEntries(med).forEach(entry=>{
      addTemporal(entry.snapshot);
      addTemporal(entry.scopeTodayTemporal);
      addTemporal(entry.scopeFutureTemporal);
      const d=historyDate(entry);if(d)dates.push(d);
    });
    const state=getState();
    (state.intakeLogs||[]).filter(x=>x.medicationId===med.id).forEach(x=>{const d=localDateFromISO(x.plannedAt);if(d)dates.push(d);});
    (state.intakeCorrections||[]).filter(x=>x.medicationId===med.id).forEach(x=>{const d=localDateFromISO(x.plannedAt);if(d)dates.push(d);});
    const clean=[...new Set(dates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    if(!clean.length)return null;
    return {start:clean[0],end:clean[clean.length-1]};
  }

  function cancellationAt(med){
    const entries=scheduleEntries(med).filter(entry=>entry.action==='cancelled');
    return entries.length?entries[0].at:null;
  }

  function effectiveLog(state,medId,plannedAt){
    const logs=(state.intakeLogs||[]).filter(x=>x.medicationId===medId&&x.plannedAt===plannedAt)
      .sort((a,b)=>new Date(a.actualAt||a.at||0)-new Date(b.actualAt||b.at||0));
    const base=logs[logs.length-1]||null;
    const corrections=(state.intakeCorrections||[]).filter(x=>x.medicationId===medId&&x.plannedAt===plannedAt)
      .sort((a,b)=>new Date(a.correctedAt||0)-new Date(b.correctedAt||0));
    if(!base)return {log:null,corrections};
    const last=corrections[corrections.length-1];
    if(last&&new Date(last.correctedAt||0)>new Date(base.actualAt||base.at||0)){
      if(last.after?.action==='reset')return {log:null,corrections};
      return {log:{...base,...last.after},corrections};
    }
    return {log:base,corrections};
  }

  function removedTodaySlots(med,set){
    scheduleEntries(med).forEach(entry=>{
      const removed=Array.isArray(entry.removedTimeValues)?entry.removedTimeValues.filter(Boolean):[];
      const d=historyDate(entry);
      if(!d||!removed.length)return;
      if(entry.scheduleScope==='today'||entry.scheduleScope==='today_future'){
        removed.forEach(time=>set.set(`${d}|${time}`,{date:d,time,forcedCancelled:true}));
      }
    });
  }

  function courseSlots(med){
    const state=getState(),set=new Map(),bounds=collectBounds(med),now=Date.now(),cancelAt=cancellationAt(med),cancelMs=cancelAt?new Date(cancelAt).getTime():null;
    if(bounds){
      let date=bounds.start,guard=0;
      while(date<=bounds.end&&guard<3660){
        const temporal=effectiveTemporalForDate(med,date);
        if(applies(temporal,date)){
          (temporal.times||[]).forEach(time=>{
            const plannedAt=getScheduledDateTime(date,time),plannedMs=new Date(plannedAt).getTime();
            const active=typeof window.isMedicationTimeActiveAt==='function'?window.isMedicationTimeActiveAt(med,time,plannedMs):true;
            if(active)set.set(`${date}|${time}`,{date,time,plannedAt,plannedMs,forcedCancelled:false});
          });
        }
        date=nextDate(date);guard++;
      }
    }
    removedTodaySlots(med,set);
    (state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&x.plannedAt).forEach(x=>{
      const date=localDateFromISO(x.plannedAt),time=(formatDateTime(x.plannedAt).split(', ')[1]||'');
      if(date&&time)set.set(`${date}|${time}`,{date,time,plannedAt:x.plannedAt,plannedMs:new Date(x.plannedAt).getTime(),forcedCancelled:false});
    });
    (state.intakeCorrections||[]).filter(x=>x.medicationId===med.id&&x.plannedAt).forEach(x=>{
      const date=localDateFromISO(x.plannedAt),time=(formatDateTime(x.plannedAt).split(', ')[1]||'');
      if(date&&time&&!set.has(`${date}|${time}`))set.set(`${date}|${time}`,{date,time,plannedAt:x.plannedAt,plannedMs:new Date(x.plannedAt).getTime(),forcedCancelled:false});
    });
    return [...set.values()].map(slot=>{
      slot.plannedAt=slot.plannedAt||getScheduledDateTime(slot.date,slot.time);
      slot.plannedMs=Number.isFinite(slot.plannedMs)?slot.plannedMs:new Date(slot.plannedAt).getTime();
      const effective=effectiveLog(state,med.id,slot.plannedAt),log=effective.log,corrections=effective.corrections||[],last=corrections[corrections.length-1]||null;
      let result='Не выполнен',actualAt=null;
      if(log?.action==='taken'){result='Принято';actualAt=log.actualAt||null;}
      else if(log?.action==='cancelled')result='Отменено';
      else if(slot.forcedCancelled)result='Отменено';
      else if(Number.isFinite(cancelMs)&&slot.plannedMs>=cancelMs)result='Отменено';
      else if(slot.plannedMs>now)result=med.cancelled?'Отменено':'Ожидается';
      const reason=last?.reason==='accident'?'Случайность':last?.reason==='error'?'Ошибка':last?'—':'';
      return {...slot,result,actualAt,correctionCount:corrections.length,lastCorrectionAt:last?.correctedAt||null,reason};
    }).sort((a,b)=>a.plannedMs-b.plannedMs);
  }

  function outcomesTable(med){
    const slots=courseSlots(med);
    if(!slots.length)return '<p class="muted">Сохранённых расчётных приёмов для этого курса нет.</p>';
    return `<table><thead><tr><th>Дата</th><th>Расчётное время</th><th>Итог</th><th>Фактическое время</th><th>Исправлений</th><th>Последнее исправление / причина</th><th>История</th></tr></thead><tbody>${slots.map(slot=>{
      const correction=slot.lastCorrectionAt?`${formatDateTime(slot.lastCorrectionAt)}${slot.reason?` — ${slot.reason}`:''}`:'—';
      return `<tr><td>${esc(formatDate(slot.date))}</td><td>${esc(slot.time)}</td><td>${esc(slot.result)}</td><td>${slot.actualAt?esc(formatDateTime(slot.actualAt)):'—'}</td><td>${slot.correctionCount}</td><td>${esc(correction)}</td><td><button type="button" onclick="showArchiveSlotHistory('${med.id}','${slot.plannedAt}')">История</button></td></tr>`;
    }).join('')}</tbody></table>`;
  }

  window.showArchiveMedicationHistory=function(id){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=document.getElementById('archiveHistoryDialog'),t=document.getElementById('archiveHistoryTitle'),c=document.getElementById('archiveHistoryContent');if(!d||!t||!c)return;
    t.textContent=`История курса «${med.name}»`;
    const rowHtml=typeof rowHistoryHtml==='function'?rowHistoryHtml(med.rowHistory||[]):'<p class="muted">История препарата недоступна.</p>';
    c.innerHTML=`<h3>История препарата</h3>${rowHtml}<h3 style="margin-top:22px">Итоги приёмов курса</h3>${outcomesTable(med)}`;
    d.showModal();
  };
})();