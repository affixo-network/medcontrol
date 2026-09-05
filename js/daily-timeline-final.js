(function(){
  const TEMPORAL_KEYS=['scheduleType','weekdays','explicitDates','startDate','endDate','times'];

  function plusDays(iso,n){const [y,m,d]=iso.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+n,12));return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;}
  function withTemporal(base,temporal){if(!temporal)return base;const copy={...base};TEMPORAL_KEYS.forEach(key=>{const value=temporal[key];copy[key]=Array.isArray(value)?[...value]:value;});return copy;}
  function todayMedication(med,today){const app=med.temporalApplication;if(!app||app.date!==today)return med;if((app.scope==='today'||app.scope==='future')&&app.todayTemporal)return withTemporal(med,app.todayTemporal);return med;}
  function scheduledSlots(med,start,days,forceFirstDate=false){const out=[];const times=(med.times||[]).filter(Boolean).slice().sort();for(let i=0;i<=days;i++){const date=plusDays(start,i);if(!(forceFirstDate&&i===0)&&!isMedicationApplicableOnDate(med,date))continue;for(const time of times){const plannedAt=getScheduledDateTime(date,time),plannedMs=new Date(plannedAt).getTime();if(!Number.isNaN(plannedMs))out.push({date,time,plannedAt,plannedMs});}}return out.sort((a,b)=>a.plannedMs-b.plannedMs);}
  function slotFromPlannedAt(plannedAt){const date=localDateFromISO(plannedAt),parts=formatDateTime(plannedAt).split(', ');return {date,time:parts[1]||'—',plannedAt,plannedMs:new Date(plannedAt).getTime()};}
  function uniqueSlots(slots){const map=new Map();slots.forEach(slot=>{if(slot?.plannedAt&&!map.has(slot.plannedAt))map.set(slot.plannedAt,slot);});return [...map.values()].sort((a,b)=>a.plannedMs-b.plannedMs);}
  function correctionCount(medicationId,plannedAt){return (getState().intakeCorrections||[]).filter(c=>c.medicationId===medicationId&&c.plannedAt===plannedAt).length;}
  function effectiveRow(med,slot,now){const effective=getLogForSchedule(med.id,slot.plannedAt),count=correctionCount(med.id,slot.plannedAt);if(effective)return {medication:med,plannedDate:slot.date,plannedTime:slot.time,plannedAt:slot.plannedAt,plannedMs:slot.plannedMs,status:effective.action==='taken'?'taken':'cancelled',actualAt:effective.actualAt||null,canTake:false,canCorrect:effective.action==='taken',correctionCount:count,countdownMode:null,countdownMs:null};const waiting=slot.plannedMs>now;return {medication:med,plannedDate:slot.date,plannedTime:slot.time,plannedAt:slot.plannedAt,plannedMs:slot.plannedMs,status:waiting?'waiting':'missed',actualAt:null,canTake:true,canCorrect:false,correctionCount:count,countdownMode:waiting?'remaining':'late',countdownMs:waiting?slot.plannedMs-now:now-slot.plannedMs};}
  function cutoffForToday(med,today){const app=med.temporalApplication;if(!app||app.date!==today)return null;if(app.scope!=='today'&&app.scope!=='today_future')return null;const ms=new Date(app.changedAt||'').getTime();return Number.isNaN(ms)?null:ms;}
  function createdAtMs(med){const entry=(med?.rowHistory||[]).find(item=>(item?.action||item?.event)==='created');const ms=new Date(entry?.at||0).getTime();return Number.isFinite(ms)?ms:0;}

  window.buildMedControlTimeline=function(){
    const state=getState(),today=currentLocalDate(),now=Date.now(),todayRows=[],futureByMedication=[];

    for(const med of (state.medications||[])){
      if(med.cancelled||med.courseCompleted||!med.active)continue;
      if(typeof ensureTemporalChangeState==='function')ensureTemporalChangeState(med);
      if(med.temporalPending?.schedule||med.temporalPending?.time)continue;

      const app=med.temporalApplication;
      const scopedToday=Boolean(app&&app.date===today&&(app.scope==='today'||app.scope==='today_future'));
      const todayMed=todayMedication(med,today),activeTodayTimes=new Set((todayMed.times||[]).filter(Boolean)),cutoff=cutoffForToday(med,today),createdMs=createdAtMs(med);
      let todayScheduled=scheduledSlots(todayMed,today,0,scopedToday);
      if(cutoff!=null)todayScheduled=todayScheduled.filter(slot=>slot.plannedMs>=cutoff);

      const historicalToday=(state.intakeLogs||[]).filter(log=>log.medicationId===med.id&&localDateFromISO(log.plannedAt)===today).map(log=>slotFromPlannedAt(log.plannedAt)).filter(slot=>activeTodayTimes.has(slot.time));
      const correctionToday=(state.intakeCorrections||[]).filter(c=>c.medicationId===med.id&&localDateFromISO(c.plannedAt)===today).map(c=>slotFromPlannedAt(c.plannedAt)).filter(slot=>activeTodayTimes.has(slot.time));
      const committedKeys=new Set([...historicalToday,...correctionToday].map(slot=>slot.plannedAt));

      todayScheduled=todayScheduled.filter(slot=>!createdMs||slot.plannedMs>=createdMs||committedKeys.has(slot.plannedAt));
      uniqueSlots([...todayScheduled,...historicalToday,...correctionToday]).forEach(slot=>todayRows.push(effectiveRow(med,slot,now)));

      const futureStart=plusDays(today,1),futureScheduled=scheduledSlots(med,futureStart,369);
      if(futureScheduled.length)futureByMedication.push({med,slots:futureScheduled});
    }

    if(todayRows.length){
      return todayRows.sort((a,b)=>(a.plannedMs??Infinity)-(b.plannedMs??Infinity));
    }

    let targetDate='';
    futureByMedication.forEach(item=>{
      const date=item.slots[0]?.date||'';
      if(date&&(!targetDate||date<targetDate))targetDate=date;
    });
    if(!targetDate)return [];

    const rows=[];
    futureByMedication.forEach(item=>{
      item.slots.filter(slot=>slot.date===targetDate).forEach(slot=>rows.push(effectiveRow(item.med,slot,now)));
    });
    return rows.sort((a,b)=>(a.plannedMs??Infinity)-(b.plannedMs??Infinity));
  };
})();
