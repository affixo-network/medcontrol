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
  function reasonLabel(reason){ return reason==='accident'?'Случайность':reason==='error'?'Ошибка':'—'; }
  function timeOnly(iso){
    if(!iso) return '';
    const parts=formatDateTime(iso).split(', ');
    return parts[1]||'';
  }
  function dateOnly(iso){
    if(!iso) return '';
    const parts=formatDateTime(iso).split(', ');
    return parts[0]||'';
  }
  function scheduleLabel(type){
    if(type==='daily') return 'Каждый день';
    if(type==='weekdays') return 'Дни недели';
    if(type==='explicit_dates') return 'Даты';
    return type||'—';
  }
  function weekdaysLabel(values){
    const labels={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
    const order=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return (Array.isArray(values)?values:[]).slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b)).map(x=>labels[x]||x).join(', ');
  }
  function diffList(before,after){
    const a=Array.isArray(before)?before:[];
    const b=Array.isArray(after)?after:[];
    return {added:b.filter(x=>!a.includes(x)),removed:a.filter(x=>!b.includes(x))};
  }

  function slotMedicationHistory(med,plannedAt,period){
    const clock=timeOnly(plannedAt);
    const entries=Array.isArray(med?.rowHistory)?[...med.rowHistory].sort((a,b)=>new Date(a.at)-new Date(b.at)):[];
    if(!entries.length) return '<p class="muted">Изменений, влияющих на выбранный приём, пока нет.</p>';

    const rows=[];
    let previous=null;
    entries.forEach(entry=>{
      const current=entry.snapshot||{};
      const before=previous||{};
      const details=[];
      let relevant=false;

      if(entry.action==='created'){
        if((current.times||[]).includes(clock)){
          relevant=true;
          details.push(`Создано назначение на ${clock}`);
          details.push(`Расписание: ${scheduleLabel(current.scheduleType)}`);
          if(current.scheduleType==='weekdays'&&current.weekdays?.length) details.push(`Дни: ${weekdaysLabel(current.weekdays)}`);
          if(current.startDate) details.push(`Начало: ${formatDate(current.startDate)}`);
          if(current.endDate) details.push(`Окончание: ${formatDate(current.endDate)}`);
        }
      }else{
        const timeDiff=diffList(before.times,current.times);
        if(timeDiff.added.includes(clock)){relevant=true;details.push(`Добавлено время ${clock}`);}
        if(timeDiff.removed.includes(clock)){relevant=true;details.push(`Удалено время ${clock}`);}

        if(before.scheduleType!==current.scheduleType){
          relevant=true;
          details.push(`Расписание: ${scheduleLabel(before.scheduleType)} → ${scheduleLabel(current.scheduleType)}`);
        }
        if(JSON.stringify(before.weekdays||[])!==JSON.stringify(current.weekdays||[])){
          relevant=true;
          details.push(`Дни недели: ${weekdaysLabel(before.weekdays)||'—'} → ${weekdaysLabel(current.weekdays)||'—'}`);
        }
        if(JSON.stringify(before.explicitDates||[])!==JSON.stringify(current.explicitDates||[])){
          relevant=true;
          const oldDates=(before.explicitDates||[]).map(formatDate).join(', ')||'—';
          const newDates=(current.explicitDates||[]).map(formatDate).join(', ')||'—';
          details.push(`Даты: ${oldDates} → ${newDates}`);
        }
        const fields=[
          ['manufacturer','Производитель'],['contentValue','Количественное содержание'],['contentUnit','Единица содержания'],
          ['intakeQuantity','Количество приёма'],['intakeUnit','Единица приёма'],['details','Детали'],
          ['startDate','Дата начала'],['endDate','Дата окончания'],['active','Статус'],['cancelled','Отмена']
        ];
        fields.forEach(([field,label])=>{
          if(String(before[field]??'')===String(current[field]??'')) return;
          relevant=true;
          let oldValue=before[field]??'—';
          let newValue=current[field]??'—';
          if(field==='startDate'||field==='endDate'){
            oldValue=before[field]?formatDate(before[field]):'—';
            newValue=current[field]?formatDate(current[field]):'—';
          }
          if(field==='active'){
            oldValue=before[field]?'Активно':'Пассивно';
            newValue=current[field]?'Активно':'Пассивно';
          }
          if(field==='cancelled'){
            oldValue=before[field]?'Отменено':'Не отменено';
            newValue=current[field]?'Отменено':'Не отменено';
          }
          details.push(`${label}: ${oldValue} → ${newValue}`);
        });
      }

      if(relevant&&filterPeriod(entry.at,period)){
        rows.push(`<tr><td>${escapeHtml(formatDateTime(entry.at))}</td><td>${escapeHtml(entry.action==='created'?'Создано':'Изменено')}</td><td>${escapeHtml(details.join('; '))}</td></tr>`);
      }
      previous=current;
    });

    return rows.length
      ? `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Изменение для ${escapeHtml(clock)}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : `<p class="muted">В выбранном периоде изменений, влияющих на время ${escapeHtml(clock)}, нет.</p>`;
  }

  function eventsForSlot(state,medId,plannedAt,period){
    const events=[];
    (state.intakeLogs||[])
      .filter(log=>log.medicationId===medId&&log.plannedAt===plannedAt)
      .forEach(log=>events.push({occurredAt:log.actualAt,event:'Принято',actualAt:log.actualAt,correctionAt:null,reason:null}));
    (state.intakeCorrections||[])
      .filter(c=>c.medicationId===medId&&c.plannedAt===plannedAt)
      .forEach(c=>{
        const base=(state.intakeLogs||[]).find(log=>log.medicationId===c.medicationId&&log.plannedAt===c.plannedAt&&(!c.primaryLogId||log.id===c.primaryLogId));
        events.push({occurredAt:c.correctedAt,event:'Отмена «Принято»',actualAt:c.before?.actualAt||base?.actualAt||null,correctionAt:c.correctedAt,reason:reasonLabel(c.reason)});
      });
    return events.filter(event=>filterPeriod(event.occurredAt,period)).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
  }

  function eventTable(events,emptyText){
    if(!events.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
    return `<table><thead><tr><th>Время события</th><th>Событие</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${events.map(event=>`<tr><td>${escapeHtml(formatDateTime(event.occurredAt))}</td><td>${escapeHtml(event.event)}</td><td>${event.actualAt?escapeHtml(formatDateTime(event.actualAt)):'—'}</td><td>${event.correctionAt?escapeHtml(formatDateTime(event.correctionAt)):'—'}</td><td>${event.reason?escapeHtml(event.reason):'—'}</td></tr>`).join('')}</tbody></table>`;
  }

  function sameClockHistory(state,medId,plannedAt,period){
    const clock=timeOnly(plannedAt);
    const selectedMs=new Date(plannedAt).getTime();
    const slots=[...new Set([
      ...(state.intakeLogs||[]).filter(x=>x.medicationId===medId).map(x=>x.plannedAt),
      ...(state.intakeCorrections||[]).filter(x=>x.medicationId===medId).map(x=>x.plannedAt)
    ].filter(Boolean))]
      .filter(slot=>timeOnly(slot)===clock&&slot!==plannedAt&&new Date(slot).getTime()<selectedMs)
      .sort((a,b)=>new Date(a)-new Date(b));
    const blocks=slots.map(slot=>{
      const events=eventsForSlot(state,medId,slot,period);
      if(!events.length) return '';
      return `<section style="margin-top:16px"><h4>${escapeHtml(formatDateTime(slot))}</h4>${eventTable(events,'Событий нет.')}</section>`;
    }).filter(Boolean);
    return blocks.length?blocks.join(''):`<p class="muted">Предыдущих событий для времени ${escapeHtml(clock)} в выбранном периоде нет.</p>`;
  }

  window.intakeHistoryRows=function(medId,period,plannedAt){
    if(!plannedAt) return typeof baseRows==='function'?baseRows(medId,period):'';
    const state=getState();
    const med=(state.medications||[]).find(item=>item.id===medId);
    const selectedEvents=eventsForSlot(state,medId,plannedAt,period);
    const selectedLabel=`${dateOnly(plannedAt)} ${timeOnly(plannedAt)}`;
    const currentEmpty=`Для расчётного приёма ${selectedLabel} событий «Принято»/исправлений пока нет.`;

    return `<h3>Изменения, влияющие на выбранное время ${escapeHtml(timeOnly(plannedAt))}</h3>${slotMedicationHistory(med,plannedAt,period)}<h3 style="margin-top:18px">История выбранного расчётного приёма — ${escapeHtml(selectedLabel)}</h3>${eventTable(selectedEvents,currentEmpty)}<h3 style="margin-top:18px">Предыдущие события для времени ${escapeHtml(timeOnly(plannedAt))}</h3>${sameClockHistory(state,medId,plannedAt,period)}`;
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
