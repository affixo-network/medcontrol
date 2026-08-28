(function(){
  const KEYS=['scheduleType','weekdays','explicitDates','startDate','endDate','times'];
  function cloneTemporal(source){const out={};KEYS.forEach(k=>{const v=source?.[k];out[k]=Array.isArray(v)?[...v]:(v??'');});return out;}
  function eventDate(entry){try{return localDateFromISO(entry.at);}catch(_){return '';}}
  function applyDelta(base,entry){const out=cloneTemporal(base);const times=new Set(Array.isArray(out.times)?out.times:[]);(entry?.changedTimeValues||[]).forEach(t=>times.add(t));(entry?.removedTimeValues||[]).forEach(t=>times.delete(t));out.times=[...times].sort();return out;}
  function resolveTodayTemporal(med,today){
    let result=cloneTemporal(med);
    const entries=Array.isArray(med?.rowHistory)?[...med.rowHistory]:[];
    entries.filter(e=>e?.action==='edited'&&e?.scheduleScope==='today'&&eventDate(e)===today)
      .sort((a,b)=>new Date(a.at)-new Date(b.at))
      .forEach(entry=>{result=applyDelta(result,entry);});
    const app=med?.temporalApplication;
    if(app&&app.date===today&&app.scope==='today'&&app.todayTemporal){
      const appTimes=new Set(app.todayTemporal.times||[]);
      const historyTimes=new Set(result.times||[]);
      appTimes.forEach(t=>historyTimes.add(t));
      result={...cloneTemporal(app.todayTemporal),times:[...historyTimes].sort()};
    } else if(app&&app.date===today&&app.scope==='future'&&app.todayTemporal){
      result=cloneTemporal(app.todayTemporal);
    } else if(app&&app.date===today&&app.scope==='today_future'){
      result=cloneTemporal(med);
    }
    return result;
  }
  window.resolveTodayTemporal=resolveTodayTemporal;
})();
