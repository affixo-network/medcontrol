(function(){
  function ensureCorrectionState(state){
    if(!Array.isArray(state.intakeCorrections)) state.intakeCorrections=[];
    return state;
  }
  function primaryLog(medicationId,plannedAt){
    return (getState().intakeLogs||[]).find(log=>log.medicationId===medicationId&&log.plannedAt===plannedAt)||null;
  }
  function corrections(medicationId,plannedAt){
    const state=ensureCorrectionState(getState());
    return state.intakeCorrections.filter(item=>item.medicationId===medicationId&&item.plannedAt===plannedAt).sort((a,b)=>new Date(a.correctedAt)-new Date(b.correctedAt));
  }
  function effectiveLog(medicationId,plannedAt){
    const base=primaryLog(medicationId,plannedAt);
    if(!base) return null;
    const list=corrections(medicationId,plannedAt);
    const last=list[list.length-1];
    if(!last) return {...base,correctionCount:0,primaryActualAt:base.actualAt};
    return {...base,...last.after,correctionCount:list.length,primaryActualAt:base.actualAt,lastCorrection:last};
  }
  window.getLogForSchedule=function(medicationId,plannedAt){return effectiveLog(medicationId,plannedAt)};

  function endOfLocalDay(dateISO){
    const end=getScheduledDateTime(dateISO,'23:59');
    return new Date(end).getTime()+59000;
  }
  function correctionDeadline(medicationId,plannedAt){
    const med=(getState().medications||[]).find(item=>item.id===medicationId);
    if(!med) return null;
    const dateISO=localDateFromISO(plannedAt);
    const plannedMs=new Date(plannedAt).getTime();
    const sameDay=(med.times||[]).filter(Boolean).map(time=>({time,ms:new Date(getScheduledDateTime(dateISO,time)).getTime()})).filter(slot=>slot.ms>plannedMs).sort((a,b)=>a.ms-b.ms);
    return sameDay.length?sameDay[0].ms:endOfLocalDay(dateISO);
  }
  function canCorrectNow(medicationId,plannedAt){
    if(localDateFromISO(plannedAt)!==currentLocalDate()) return false;
    const log=primaryLog(medicationId,plannedAt);
    if(!log||log.action!=='taken') return false;
    const deadline=correctionDeadline(medicationId,plannedAt);
    return Number.isFinite(deadline)&&Date.now()<deadline;
  }
  window.canCorrectIntakeNow=canCorrectNow;

  window.markTaken=function(medicationId,plannedAt){
    const state=ensureCorrectionState(getState());
    if(primaryLog(medicationId,plannedAt)){
      alert('Приём уже зафиксирован. Для изменения используйте отдельную кнопку «Исправить».');
      return;
    }
    const actualAt=nowISO();
    state.intakeLogs.push({id:uid(),medicationId,plannedAt,actualAt,action:'taken',status:computeStatusForLog(plannedAt,actualAt,'taken')});
    saveState(state);
    mount('action');
  };

  function fmtDeadline(ms){return formatDateTime(new Date(ms).toISOString())}
  window.openCorrection=function(medicationId,plannedAt){
    const base=primaryLog(medicationId,plannedAt);
    if(!base){alert('Сначала необходимо зафиксировать «Принято».');return;}
    if(!canCorrectNow(medicationId,plannedAt)){
      const deadline=correctionDeadline(medicationId,plannedAt);
      alert(`Окно исправления закрыто.${deadline?`\nГраница исправления: ${fmtDeadline(deadline)}.`:''}`);
      return;
    }
    const current=effectiveLog(medicationId,plannedAt);
    const count=current?.correctionCount||0;
    const deadline=correctionDeadline(medicationId,plannedAt);
    const dialog=document.getElementById('correctionDialog');
    const content=document.getElementById('correctionContent');
    if(!dialog||!content) return;
    content.innerHTML=`<div class="form-grid">
      <div class="full"><p><strong>Количество предыдущих исправлений: ${count}</strong></p><p class="muted">Исправление доступно до ${escapeHtml(fmtDeadline(deadline))}. Первоначальная запись не удаляется.</p></div>
      <div><label>Причина исправления</label><select id="correction_reason"><option value="">Выберите</option><option value="accident">Случайность</option><option value="error">Ошибка</option></select></div>
      <div><label>Фактическое время приёма</label><input id="correction_time" type="datetime-local" value="${escapeHtml((current.actualAt||base.actualAt).slice(0,16))}"></div>
      <div class="full right"><button onclick="applyCorrection('${medicationId}','${plannedAt}')">Подтвердить исправление</button> <button onclick="document.getElementById('correctionDialog').close()">Закрыть</button></div>
    </div>`;
    dialog.showModal();
  };

  window.applyCorrection=function(medicationId,plannedAt){
    if(!canCorrectNow(medicationId,plannedAt)){alert('Окно исправления уже закрыто.');return;}
    const reason=document.getElementById('correction_reason')?.value||'';
    const localValue=document.getElementById('correction_time')?.value||'';
    if(!reason){alert('Выберите причину: «Случайность» или «Ошибка».');return;}
    if(!localValue){alert('Укажите фактическое время приёма.');return;}
    const state=ensureCorrectionState(getState());
    const before=effectiveLog(medicationId,plannedAt);
    if(!before) return;
    const actualAt=new Date(localValue).toISOString();
    const after={actualAt,action:'taken',status:computeStatusForLog(plannedAt,actualAt,'taken')};
    const list=corrections(medicationId,plannedAt);
    const label=reason==='accident'?'Случайность':'Ошибка';
    const message=`Запись уже исправлялась ${list.length} раз(а).\n\nПричина: ${label}\nБыло: ${formatDateTime(before.actualAt)}\nСтанет: ${formatDateTime(actualAt)}\n\nПодтвердить?`;
    if(!window.confirm(message)) return;
    state.intakeCorrections.push({id:uid(),medicationId,plannedAt,primaryLogId:primaryLog(medicationId,plannedAt)?.id||null,ordinal:list.length+1,reason,correctedAt:nowISO(),before:{actualAt:before.actualAt,action:'taken',status:before.status},after});
    saveState(state);
    document.getElementById('correctionDialog')?.close();
    mount('action');
  };

  function approvedStatus(log){
    if(!log) return '—';
    return log.action==='taken'?'Принято':log.action==='cancelled'?'Отменен':'—';
  }
  function reasonLabel(reason){return reason==='accident'?'Случайность':reason==='error'?'Ошибка':reason||'—'}
  window.intakeHistoryRows=function(medId,period){
    const state=ensureCorrectionState(getState());
    let logs=(state.intakeLogs||[]).filter(log=>log.medicationId===medId);
    const now=Date.now();
    logs=logs.filter(log=>{
      if(period==='all') return true;
      const t=new Date(log.actualAt).getTime();
      if(period==='today') return localDateFromISO(log.actualAt)===currentLocalDate();
      if(period==='7') return t>=now-7*86400000;
      if(period==='30') return t>=now-30*86400000;
      return true;
    }).sort((a,b)=>new Date(b.actualAt)-new Date(a.actualAt));
    if(!logs.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
    const primaryRows=logs.map(log=>{const eff=effectiveLog(log.medicationId,log.plannedAt)||log;return `<tr><td>${escapeHtml(formatDateTime(log.plannedAt))}</td><td>${escapeHtml(formatDateTime(log.actualAt))}</td><td>${escapeHtml(formatDateTime(eff.actualAt))}</td><td>${escapeHtml(approvedStatus(eff))}</td><td>${eff.correctionCount||0}</td></tr>`}).join('');
    const relevant=state.intakeCorrections.filter(c=>c.medicationId===medId).sort((a,b)=>new Date(b.correctedAt)-new Date(a.correctedAt));
    const correctionTable=relevant.length?`<h3 style="margin-top:18px">Исправления</h3><table><thead><tr><th>№</th><th>Время исправления</th><th>Причина</th><th>Было</th><th>Стало</th></tr></thead><tbody>${relevant.map(c=>`<tr><td>${c.ordinal}</td><td>${escapeHtml(formatDateTime(c.correctedAt))}</td><td>${escapeHtml(reasonLabel(c.reason))}</td><td>${escapeHtml(formatDateTime(c.before.actualAt))}</td><td>${escapeHtml(formatDateTime(c.after.actualAt))}</td></tr>`).join('')}</tbody></table>`:'';
    return `<table><thead><tr><th>Расчётное время</th><th>Первоначальное фактическое время</th><th>Текущее фактическое время</th><th>Статус</th><th>Количество исправлений</th></tr></thead><tbody>${primaryRows}</tbody></table>${correctionTable}`;
  };

  function duration(ms){let t=Math.max(0,Math.floor(ms/1000)),d=Math.floor(t/86400);t%=86400;let h=Math.floor(t/3600);t%=3600;let m=Math.floor(t/60),s=t%60;return `${d} дн. ${String(h).padStart(2,'0')} ч. ${String(m).padStart(2,'0')} мин. ${String(s).padStart(2,'0')} сек.`}
  function fixedTiming(item){
    if(item.status==='waiting') return `<strong>До времени приёма осталось</strong><br>${escapeHtml(duration(item.countdownMs||0))}`;
    if(item.status==='missed') return `<strong>Опоздание</strong><br>${escapeHtml(duration(item.countdownMs||0))}`;
    if(item.status==='taken'&&item.actualAt&&item.plannedMs){const diff=new Date(item.actualAt).getTime()-item.plannedMs;if(Math.abs(diff)<1000)return '<strong>Принято вовремя</strong>';return diff>0?`<strong>Принято позже на</strong><br>${escapeHtml(duration(diff))}`:`<strong>Принято раньше на</strong><br>${escapeHtml(duration(-diff))}`;}
    return '—';
  }
  function statusText(s){return({waiting:'Ожидается',missed:'Не выполнен',taken:'Принято',cancelled:'Отменен'})[s]||s}
  function statusCss(s){return s==='waiting'?'status expected':s==='missed'?'status overdue':s==='taken'?'status success':s==='cancelled'?'status upcoming':'status'}
  const originalBuild=window.buildMedControlTimeline;
  if(typeof originalBuild==='function'){
    window.buildMedControlTimeline=function(){return originalBuild().map(item=>{if(!item.plannedAt)return {...item,correctionCount:0};const eff=effectiveLog(item.medication.id,item.plannedAt);return {...item,actualAt:eff?.actualAt||item.actualAt,correctionCount:eff?.correctionCount||0,canCorrect:canCorrectNow(item.medication.id,item.plannedAt)};});};
  }

  window.renderActionPage=function(){
    const rows=buildMedControlTimeline().map(x=>{const takeDisabled=x.status==='taken'||x.status==='cancelled';const correctDisabled=!x.canCorrect;const take=x.status==='cancelled'?'':`<button ${takeDisabled?'disabled':''} onclick="markTaken('${x.medication.id}','${x.plannedAt}')">Принято</button>`;const fix=x.status==='cancelled'?'':`<button ${correctDisabled?'disabled':''} onclick="openCorrection('${x.medication.id}','${x.plannedAt}')">Исправить</button>`;return `<tr><td>${x.medication.order}</td><td>${escapeHtml(x.medication.name)}</td><td>${escapeHtml(x.medication.dose)}</td><td>${escapeHtml(formatDate(x.plannedDate))}</td><td>${escapeHtml(x.plannedTime)}</td><td><span class="${statusCss(x.status)}">${escapeHtml(statusText(x.status))}</span></td><td>${x.actualAt?escapeHtml(formatDateTime(x.actualAt)):'—'}</td><td>${x.correctionCount||0}</td><td>${take} ${fix}</td><td><button onclick="showIntakeHistory('${x.medication.id}')">История</button></td></tr>`}).join('');
    const body=`<section class="card"><h1>MedControl — Приём препаратов</h1><p>В разделе фиксируется фактический приём препарата. «Принято» и «Исправить» являются независимыми действиями.</p></section><section class="card"><h2>Фиксация приёма</h2><table><thead><tr><th>Строка</th><th>Препарат</th><th>Доза</th><th>Дата приёма</th><th>Расчётное время</th><th>Статус</th><th>Фактическое время приёма</th><th>Количество исправлений</th><th>Действия</th><th>История</th></tr></thead><tbody>${rows||'<tr><td colspan="10">Нет записей</td></tr>'}</tbody></table></section><dialog id="intakeHistoryDialog"><h2>История</h2><div class="inline" style="margin-bottom:12px"><label>Период</label><select id="historyPeriodSelect" onchange="refreshIntakeHistory()"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div><div id="intakeHistoryContent"></div><div class="right" style="margin-top:14px"><button onclick="document.getElementById('intakeHistoryDialog').close()">Закрыть</button></div></dialog><dialog id="correctionDialog"><h2>Исправить</h2><div id="correctionContent"></div></dialog>`;
    document.body.innerHTML=appShell('MedControl — Приём препаратов','action',body);scheduleClock();
  };

  window.renderDashboardPage=function(){
    const rows=buildMedControlTimeline().map(x=>`<tr><td>${x.medication.order}</td><td>${escapeHtml(x.medication.name)}</td><td>${escapeHtml(x.medication.intakeQuantity||'—')}</td><td>${escapeHtml(x.medication.intakeUnit||'—')}</td><td>${escapeHtml(formatDate(x.plannedDate))}</td><td>${escapeHtml(x.plannedTime)}</td><td>${fixedTiming(x)}</td><td>${x.actualAt?escapeHtml(formatDateTime(x.actualAt)):'—'}</td><td><span class="${statusCss(x.status)}">${escapeHtml(statusText(x.status))}</span></td><td>${x.correctionCount?`<button onclick="showIntakeHistory('${x.medication.id}')">${x.correctionCount}</button>`:'0'}</td></tr>`).join('');
    const body=`<section class="card"><h1>MedControl — Табло</h1><p>Текущая временная картина приёма препаратов обновляется онлайн. После «Принято» онлайн-счёт останавливается и показывает зафиксированное отклонение.</p></section><section class="card"><table><thead><tr><th rowspan="3">№</th><th colspan="5">Введённые расчётные данные</th><th rowspan="3">Временной отсчёт</th><th colspan="3">Фактический приём препаратов</th></tr><tr><th rowspan="2">Название препарата</th><th colspan="2">Доза</th><th colspan="2">Запланированный приём</th><th rowspan="2">Время приёма</th><th rowspan="2">Статус</th><th rowspan="2">Исправлений</th></tr><tr><th>Количество приёма</th><th>Единица приёма</th><th>Дата</th><th>Время</th></tr></thead><tbody>${rows||'<tr><td colspan="10">Нет записей</td></tr>'}</tbody></table></section><dialog id="intakeHistoryDialog"><h2>История</h2><div id="intakeHistoryContent"></div><div class="right"><button onclick="document.getElementById('intakeHistoryDialog').close()">Закрыть</button></div></dialog>`;
    document.body.innerHTML=appShell('MedControl — Табло','dashboard',body);scheduleClock();setTimeout(()=>mount('dashboard'),1000);
  };
})();
