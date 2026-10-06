(function(){
  function ensureState(){
    const s=getState();
    if(!Array.isArray(s.intakeCorrections)) s.intakeCorrections=[];
    if(!Array.isArray(s.intakeLogs)) s.intakeLogs=[];
    return s;
  }

  function primary(medicationId,plannedAt){
    return (ensureState().intakeLogs||[])
      .filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt)
      .sort((a,b)=>new Date(b.actualAt||0)-new Date(a.actualAt||0))[0]||null;
  }

  function corrections(medicationId,plannedAt){
    return (ensureState().intakeCorrections||[])
      .filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt)
      .sort((a,b)=>new Date(a.correctedAt||0)-new Date(b.correctedAt||0));
  }

  function label(reason){
    return reason==='accident'?'Случайность':reason==='error'?'Ошибка':'—';
  }

  window.openCorrection=function(medicationId,plannedAt){
    const base=primary(medicationId,plannedAt);
    if(!base){alert('Сначала необходимо зафиксировать «Принято».');return;}
    if(typeof window.canCorrectIntakeNow==='function'&&!window.canCorrectIntakeNow(medicationId,plannedAt)){
      alert('Окно исправления закрыто.');return;
    }

    const dialog=document.getElementById('correctionDialog');
    const content=document.getElementById('correctionContent');
    if(!dialog||!content) return;

    const all=corrections(medicationId,plannedAt);
    const last=all[all.length-1];
    const currentActual=(last?.after?.action==='taken'&&last.after.actualAt)?last.after.actualAt:base.actualAt;
    const count=all.length;

    content.innerHTML=`<div class="form-grid">
      <div class="full"><p><strong>Количество предыдущих исправлений: ${count}</strong></p><p class="muted">Первоначальная запись «Принято» сохраняется в истории.</p></div>
      <div><label>Расчётное время приёма</label><input type="text" value="${escapeHtml(formatDateTime(plannedAt))}" readonly></div>
      <div><label>Текущее фактическое время «Принято»</label><input type="text" value="${escapeHtml(formatDateTime(currentActual))}" readonly></div>
      <div><label>Причина исправления</label><select id="correction_reason" onchange="window.syncCorrectionMode()"><option value="">Выберите</option><option value="accident">Случайность</option><option value="error">Ошибка</option></select></div>
      <div id="correction_time_wrap" style="display:none"><label>Исправленное фактическое время</label><input id="correction_time" type="datetime-local"></div>
      <div id="correction_hint" class="full muted">Выберите причину исправления.</div>
      <div class="full right"><button onclick="applyCorrection('${medicationId}','${plannedAt}')">Подтвердить исправление</button> <button onclick="document.getElementById('correctionDialog').close()">Закрыть</button></div>
    </div>`;
    dialog.showModal();
  };

  window.syncCorrectionMode=function(){
    const reason=document.getElementById('correction_reason')?.value||'';
    const wrap=document.getElementById('correction_time_wrap');
    const hint=document.getElementById('correction_hint');
    if(!wrap||!hint)return;
    if(reason==='accident'){
      wrap.style.display='none';
      hint.textContent='Случайность: ошибочная фиксация «Принято» будет снята. Первоначальная запись останется в истории.';
    }else if(reason==='error'){
      wrap.style.display='block';
      hint.textContent='Ошибка: исправляется фактическое время приёма. Статус «Принято» сохраняется, первоначальная запись остаётся в истории.';
    }else{
      wrap.style.display='none';
      hint.textContent='Выберите причину исправления.';
    }
  };

  window.applyCorrection=function(medicationId,plannedAt){
    const reason=document.getElementById('correction_reason')?.value||'';
    if(reason!=='accident'&&reason!=='error'){
      alert('Выберите причину: «Случайность» или «Ошибка».');return;
    }

    const s=ensureState();
    const base=primary(medicationId,plannedAt);
    if(!base) return;
    const all=corrections(medicationId,plannedAt);
    const last=all[all.length-1];
    const beforeActual=(last?.after?.action==='taken'&&last.after.actualAt)?last.after.actualAt:base.actualAt;
    const ordinal=all.length+1;
    const correctedAt=nowISO();

    if(reason==='accident'){
      if(!window.confirm(`Исправление №${ordinal}.\n\nПричина: Случайность.\nДействие «Принято» будет отменено.\nФактическое время исходной фиксации сохранится в истории.\n\nПодтвердить?`)) return;
      s.intakeCorrections.push({
        id:uid(),medicationId,plannedAt,primaryLogId:base.id||null,ordinal,reason,correctedAt,
        before:{actualAt:beforeActual,action:'taken',status:base.status},
        after:{actualAt:null,action:'reset',status:null}
      });
    }else{
      const localValue=document.getElementById('correction_time')?.value||'';
      if(!localValue){alert('Укажите исправленное фактическое время приёма.');return;}
      const actualAt=new Date(localValue).toISOString();
      if(!window.confirm(`Исправление №${ordinal}.\n\nПричина: Ошибка.\nБыло: ${formatDateTime(beforeActual)}\nСтанет: ${formatDateTime(actualAt)}\n\nПодтвердить?`)) return;
      s.intakeCorrections.push({
        id:uid(),medicationId,plannedAt,primaryLogId:base.id||null,ordinal,reason,correctedAt,
        before:{actualAt:beforeActual,action:'taken',status:base.status},
        after:{actualAt,action:'taken',status:computeStatusForLog(plannedAt,actualAt,'taken')}
      });
    }

    saveState(s);
    document.getElementById('correctionDialog')?.close();
    mount('action');
  };

  window.intakeHistoryRows=function(medId,period){
    const s=ensureState();
    const now=Date.now();
    const events=[];

    (s.intakeLogs||[])
      .filter(log=>log.medicationId===medId)
      .forEach(log=>{
        events.push({
          occurredAt:log.actualAt,
          event:'Принято',
          plannedAt:log.plannedAt,
          actualAt:log.actualAt,
          correctionAt:null,
          reason:null
        });
      });

    (s.intakeCorrections||[])
      .filter(c=>c.medicationId===medId)
      .forEach(c=>{
        const base=(s.intakeLogs||[]).find(log=>
          log.medicationId===c.medicationId &&
          log.plannedAt===c.plannedAt &&
          (!c.primaryLogId || log.id===c.primaryLogId)
        );
        events.push({
          occurredAt:c.correctedAt,
          event:c.reason==='error'?'Исправление времени':'Отмена «Принято»',
          plannedAt:c.plannedAt,
          actualAt:c.before?.actualAt || base?.actualAt || null,
          correctionAt:c.correctedAt,
          reason:label(c.reason)
        });
      });

    const filtered=events.filter(event=>{
      if(period==='all') return true;
      const t=new Date(event.occurredAt).getTime();
      if(period==='today') return localDateFromISO(event.occurredAt)===currentLocalDate();
      if(period==='7') return t>=now-7*86400000;
      if(period==='30') return t>=now-30*86400000;
      return true;
    }).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));

    if(!filtered.length) return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;

    const rows=filtered.map(event=>`<tr>
      <td>${escapeHtml(formatDateTime(event.occurredAt))}</td>
      <td>${escapeHtml(event.event)}</td>
      <td>${escapeHtml(formatDateTime(event.plannedAt))}</td>
      <td>${event.actualAt?escapeHtml(formatDateTime(event.actualAt)):'—'}</td>
      <td>${event.correctionAt?escapeHtml(formatDateTime(event.correctionAt)):'—'}</td>
      <td>${event.reason?escapeHtml(event.reason):'—'}</td>
    </tr>`).join('');

    return `<table><thead><tr><th>Время события</th><th>Событие</th><th>Расчётное время</th><th>Фактическое время «Принято»</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
})();
