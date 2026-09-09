(function(){
  function esc(v){return escapeHtml(v==null?'':String(v));}
  function ensureDialog(){let d=document.getElementById('timeStatusEditDialog');if(!d){d=document.createElement('dialog');d.id='timeStatusEditDialog';document.body.appendChild(d);}return d;}
  function latestTimeRecord(med,time){return (med.timeStatusHistory||[]).filter(x=>x?.time===time||x?.oldTime===time||x?.newTime===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0)).pop();}
  function activeNow(med,time){const r=latestTimeRecord(med,time);if(r&&typeof r.active==='boolean')return r.active;if(med.timeStatuses&&typeof med.timeStatuses[time]==='boolean')return med.timeStatuses[time];return true;}
  function scopeNow(med,time){return latestTimeRecord(med,time)?.scope||'daily';}
  function normalizeTime(value){const m=String(value||'').match(/^(\d{1,2}):(\d{2})/);if(!m)return '';const h=Number(m[1]),min=Number(m[2]);if(h<0||h>23||min<0||min>59)return '';return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;}

  window.editMedicationTimeStatus=function(id,time){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=ensureDialog(),active=activeNow(med,time),scope=scopeNow(med,time);
    window.__timeEditV3={id,originalTime:time,deleteCurrent:false};
    d.innerHTML=`<h2>Изменить время ${esc(time)}</h2><div class="form-grid">
      <div><label>Время</label><input id="timeEditValue" type="time" value="${esc(time)}"><p class="muted" style="margin-top:6px">Чтобы заменить время, просто укажите новое значение здесь.</p></div>
      <div><label>Статус</label><select id="timeEditStatus"><option value="active" ${active?'selected':''}>Активно</option><option value="passive" ${!active?'selected':''}>Пассивно</option></select></div>
      <div class="full"><label>Параметры расписания</label><select id="timeEditScope"><option value="daily" ${scope==='daily'?'selected':''}>Без изменения расписания</option><option value="today" ${scope==='today'?'selected':''}>Только сегодня</option><option value="future" ${scope==='future'?'selected':''}>Только на последующие дни расписания</option><option value="today_future" ${scope==='today_future'?'selected':''}>Сегодня и на последующие дни расписания</option></select></div>
      <div class="full inline" style="justify-content:space-between;margin-top:8px"><button id="timeEditDeleteBtn" type="button" onclick="toggleDeleteInputTimeV3()">Удалить время</button><div><button type="button" onclick="saveInputTimeEditV4()">Сохранить</button><button type="button" onclick="document.getElementById('timeStatusEditDialog').close()">Закрыть</button></div></div>
    </div>`;
    d.showModal();
  };

  window.toggleDeleteInputTimeV3=function(){const c=window.__timeEditV3,input=document.getElementById('timeEditValue'),btn=document.getElementById('timeEditDeleteBtn');if(!c||!input||!btn)return;c.deleteCurrent=!c.deleteCurrent;input.disabled=c.deleteCurrent;btn.textContent=c.deleteCurrent?'Не удалять время':'Удалить время';};

  window.saveInputTimeEditV4=function(){
    const c=window.__timeEditV3,state=getState(),med=(state.medications||[]).find(x=>x.id===c?.id);if(!c||!med)return;
    const oldTime=c.originalTime,newTime=normalizeTime(document.getElementById('timeEditValue')?.value||oldTime),active=document.getElementById('timeEditStatus')?.value==='active',scope=document.getElementById('timeEditScope')?.value||'daily';
    if(!c.deleteCurrent&&!newTime){alert('Укажите корректное время.');return;}
    if(!c.deleteCurrent&&newTime!==oldTime&&(med.times||[]).includes(newTime)){alert('Такое время уже существует.');return;}
    const oldActive=activeNow(med,oldTime),oldScope=scopeNow(med,oldTime);
    if(!c.deleteCurrent&&newTime===oldTime&&active===oldActive&&scope===oldScope){document.getElementById('timeStatusEditDialog')?.close();return;}
    const at=nowISO(),date=currentLocalDate(),beforeTimes=[...(med.times||[])];let afterTimes=[...beforeTimes];
    if(c.deleteCurrent)afterTimes=afterTimes.filter(t=>t!==oldTime);else if(newTime!==oldTime)afterTimes=afterTimes.map(t=>t===oldTime?newTime:t);
    afterTimes=[...new Set(afterTimes)].sort();

    const before={scheduleType:med.scheduleType,weekdays:[...(med.weekdays||[])],explicitDates:[...(med.explicitDates||[])],startDate:med.startDate||'',endDate:med.endDate||'',times:[...beforeTimes]};
    const after={...before,times:[...afterTimes]};
    if(scope==='today')med.temporalApplication={scope:'today',date,changedAt:at,todayTemporal:after};
    else if(scope==='future'){med.times=[...afterTimes];med.temporalApplication={scope:'future',date,changedAt:at,todayTemporal:before};}
    else if(scope==='today_future'){med.times=[...afterTimes];med.temporalApplication={scope:'today_future',date,changedAt:at};}
    else{med.times=[...afterTimes];delete med.temporalApplication;}

    med.timeStatuses=med.timeStatuses||{};med.timeStatusHistory=Array.isArray(med.timeStatusHistory)?med.timeStatusHistory:[];
    if(c.deleteCurrent){delete med.timeStatuses[oldTime];med.timeStatusHistory.push({time:oldTime,oldTime,deleted:true,active:false,scope,date,at,action:'time_deleted'});}else if(newTime!==oldTime){const prior=med.timeStatuses[oldTime];delete med.timeStatuses[oldTime];med.timeStatuses[newTime]=typeof prior==='boolean'?prior:active;med.timeStatusHistory.push({time:newTime,oldTime,newTime,active,scope,date,at,action:'time_changed'});}else if(active!==oldActive||scope!==oldScope){med.timeStatuses[newTime]=active;med.timeStatusHistory.push({time:newTime,active,scope,date,at,action:active?'time_activated':'time_deactivated'});}

    med.rowHistory=Array.isArray(med.rowHistory)?med.rowHistory:[];
    med.rowHistory.push({at,action:'edited',scheduleScope:scope==='daily'?null:scope,scheduleScopeLabel:scope==='today'?'Только сегодня':scope==='future'?'Только на последующие дни расписания':scope==='today_future'?'Сегодня и на последующие дни расписания':'',changes:{times:afterTimes,timeStatus:{time:c.deleteCurrent?oldTime:newTime,oldTime,newTime,deleted:c.deleteCurrent,active,scope,date}},payload:c.deleteCurrent?`Время ${oldTime} удалено.`:(newTime!==oldTime?`Время изменено: ${oldTime} → ${newTime}.`:'Изменены данные времени.'),scopeTodayTemporal:scope==='today'?after:(scope==='future'?before:scope==='today_future'?after:null),scopeFutureTemporal:scope==='today'?before:(scope==='future'||scope==='today_future'?after:null)});
    saveState(state);document.getElementById('timeStatusEditDialog')?.close();mount('input');
  };

  function historicalTimes(med){
    const active=new Set((med.times||[]).filter(Boolean)),hist=new Set();
    (med.timeStatusHistory||[]).forEach(x=>{if(x?.deleted&&x.oldTime)hist.add(x.oldTime);if(x?.oldTime&&x?.newTime&&x.oldTime!==x.newTime)hist.add(x.oldTime);});
    return [...hist].filter(t=>!active.has(t)).sort();
  }
  function appendHistoricalRows(){
    const state=getState();
    document.querySelectorAll('section.card').forEach(section=>{
      if(section.querySelector('h2')?.textContent?.trim()!=='Активные препараты')return;
      const tbody=section.querySelector('tbody');if(!tbody)return;
      (state.medications||[]).filter(m=>!m.cancelled).forEach(med=>{
        const base=[...tbody.querySelectorAll('tr')].find(r=>r.children[0]?.textContent?.trim()===String(med.order));if(!base)return;
        let anchor=[...tbody.querySelectorAll(`tr[data-medication-id="${med.id}"]`)].pop()||base;
        historicalTimes(med).forEach(time=>{const tr=document.createElement('tr');tr.dataset.historicalTime='1';tr.dataset.medicationId=med.id;const plannedAt=getScheduledDateTime(currentLocalDate(),time);tr.innerHTML=`<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td><strong>${esc(time)}</strong></td><td>—</td><td>—</td><td><span class="status upcoming">Архивное время</span></td><td><button type="button" onclick="showInputTimeHistory('${med.id}','${plannedAt}')">История</button></td>`;anchor.after(tr);anchor=tr;});
      });
    });
  }
  const inherited=window.renderInputPage;if(typeof inherited==='function')window.renderInputPage=function(){inherited();appendHistoricalRows();};
})();