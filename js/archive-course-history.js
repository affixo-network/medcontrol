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

  window.medControlArchiveCourseSlots=courseSlots;
  window.dispatchEvent(new Event('medcontrolArchiveCourseSlotsReady'));

  function periodCutoff(period){
    if(period==='all')return null;
    const today=currentLocalDate();
    const d=new Date(today+'T12:00:00');
    if(period==='today')return today;
    const days=period==='30'?30:7;
    d.setDate(d.getDate()-(days-1));
    return dateFromParts(d);
  }

  function inPeriod(date,period){
    if(!date)return false;
    const cutoff=periodCutoff(period);
    if(!cutoff)return true;
    const today=currentLocalDate();
    return date>=cutoff&&date<=today;
  }

  function historyEventLabel(entry){
    if(entry?.action==='created')return 'Создано';
    if(entry?.action==='course_completed')return 'Курс завершён';
    if(entry?.action==='cancelled')return 'Отменено';
    if(entry?.action==='activated'||entry?.action==='active')return 'Препарат активирован';
    if(entry?.action==='deactivated'||entry?.action==='passive')return 'Препарат деактивирован';
    if(entry?.action==='edited')return 'Изменено';
    return typeof rowHistoryActionLabel==='function'?rowHistoryActionLabel(entry?.action):String(entry?.action||'Событие');
  }

  function intakeStatusForSlot(med,slot){
    const state=getState();
    const logs=(state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&x.plannedAt===slot.plannedAt)
      .sort((a,b)=>new Date(a.actualAt||a.at||0)-new Date(b.actualAt||b.at||0));
    const log=logs[logs.length-1]||null;
    if(slot.result!=='Принято')return slot.result;
    const code=log?.status||(typeof computeStatusForLog==='function'&&slot.actualAt?computeStatusForLog(slot.plannedAt,slot.actualAt,log?.action):'');
    return typeof statusLabel==='function'&&code?statusLabel(code):(code||'Принято');
  }

  function scheduleLabel(source){
    const type=source?.scheduleType||((source?.explicitDates||[]).length?'explicit_dates':(source?.weekdays||[]).length?'weekdays':'daily');
    return type==='weekdays'?'Дни недели':type==='explicit_dates'?'Даты':'Каждый день';
  }

  function scheduleParameters(source){
    const type=source?.scheduleType||((source?.explicitDates||[]).length?'explicit_dates':(source?.weekdays||[]).length?'weekdays':'daily');
    const start=source?.startDate?formatDate(source.startDate):'';
    const end=source?.endDate?formatDate(source.endDate):'';
    const range=start||end?`${start||'—'} → ${end||'—'}`:'—';
    if(type==='weekdays'){
      const names={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
      const days=(source?.weekdays||[]).map(x=>names[x]||x).join(', ')||'—';
      return `${days}; ${range}`;
    }
    if(type==='explicit_dates')return (source?.explicitDates||[]).map(x=>formatDate(x)).join(', ')||'—';
    return range;
  }

  function contentText(source){
    const value=source?.contentValue||'';
    const unit=typeof medicationContentUnitLabel==='function'
      ? medicationContentUnitLabel(source?.contentUnit,source?.contentUnitOther||'')
      : (source?.contentUnitOther||source?.contentUnit||'');
    return [value,unit].filter(Boolean).join(' ')||'—';
  }

  function intakeText(source){
    const value=source?.intakeQuantity||'';
    const unit=typeof medicationIntakeUnitLabel==='function'
      ? medicationIntakeUnitLabel(source?.intakeUnit,source?.intakeUnitOther||'')
      : (source?.intakeUnitOther||source?.intakeUnit||'');
    return [value,unit].filter(Boolean).join(' ')||'—';
  }

  function courseDataForEntry(med,entry){
    const created=entry.action==='created';
    const source=created?(entry.snapshot||entry.changes||med):(entry.changes||{});
    const has=key=>created||Object.prototype.hasOwnProperty.call(source,key);
    return {
      manufacturer:has('manufacturer')?(source.manufacturer||'—'):'',
      content:(has('contentValue')||has('contentUnit')||has('contentUnitOther'))?contentText(created?source:{...med,...source}):'',
      intake:(has('intakeQuantity')||has('intakeUnit')||has('intakeUnitOther'))?intakeText(created?source:{...med,...source}):'',
      schedule:has('scheduleType')?scheduleLabel(created?source:{...med,...source}):'',
      params:(has('scheduleType')||has('weekdays')||has('explicitDates')||has('startDate')||has('endDate'))?scheduleParameters(created?source:{...med,...source}):'',
      times:has('times')?(source.times||[]).join(', '):'',
      detail:has('details')?(source.details||'—'):''
    };
  }

  function unifiedCourseJournal(med,period){
    const rows=[];

    scheduleEntries(med).forEach(entry=>{
      const date=historyDate(entry);
      if(entry.action!=='created'&&!inPeriod(date,period))return;
      const input=courseDataForEntry(med,entry);
      rows.push({
        sortAt:new Date(entry.at||0).getTime()||0,
        when:entry.at?formatDateTime(entry.at):'—',
        event:historyEventLabel(entry),
        planned:'',
        actual:'',
        status:'',
        corrections:'',
        ...input
      });
    });

    courseSlots(med).forEach(slot=>{
      if(!inPeriod(slot.date,period))return;
      const correction=slot.lastCorrectionAt
        ? `${formatDateTime(slot.lastCorrectionAt)}${slot.reason?` — ${slot.reason}`:''}`
        : '';
      rows.push({
        sortAt:slot.plannedMs||new Date(slot.plannedAt||0).getTime()||0,
        when:slot.plannedAt?formatDateTime(slot.plannedAt):formatDate(slot.date),
        event:'Расчётный приём',
        manufacturer:'',
        content:'',
        intake:'',
        schedule:'',
        params:'',
        times:'',
        detail:correction,
        planned:slot.plannedAt?formatDateTime(slot.plannedAt):`${formatDate(slot.date)}, ${slot.time}`,
        actual:slot.actualAt?formatDateTime(slot.actualAt):'—',
        status:intakeStatusForSlot(med,slot),
        corrections:String(slot.correctionCount||0)
      });
    });

    rows.sort((a,b)=>a.sortAt-b.sortAt);
    if(!rows.length)return '<p class="muted">За выбранный период записей нет.</p>';

    const cell=value=>esc(value||'');
    return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Производитель</th><th>Содержание</th><th>Приём</th><th>Расписание</th><th>Параметры расписания</th><th>Время</th><th>Детали</th><th>Расчётное время</th><th>Фактическое время</th><th>Статус / итог</th><th>Исправлений</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${cell(row.when)}</td><td>${cell(row.event)}</td><td>${cell(row.manufacturer)}</td><td>${cell(row.content)}</td><td>${cell(row.intake)}</td><td>${cell(row.schedule)}</td><td>${cell(row.params)}</td><td>${cell(row.times)}</td><td>${cell(row.detail)}</td><td>${cell(row.planned)}</td><td>${cell(row.actual)}</td><td>${cell(row.status)}</td><td>${cell(row.corrections)}</td></tr>`).join('')}</tbody></table>`;
  }

  function courseHistoryPeriodSelector(period){
    return `<div class="inline" style="margin-bottom:14px"><label>Период</label><select id="archiveCourseHistoryPeriod" onchange="setArchiveCourseHistoryPeriod(this.value)"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div>`;
  }

  window.renderArchiveCourseJournal=function(){
    const id=window.__archiveCourseHistoryMedicationId;
    const med=(getState().medications||[]).find(x=>x.id===id);
    const host=document.getElementById('archiveHistoryContent');
    if(!med||!host)return;
    const period=window.__archiveCourseHistoryPeriod||'7';
    host.innerHTML=courseHistoryPeriodSelector(period)+unifiedCourseJournal(med,period);
    const select=document.getElementById('archiveCourseHistoryPeriod');
    if(select)select.value=period;
  };

  window.setArchiveCourseHistoryPeriod=function(period){
    window.__archiveCourseHistoryPeriod=period||'7';
    window.renderArchiveCourseJournal?.();
  };

  window.showArchiveMedicationHistory=function(id){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=document.getElementById('archiveHistoryDialog'),t=document.getElementById('archiveHistoryTitle');if(!d||!t)return;
    window.__archiveCourseHistoryMedicationId=id;
    window.__archiveCourseHistoryPeriod='7';
    t.textContent=`История курса «${med.name}»`;
    window.renderArchiveCourseJournal();
    d.showModal();
  };
})();