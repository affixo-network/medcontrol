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

    const count=corrections(medicationId,plannedAt).length;
    const correctionAt=nowISO();

    content.innerHTML=`<div class="form-grid">
      <div class="full"><p><strong>Количество предыдущих исправлений: ${count}</strong></p><p class="muted">Исправление отменяет только ошибочно зафиксированное действие «Принято». Первоначальная запись сохраняется в истории.</p></div>
      <div><label>Расчётное время приёма</label><input type="text" value="${escapeHtml(formatDateTime(plannedAt))}" readonly></div>
      <div><label>Фактическое время нажатия «Принято»</label><input type="text" value="${escapeHtml(formatDateTime(base.actualAt))}" readonly></div>
      <div><label>Локальное время исправления</label><input type="text" value="${escapeHtml(formatDateTime(correctionAt))}" readonly></div>
      <div><label>Причина исправления</label><select id="correction_reason"><option value="">Выберите</option><option value="accident">Случайность</option><option value="error">Ошибка</option></select></div>
      <div class="full muted">После подтверждения статус «Принято» будет снят. Поле фактического времени на основной странице очистится до следующего подтверждённого приёма.</div>
      <div class="full right"><button onclick="applyCorrection('${medicationId}','${plannedAt}')">Отменить «Принято»</button> <button onclick="document.getElementById('correctionDialog').close()">Закрыть</button></div>
    </div>`;
    dialog.showModal();
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
    const ordinal=all.length+1;
    const correctedAt=nowISO();

    if(!window.confirm(`Исправление №${ordinal}.\n\nПричина: ${label(reason)}.\nДействие «Принято» будет отменено.\nФактическое время исходной фиксации сохранится в истории.\n\nПодтвердить?`)) return;

    s.intakeCorrections.push({
      id:uid(),
      medicationId,
      plannedAt,
      primaryLogId:base.id||null,
      ordinal,
      reason,
      correctedAt,
      before:{actualAt:base.actualAt,action:'taken',status:base.status},
      after:{actualAt:null,action:'reset',status:null}
    });

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
          event:'Отмена «Принято»',
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
