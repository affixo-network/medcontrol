(function(){
  const LABELS={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  function cloneTemporal(source){const out={};['scheduleType','weekdays','explicitDates','startDate','endDate','times'].forEach(k=>{const v=source?.[k];out[k]=Array.isArray(v)?[...v]:(v??'');});return out;}
  function timeDelta(a,b){const before=new Set(a?.times||[]),after=b?.times||[];return after.filter(t=>!before.has(t));}
  function repair(){
    if(typeof getState!=='function'||typeof saveState!=='function')return;
    const state=getState();let dirty=false;
    (state.medications||[]).forEach(med=>{
      const app=med.temporalApplication;if(!app||!app.changedAt||!LABELS[app.scope]||!Array.isArray(med.rowHistory))return;
      const changedMs=new Date(app.changedAt).getTime();
      const edited=med.rowHistory.filter(e=>e.action==='edited'&&Number.isFinite(new Date(e.at).getTime()));
      if(!edited.length)return;
      let entry=edited.find(e=>e.at===app.changedAt);
      if(!entry)entry=edited.slice().sort((a,b)=>Math.abs(new Date(a.at).getTime()-changedMs)-Math.abs(new Date(b.at).getTime()-changedMs))[0];
      if(!entry)return;
      entry.changes=entry.changes||{};
      if(entry.scheduleScope!==app.scope){entry.scheduleScope=app.scope;dirty=true;}
      if(entry.scheduleScopeLabel!==LABELS[app.scope]){entry.scheduleScopeLabel=LABELS[app.scope];dirty=true;}
      if(entry.changes.active!==Boolean(med.active)){entry.changes.active=Boolean(med.active);dirty=true;}
      let todayTemporal,futureTemporal;
      if(app.scope==='today'){todayTemporal=cloneTemporal(app.todayTemporal||med);futureTemporal=cloneTemporal(med);}
      else if(app.scope==='future'){todayTemporal=cloneTemporal(app.todayTemporal||med);futureTemporal=cloneTemporal(med);}
      else {todayTemporal=cloneTemporal(med);futureTemporal=cloneTemporal(med);}
      if(JSON.stringify(entry.scopeTodayTemporal)!==JSON.stringify(todayTemporal)){entry.scopeTodayTemporal=todayTemporal;dirty=true;}
      if(JSON.stringify(entry.scopeFutureTemporal)!==JSON.stringify(futureTemporal)){entry.scopeFutureTemporal=futureTemporal;dirty=true;}
      const changed=timeDelta(futureTemporal,todayTemporal);
      const removed=timeDelta(todayTemporal,futureTemporal);
      if(app.scope==='today'){
        if(JSON.stringify(entry.changedTimeValues||[])!==JSON.stringify(changed)){entry.changedTimeValues=changed;dirty=true;}
        if(JSON.stringify(entry.removedTimeValues||[])!==JSON.stringify(removed)){entry.removedTimeValues=removed;dirty=true;}
        if(changed.length&&JSON.stringify(entry.changes.times)!==JSON.stringify(changed)){entry.changes.times=[...changed];dirty=true;}
      }
    });
    if(dirty)saveState(state);
  }
  repair();
  window.repairScopeHistory=repair;
})();
