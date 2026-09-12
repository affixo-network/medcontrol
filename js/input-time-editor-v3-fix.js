(function(){
  function esc(v){return escapeHtml(v==null?'':String(v));}
  function ensureDialog(){let d=document.getElementById('timeStatusEditDialog');if(!d){d=document.createElement('dialog');d.id='timeStatusEditDialog';document.body.appendChild(d);}return d;}
  function latestTimeRecord(med,time){return (med.timeStatusHistory||[]).filter(x=>x?.time===time||x?.oldTime===time||x?.newTime===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0)).pop();}
  function activeNow(med,time){const r=latestTimeRecord(med,time);if(r&&typeof r.active==='boolean')return r.active;if(med.timeStatuses&&typeof med.timeStatuses[time]==='boolean')return med.timeStatuses[time];return true;}
  function scopeNow(med,time){return latestTimeRecord(med,time)?.scope||'daily';}
  function normalizeTime(value){
    const raw=String(value||'').trim();
    let m=raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if(!m){
      const digits=raw.replace(/\D/g,'');
      if(digits.length!==4)return '';
      m=[digits,digits.slice(0,2),digits.slice(2,4)];
    }
    const h=Number(m[1]),min=Number(m[2]);
    if(h<0||h>23||min<0||min>59)return '';
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  function formatTimeInput(el){
    if(!el)return;
    const n=normalizeTime(el.value);
    if(n)el.value=n;
  }

  window.editMedicationTimeStatus=function(id,time){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=ensureDialog(),active=activeNow(med,time),scope=scopeNow(med,time);
    window.__timeEditV3={id,originalTime:time,deleteCurrent:false};
    d.innerHTML=`<h2>Изменить время ${esc(time)}</h2><div class="form-grid">
      <div><label>Время</label><input id="timeEditValue" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="HH:MM" value="${esc(time)}" onblur="formatMedicationTimeInputV3(this)"><p class="muted" style="margin-top:6px">Введите время в 24-часовом формате HH:MM, например 23:20.</p></div>
      <div><label>Статус</label><select id="timeEditStatus"><option value="active" ${active?'selected':''}>Активно</option><option value="passive" ${!active?'selected':''}>Пассивно</option></select></div>
      <div class="full"><label>Параметры расписания</label><select id="timeEditScope"><option value="daily" ${scope==='daily'?'selected':''}>Без изменения расписания</option><option value="today" ${scope==='today'?'selected':''}>Только сегодня</option><option value="future" ${scope==='future'?'selected':''}>Только на последующие дни расписания</option><option value="today_future" ${scope==='today_future'?'selected':''}>Сегодня и на последующие дни расписания</option></select></div>
      <div class="full inline" style="justify-content:space-between;margin-top:8px"><button id="timeEditDeleteBtn" type="button" onclick="toggleDeleteInputTimeV3()">Удалить время</button><div><button type="button" onclick="saveInputTimeEditV4()">Сохранить</button><button type="button" onclick="document.getElementById('timeStatusEditDialog').close()">Закрыть</button></div></div>
    </div>`;
    d.showModal();
    const input=document.getElementById('timeEditValue');
    if(input){input.focus();input.select();}
  };

  window.formatMedicationTimeInputV3=function(el){formatTimeInput(el);};
  window.toggleDeleteInputTimeV3=function(){const c=window.__timeEditV3,input=document.getElementById('timeEditValue'),btn=document.getElementById('timeEditDeleteBtn');if(!c||!input||!btn)return;c.deleteCurrent=!c.deleteCurrent;input.disabled=c.deleteCurrent;btn.textContent=c.deleteCurrent?'Не удалять время':'Удалить время';};

  window.saveInputTimeEditV4=function(){
    const c=window.__timeEditV3,state=getState(),med=(state.medications||[]).find(x=>x.id===c?.id);if(!c||!med)return;
    const input=document.getElementById('timeEditValue');
    const oldTime=c.originalTime,newTime=normalizeTime(input?.value||oldTime),active=document.getElementById('timeEditStatus')?.value==='active',scope=document.getElementById('timeEditScope')?.value||'daily';
    if(!c.deleteCurrent&&!newTime){alert('Укажите корректное время в формате HH:MM, например 23:20.');input?.focus();return;}
    if(input&&newTime)input.value=newTime;
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
})();