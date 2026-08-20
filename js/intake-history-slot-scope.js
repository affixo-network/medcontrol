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

  function timeOnly(iso){
    if(!iso) return '';
    const parts=formatDateTime(iso).split(', ');
    return parts[1]||'';
  }

  function normalizedScheduleType(snapshot){
    return snapshot?.scheduleType || ((snapshot?.explicitDates||[]).length?'explicit_dates':(snapshot?.weekdays||[]).length?'weekdays':'daily');
  }

  function scheduleText(snapshot){
    const type=normalizedScheduleType(snapshot);
    return type==='daily'?'Каждый день':type==='weekdays'?'Дни недели':type==='explicit_dates'?'Даты':'—';
  }

  function scheduleParameters(snapshot){
    const type=normalizedScheduleType(snapshot);
    if(type==='daily') return 'Ежедневно';
    if(type==='weekdays'){
      const labels={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
      const order=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      return (snapshot?.weekdays||[]).slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b)).map(x=>labels[x]||x).join(', ')||'—';
    }
    if(type==='explicit_dates') return (snapshot?.explicitDates||[]).map(formatDate).join(', ')||'—';
    return '—';
  }

  function contentUnit(snapshot){
    if(typeof medicationContentUnitLabel==='function') return medicationContentUnitLabel(snapshot?.contentUnit,snapshot?.contentUnitOther||'');
    return snapshot?.contentUnit||'—';
  }

  function intakeUnit(snapshot){
    if(typeof medicationIntakeUnitLabel==='function') return medicationIntakeUnitLabel(snapshot?.intakeUnit,snapshot?.intakeUnitOther||'');
    return snapshot?.intakeUnit||'—';
  }

  function statusText(snapshot){
    if(snapshot?.cancelled) return 'Отменено';
    if(snapshot?.courseCompleted) return 'Завершён';
    return snapshot?.active?'Активно':'Пассивно';
  }

  function blankRow(at,event){
    return {
      occurredAt:at,event,
      name:'',manufacturer:'',contentValue:'',contentUnit:'',intakeQuantity:'',intakeUnit:'',details:'',
      schedule:'',scheduleParameters:'',time:'',startDate:'',endDate:'',status:'',
      actualAt:null,correctionAt:null,reason:''
    };
  }

  function fullRow(at,event,snapshot,clock){
    const row=blankRow(at,event);
    row.name=snapshot?.name||'—';
    row.manufacturer=snapshot?.manufacturer||'—';
    row.contentValue=snapshot?.contentValue||'—';
    row.contentUnit=contentUnit(snapshot);
    row.intakeQuantity=snapshot?.intakeQuantity||'—';
    row.intakeUnit=intakeUnit(snapshot);
    row.details=snapshot?.details||'—';
    row.schedule=scheduleText(snapshot);
    row.scheduleParameters=scheduleParameters(snapshot);
    row.time=clock;
    row.startDate=normalizedScheduleType(snapshot)==='daily'&&snapshot?.startDate?formatDate(snapshot.startDate):'—';
    row.endDate=normalizedScheduleType(snapshot)==='explicit_dates'?'—':snapshot?.endDate?formatDate(snapshot.endDate):'—';
    row.status=statusText(snapshot);
    return row;
  }

  function changedRow(at,before,after,changes,clock){
    const row=blankRow(at,'Изменено');
    let touched=false;
    const has=key=>Object.prototype.hasOwnProperty.call(changes||{},key);

    if(has('name')){row.name=after.name||'—';touched=true;}
    if(has('manufacturer')){row.manufacturer=after.manufacturer||'—';touched=true;}
    if(has('contentValue')){row.contentValue=after.contentValue||'—';touched=true;}
    if(has('contentUnit')||has('contentUnitOther')){row.contentUnit=contentUnit(after);touched=true;}
    if(has('intakeQuantity')){row.intakeQuantity=after.intakeQuantity||'—';touched=true;}
    if(has('intakeUnit')||has('intakeUnitOther')){row.intakeUnit=intakeUnit(after);touched=true;}
    if(has('details')){row.details=after.details||'—';touched=true;}

    if(has('scheduleType')){row.schedule=scheduleText(after);touched=true;}
    if(has('scheduleType')||has('weekdays')||has('explicitDates')){row.scheduleParameters=scheduleParameters(after);touched=true;}

    if(has('times')){
      const beforeTimes=Array.isArray(before?.times)?before.times:[];
      const afterTimes=Array.isArray(after?.times)?after.times:[];
      const beforeHas=beforeTimes.includes(clock);
      const afterHas=afterTimes.includes(clock);
      if(beforeHas!==afterHas){row.time=afterHas?clock:'—';touched=true;}
    }

    if(has('startDate')){row.startDate=after.startDate?formatDate(after.startDate):'—';touched=true;}
    if(has('endDate')){row.endDate=after.endDate?formatDate(after.endDate):'—';touched=true;}
    if(has('active')||has('cancelled')||has('courseCompleted')){row.status=statusText(after);touched=true;}

    return touched?row:null;
  }

  function medicationRowsForClock(med,clock,period){
    const entries=Array.isArray(med?.rowHistory)?[...med.rowHistory].sort((a,b)=>new Date(a.at)-new Date(b.at)):[];
    const rows=[];
    let state={};
    let clockKnown=false;

    entries.forEach(entry=>{
      const before={...state};
      const source=entry.action==='created'?(entry.snapshot||{}):(entry.changes||{});
      const after=entry.action==='created'?{...source}:{...state,...source};
      const beforeTimes=Array.isArray(before.times)?before.times:[];
      const afterTimes=Array.isArray(after.times)?after.times:[];
      const wasPresent=beforeTimes.includes(clock);
      const isPresent=afterTimes.includes(clock);

      if(!clockKnown&&isPresent){
        if(filterPeriod(entry.at,period)) rows.push(fullRow(entry.at,'Создано',after,clock));
        clockKnown=true;
      } else if(clockKnown){
        const row=changedRow(entry.at,before,after,source,clock);
        if(row&&filterPeriod(entry.at,period)) rows.push(row);
        if(wasPresent&&!isPresent) clockKnown=false;
      }

      state=after;
    });

    return rows;
  }

  function intakeRowsForClock(state,medId,clock,plannedAt,period){
    const limit=new Date(plannedAt).getTime();
    const rows=[];

    (state.intakeLogs||[])
      .filter(log=>log.medicationId===medId&&timeOnly(log.plannedAt)===clock&&new Date(log.plannedAt).getTime()<=limit)
      .forEach(log=>{
        if(!filterPeriod(log.actualAt,period)) return;
        const row=blankRow(log.actualAt,'Принято');
        row.actualAt=log.actualAt;
        rows.push(row);
      });

    (state.intakeCorrections||[])
      .filter(c=>c.medicationId===medId&&timeOnly(c.plannedAt)===clock&&new Date(c.plannedAt).getTime()<=limit)
      .forEach(c=>{
        if(!filterPeriod(c.correctedAt,period)) return;
        const base=(state.intakeLogs||[]).find(log=>log.medicationId===c.medicationId&&log.plannedAt===c.plannedAt&&(!c.primaryLogId||log.id===c.primaryLogId));
        const row=blankRow(c.correctedAt,'Отмена «Принято»');
        row.actualAt=c.before?.actualAt||base?.actualAt||null;
        row.correctionAt=c.correctedAt;
        row.reason=c.reason==='accident'?'Случайность':c.reason==='error'?'Ошибка':'—';
        rows.push(row);
      });

    return rows;
  }

  function cell(value){
    if(value===null||value===undefined||value==='') return '—';
    return escapeHtml(value);
  }

  function historyTable(rows,clock){
    const sorted=[...rows].sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
    if(!sorted.length) return `<p class="muted">В выбранном периоде событий для расчётного времени ${escapeHtml(clock)} нет.</p>`;

    return `<table><thead><tr>
      <th>Дата/время</th><th>Событие</th><th>Препарат</th><th>Производитель</th><th>Количественное содержание</th><th>Единица содержания</th><th>Количество приёма</th><th>Единица приёма</th><th>Детали</th><th>Расписание</th><th>Параметры расписания</th><th>Время</th><th>Дата начала</th><th>Дата окончания</th><th>Статус</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th>
    </tr></thead><tbody>${sorted.map(row=>`<tr>
      <td>${cell(formatDateTime(row.occurredAt))}</td><td>${cell(row.event)}</td><td>${cell(row.name)}</td><td>${cell(row.manufacturer)}</td><td>${cell(row.contentValue)}</td><td>${cell(row.contentUnit)}</td><td>${cell(row.intakeQuantity)}</td><td>${cell(row.intakeUnit)}</td><td>${cell(row.details)}</td><td>${cell(row.schedule)}</td><td>${cell(row.scheduleParameters)}</td><td>${cell(row.time)}</td><td>${cell(row.startDate)}</td><td>${cell(row.endDate)}</td><td>${cell(row.status)}</td><td>${row.actualAt?cell(formatDateTime(row.actualAt)):'—'}</td><td>${row.correctionAt?cell(formatDateTime(row.correctionAt)):'—'}</td><td>${cell(row.reason)}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  window.intakeHistoryRows=function(medId,period,plannedAt){
    if(!plannedAt) return typeof baseRows==='function'?baseRows(medId,period):'';
    const state=getState();
    const med=(state.medications||[]).find(item=>item.id===medId);
    const clock=timeOnly(plannedAt);
    return historyTable([
      ...medicationRowsForClock(med,clock,period),
      ...intakeRowsForClock(state,medId,clock,plannedAt,period)
    ],clock);
  };

  window.showIntakeHistory=function(medicationId,plannedAt){
    window.__historyMedicationId=medicationId;
    window.__historyPlannedAt=plannedAt||null;
    refreshIntakeHistory();
    const dialog=document.getElementById('intakeHistoryDialog');
    const med=(getState().medications||[]).find(item=>item.id===medicationId);
    if(dialog) dialog.classList.add('row-history-dialog');
    const title=dialog?.querySelector('h2');
    if(title&&med){
      title.textContent=plannedAt?`История приёма препарата «${med.name}» — расчётное время ${timeOnly(plannedAt)}`:`История приёма препарата «${med.name}»`;
    }
    dialog?.showModal();
  };

  window.refreshIntakeHistory=function(){
    const medicationId=window.__historyMedicationId;
    if(!medicationId) return;
    const period=document.getElementById('historyPeriodSelect')?.value||'today';
    const content=document.getElementById('intakeHistoryContent');
    if(content) content.innerHTML=window.intakeHistoryRows(medicationId,period,window.__historyPlannedAt||null);
  };

  function bindHistoryButtons(){
    const state=getState();
    document.querySelectorAll('table tbody tr').forEach(row=>{
      const button=[...row.querySelectorAll('button')].find(btn=>btn.textContent.trim()==='История');
      if(!button) return;
      const cells=[...row.children];
      const orderText=cells[0]?.textContent.trim();
      const med=(state.medications||[]).find(item=>String(item.order)===String(orderText));
      if(!med) return;
      const dateCell=cells.find(td=>/^\d{2}\.\d{2}\.\d{4}$/.test(td.textContent.trim()));
      const timeCell=cells.find(td=>/^\d{2}:\d{2}$/.test(td.textContent.trim()));
      if(!dateCell||!timeCell) return;
      const [dd,mm,yyyy]=dateCell.textContent.trim().split('.');
      const plannedAt=getScheduledDateTime(`${yyyy}-${mm}-${dd}`,timeCell.textContent.trim());
      button.onclick=function(event){event.preventDefault();event.stopPropagation();window.showIntakeHistory(med.id,plannedAt);};
    });
  }

  function scheduleBind(){setTimeout(bindHistoryButtons,0);setTimeout(bindHistoryButtons,100);setTimeout(bindHistoryButtons,500);}
  const renderAction=window.renderActionPage;
  if(typeof renderAction==='function'){window.renderActionPage=function(){const result=renderAction.apply(this,arguments);scheduleBind();return result;};}
  const renderDashboard=window.renderDashboardPage;
  if(typeof renderDashboard==='function'){window.renderDashboardPage=function(){const result=renderDashboard.apply(this,arguments);scheduleBind();return result;};}
  document.addEventListener('DOMContentLoaded',scheduleBind);
})();
