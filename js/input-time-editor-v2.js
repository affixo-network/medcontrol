(function(){
  const TEMPORAL_KEYS=['scheduleType','weekdays','explicitDates','startDate','endDate','times'];
  const SCOPE_LABELS={daily:'Ежедневно',today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  function cloneTemporal(source){const out={};TEMPORAL_KEYS.forEach(k=>{const v=source?.[k];out[k]=Array.isArray(v)?[...v]:(v??'');});return out;}
  function setTimes(target,times){target.times=[...new Set(times.filter(Boolean))].sort();}
  function ensureDialog(){let d=document.getElementById('timeStatusEditDialog');if(!d){d=document.createElement('dialog');d.id='timeStatusEditDialog';document.body.appendChild(d);}return d;}
  function latestTimeRecord(med,time){return (med.timeStatusHistory||[]).filter(x=>x?.time===time||x?.newTime===time).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0)).pop();}
  function currentActive(med,time){const r=latestTimeRecord(med,time);if(r&&typeof r.active==='boolean')return r.active;if(med.timeStatuses&&typeof med.timeStatuses[time]==='boolean')return med.timeStatuses[time];return true;}
  function currentScope(med,time){return latestTimeRecord(med,time)?.scope||'daily';}
  function renderAddedTimes(){const host=document.getElementById('timeEditAddedList');if(!host)return;const list=window.__timeEditV2?.added||[];host.innerHTML=list.length?list.map((t,i)=>`<span class="inline" style="margin:4px 8px 4px 0"><strong>${escapeHtml(t)}</strong><button type="button" onclick="removePendingTime(${i})">Удалить</button></span>`).join(''):'<span class="muted">Дополнительных времён нет.</span>';}
  window.addPendingTime=function(){const input=document.getElementById('timeEditAddValue'),ctx=window.__timeEditV2;if(!input||!ctx)return;const t=input.value;if(!t)return;if(t===ctx.originalTime||(ctx.added||[]).includes(t)){alert('Такое время уже выбрано.');return;}ctx.added.push(t);ctx.added=[...new Set(ctx.added)].sort();input.value='';renderAddedTimes();};
  window.removePendingTime=function(index){const ctx=window.__timeEditV2;if(!ctx)return;ctx.added.splice(index,1);renderAddedTimes();};
  window.toggleDeleteCurrentTime=function(){const ctx=window.__timeEditV2,btn=document.getElementById('timeEditDeleteBtn'),input=document.getElementById('timeEditValue');if(!ctx||!btn||!input)return;ctx.deleteCurrent=!ctx.deleteCurrent;btn.textContent=ctx.deleteCurrent?'Не удалять время':'Удалить время';input.disabled=ctx.deleteCurrent;};

  window.editMedicationTimeStatus=function(id,time){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=ensureDialog(),active=currentActive(med,time),scope=currentScope(med,time);window.__timeEditV2={id,originalTime:time,added:[],deleteCurrent:false};
    d.innerHTML=`<h2>Изменить время ${escapeHtml(time)}</h2>
      <div class="form-grid">
        <div><label>Время</label><input id="timeEditValue" type="time" value="${escapeHtml(time)}"></div>
        <div><label>Статус</label><select id="timeEditStatus"><option value="active" ${active?'selected':''}>Активно</option><option value="passive" ${!active?'selected':''}>Пассивно</option></select></div>
        <div class="full"><label>Параметры расписания</label><select id="timeEditScope"><option value="daily" ${scope==='daily'?'selected':''}>Ежедневно</option><option value="today" ${scope==='today'?'selected':''}>Только сегодня</option><option value="future" ${scope==='future'?'selected':''}>Только на последующие дни расписания</option><option value="today_future" ${scope==='today_future'?'selected':''}>Сегодня и на последующие дни расписания</option></select></div>
        <div class="full"><label>Добавить время</label><div class="inline"><input id="timeEditAddValue" type="time"><button type="button" onclick="addPendingTime()">Добавить время</button></div><div id="timeEditAddedList" style="margin-top:8px"></div></div>
        <div class="full inline" style="justify-content:space-between;margin-top:8px"><button id="timeEditDeleteBtn" type="button" onclick="toggleDeleteCurrentTime()">Удалить время</button><div><button type="button" onclick="saveInputTimeEditV3()">Сохранить</button><button type="button" onclick="document.getElementById('timeStatusEditDialog').close()">Закрыть</button></div></div>
      </div>`;
    renderAddedTimes();d.showModal();
  };

  function recordTimeHistory(med,rec){if(!Array.isArray(med.timeStatusHistory))med.timeStatusHistory=[];med.timeStatusHistory.push(rec);}
  function recordRowHistory(med,at,scope,changes,before,after){if(!Array.isArray(med.rowHistory))med.rowHistory=[];med.rowHistory.push({at,action:'edited',scheduleScope:scope==='daily'?null:scope,scheduleScopeLabel:scope==='daily'?'':SCOPE_LABELS[scope],changes,payload:'Изменены данные времени.',scopeTodayTemporal:scope==='today'?after:(scope==='future'?before:scope==='today_future'?after:null),scopeFutureTemporal:scope==='today'?before:(scope==='future'||scope==='today_future'?after:null)});}

  window.saveInputTimeEditV3=function(){
    const ctx=window.__timeEditV2,state=getState(),med=(state.medications||[]).find(x=>x.id===ctx?.id);if(!ctx||!med)return;
    const oldTime=ctx.originalTime,newTime=document.getElementById('timeEditValue')?.value||oldTime,active=document.getElementById('timeEditStatus')?.value==='active',scope=document.getElementById('timeEditScope')?.value||'daily',added=[...new Set(ctx.added||[])].filter(Boolean),before=cloneTemporal(med),today=currentLocalDate(),at=nowISO();
    const oldActive=currentActive(med,oldTime),oldScope=currentScope(med,oldTime),baseTimes=[...(med.times||[])];
    if(!ctx.deleteCurrent&&newTime!==oldTime&&baseTimes.includes(newTime)){alert('Такое время уже существует.');return;}
    const duplicates=added.filter(t=>baseTimes.includes(t)&&t!==oldTime);if(duplicates.length){alert(`Уже существуют: ${duplicates.join(', ')}`);return;}
    if(!ctx.deleteCurrent&&newTime===oldTime&&active===oldActive&&scope===oldScope&&!added.length){document.getElementById('timeStatusEditDialog')?.close();return;}

    let changedTimes=[...baseTimes];
    if(ctx.deleteCurrent)changedTimes=changedTimes.filter(t=>t!==oldTime);
    else if(newTime!==oldTime)changedTimes=changedTimes.map(t=>t===oldTime?newTime:t);
    added.forEach(t=>changedTimes.push(t));changedTimes=[...new Set(changedTimes)].sort();
    const after=cloneTemporal(med);setTimes(after,changedTimes);

    if(scope==='today'){
      med.temporalApplication={scope:'today',date:today,changedAt:at,todayTemporal:after};
    }else if(scope==='future'){
      setTimes(med,changedTimes);med.temporalApplication={scope:'future',date:today,changedAt:at,todayTemporal:before};
    }else if(scope==='today_future'){
      setTimes(med,changedTimes);med.temporalApplication={scope:'today_future',date:today,changedAt:at};
    }else{
      setTimes(med,changedTimes);delete med.temporalApplication;
    }

    med.timeStatuses=med.timeStatuses||{};
    if(ctx.deleteCurrent){delete med.timeStatuses[oldTime];recordTimeHistory(med,{time:oldTime,oldTime,deleted:true,active:false,scope,date:today,at,action:'time_deleted'});}else{
      if(newTime!==oldTime){const prior=med.timeStatuses[oldTime];delete med.timeStatuses[oldTime];med.timeStatuses[newTime]=typeof prior==='boolean'?prior:active;recordTimeHistory(med,{time:newTime,oldTime,newTime,active,scope,date:today,at,action:'time_changed'});}else if(active!==oldActive||scope!==oldScope){med.timeStatuses[newTime]=active;recordTimeHistory(med,{time:newTime,active,scope,date:today,at,action:active?'time_activated':'time_deactivated'});}
    }
    added.forEach(t=>{med.timeStatuses[t]=true;recordTimeHistory(med,{time:t,newTime:t,active:true,scope,date:today,at,action:'time_added'});});

    recordRowHistory(med,at,scope,{times:changedTimes,timeStatus:{time:ctx.deleteCurrent?oldTime:newTime,oldTime,newTime,deleted:ctx.deleteCurrent,active,scope,date:today,addedTimes:added}},before,after);
    saveState(state);document.getElementById('timeStatusEditDialog')?.close();mount('input');
  };
})();