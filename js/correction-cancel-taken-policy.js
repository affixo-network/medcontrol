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

  // Resolve known UI labels through the active legacy language dictionary.
  // Never modify the medical record or its stored reason codes during translation.
  function ui(key, fallback){
    try{
      if(typeof tr==='function'){
        const value=tr(key);
        if(typeof value==='string'&&value&&value!==key)return value;
      }
    }catch(_){}
    return fallback;
  }
  function label(reason){
    const language=typeof getState==='function'?getState()?.settings?.interfaceLanguage:null;
    return reason==='accident'?ui('correction_reason_accident',language==='en'?'Accidental button press':'Случайное нажатие'):
      reason==='error'?ui('correction_reason_error',language==='en'?'Error':'Ошибка'):'—';
  }

  // Catalog-backed labels are loaded only for already activated UI languages.
  const catalogIds=Object.freeze({
    count:'1419825a704fb8e4',timeRule:'685190e0416b6da0',
    scheduled:'57cb4188862a5ff0',actual:'f9274041224ea4c0',
    reason:'442e7ad5479655fc',choose:'6a323db2ae5bed82',
    chooseReason:'435d3d1cbd5cc878',cancelTaken:'0a23c2a4fe16415a',
    close:'a7a4033657e89fc9',accidentHint:'89c4361d72299747',
    errorHint:'585d7328139b9ece',invalidReason:'8fe1c236559abd0c'
  });
  function localized(key,fallback){
    const language=typeof getState==='function'?getState()?.settings?.interfaceLanguage:null;
    const messages=window.MedControlCorrectionCatalogs?.[language]?.messages;
    const value=messages?.[catalogIds[key]];
    if(typeof value==='string'&&value.trim())return value;
    // English uses the built-in dictionary and does not activate a public catalog.
    // Keep correction controls understandable without a network request.
    if(language==='en'){
      const english={count:'Previous corrections: ⟦0⟧',timeRule:'Actual time is recorded when Taken is pressed and cannot be edited manually.',scheduled:'Scheduled intake time',actual:'Actual Taken time',reason:'Reason',choose:'Select',chooseReason:'Select a reason.',cancelTaken:'Cancel Taken',close:'Close',accidentHint:'Accidental button press: the Taken mark will be cancelled. The original entry and actual time remain in history.',errorHint:'Error: the Taken mark will be cancelled. The original entry and actual time remain in history.',invalidReason:'Select a reason: Accidental button press or Error.'};
      return english[key]||fallback;
    }
    return fallback;
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

    content.innerHTML=`<div class="form-grid">
      <div class="full"><p><strong>${escapeHtml(localized('count','Количество предыдущих исправлений: ⟦0⟧').replace('⟦0⟧',String(count)))}</strong></p><p class="muted">${escapeHtml(localized('timeRule','Фактическое время определяется моментом нажатия «Принято» и не может быть изменено вручную.'))}</p></div>
      <div><label>${escapeHtml(localized('scheduled','Расчётное время приёма'))}</label><input type="text" value="${escapeHtml(formatDateTime(plannedAt))}" readonly></div>
      <div><label>${escapeHtml(localized('actual','Фактическое время «Принято»'))}</label><input type="text" value="${escapeHtml(formatDateTime(base.actualAt))}" readonly></div>
      <div><label>${escapeHtml(localized('reason','Причина'))}</label><select id="correction_reason" onchange="window.syncCorrectionMode()"><option value="">${escapeHtml(localized('choose','Выберите'))}</option><option value="accident">${escapeHtml(label('accident'))}</option><option value="error">${escapeHtml(label('error'))}</option></select></div>
      <div id="correction_hint" class="full muted">${escapeHtml(localized('chooseReason','Выберите причину.'))}</div>
      <div class="full right"><button id="correction_apply" onclick="applyCorrection('${medicationId}','${plannedAt}')" disabled>${escapeHtml(localized('cancelTaken','Отменить «Принято»'))}</button> <button onclick="document.getElementById('correctionDialog').close()">${escapeHtml(localized('close','Закрыть'))}</button></div>
    </div>`;
    dialog.showModal();
  };

  window.syncCorrectionMode=function(){
    const reason=document.getElementById('correction_reason')?.value||'';
    const hint=document.getElementById('correction_hint');
    const button=document.getElementById('correction_apply');
    if(!hint||!button)return;
    if(reason==='accident'||reason==='error'){
      hint.textContent=reason==='accident'?localized('accidentHint','Случайное нажатие: отметка «Принято» будет отменена. Исходная запись и фактическое время останутся в истории.'):localized('errorHint','Ошибка: отметка «Принято» будет отменена. Исходная запись и фактическое время останутся в истории.');
      button.disabled=false;
      button.textContent=localized('cancelTaken','Отменить «Принято»');
    }else{
      hint.textContent=localized('chooseReason','Выберите причину.');
      button.disabled=true;
      button.textContent=localized('cancelTaken','Отменить «Принято»');
    }
  };

  window.applyCorrection=async function(medicationId,plannedAt){
    const reason=document.getElementById('correction_reason')?.value||'';
    if(reason!=='accident'&&reason!=='error'){
      alert(localized('invalidReason','Выберите причину: «Случайное нажатие» или «Ошибка».'));
      return false;
    }
    const base=primary(medicationId,plannedAt);
    if(!base)return false;
    if(!window.confirm('Отменить отметку «Принято»? Причина: '+label(reason)+'. Исходное фактическое время сохранится в истории.'))return false;
    const boundary=window.MedControlModular3WriteBoundary;
    const protectedExists=localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null||
      localStorage.getItem('medcontrol_modular3_local_credential_v1')!==null;
    const correctedAt=nowISO();
    const append=state=>{
      state.intakeCorrections=Array.isArray(state.intakeCorrections)?state.intakeCorrections:[];
      const current=state.intakeLogs?.find(x=>x.id===base.id&&x.medicationId===medicationId&&x.plannedAt===plannedAt);
      if(!current)throw new Error('Исходная запись не найдена.');
      const ordinal=state.intakeCorrections.filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt).length+1;
      state.intakeCorrections.push({
        id:uid(),medicationId,plannedAt,primaryLogId:base.id||null,ordinal,
        reason,correctedAt,
        before:{actualAt:base.actualAt,action:'taken',status:base.status},
        after:{actualAt:null,action:'reset',status:null}
      });
    };
    try{
      if(protectedExists){
        if(!boundary?.enabled())throw new Error('Защищённое хранилище заблокировано.');
        await boundary.write('action',append);
      }else{
        const state=ensureState();
        const original=state.intakeCorrections.slice();
        try{
          append(state);
          if(!(await saveStateAsync(state)))throw new Error('Не удалось сохранить отмену.');
        }catch(error){
          state.intakeCorrections=original;
          throw error;
        }
      }
      document.getElementById('correctionDialog')?.close();
      (await mount('action'));
      return true;
    }catch(error){
      alert('Отмена не сохранена: '+error.message);
      return false;
    }
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
          status:typeof statusLabel==='function'?statusLabel(log.status||(typeof computeStatusForLog==='function'?computeStatusForLog(log.plannedAt,log.actualAt,log.action):'')):(log.status||''),
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
          status:null,
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
      <td>${event.status?escapeHtml(event.status):'—'}</td>
      <td>${event.correctionAt?escapeHtml(formatDateTime(event.correctionAt)):'—'}</td>
      <td>${event.reason?escapeHtml(event.reason):'—'}</td>
    </tr>`).join('');

    return `<table><thead><tr><th>Время события</th><th>Событие</th><th>Расчётное время</th><th>Фактическое время «Принято»</th><th>Статус</th><th>Локальное время исправления</th><th>Причина исправления</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
})();
