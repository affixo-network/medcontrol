(function(){
  function plusDays(iso,n){
    const [y,m,d]=iso.split('-').map(Number);
    const dt=new Date(Date.UTC(y,m-1,d+n,12));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
  }

  function scheduledSlots(med,start,days){
    const out=[];
    const times=(med.times||[]).filter(Boolean).slice().sort();
    for(let i=0;i<=days;i++){
      const date=plusDays(start,i);
      if(!isMedicationApplicableOnDate(med,date)) continue;
      for(const time of times){
        const plannedAt=getScheduledDateTime(date,time);
        const plannedMs=new Date(plannedAt).getTime();
        if(!Number.isNaN(plannedMs)) out.push({date,time,plannedAt,plannedMs});
      }
    }
    return out.sort((a,b)=>a.plannedMs-b.plannedMs);
  }

  function slotFromPlannedAt(plannedAt){
    const date=localDateFromISO(plannedAt);
    const parts=formatDateTime(plannedAt).split(', ');
    return {date,time:parts[1]||'—',plannedAt,plannedMs:new Date(plannedAt).getTime()};
  }

  function uniqueSlots(slots){
    const map=new Map();
    slots.forEach(slot=>{
      if(slot?.plannedAt&&!map.has(slot.plannedAt)) map.set(slot.plannedAt,slot);
    });
    return [...map.values()].sort((a,b)=>a.plannedMs-b.plannedMs);
  }

  function correctionCount(medicationId,plannedAt){
    return (getState().intakeCorrections||[]).filter(c=>c.medicationId===medicationId&&c.plannedAt===plannedAt).length;
  }

  function effectiveRow(med,slot,now){
    const effective=getLogForSchedule(med.id,slot.plannedAt);
    const count=correctionCount(med.id,slot.plannedAt);
    if(effective){
      return {
        medication:med,plannedDate:slot.date,plannedTime:slot.time,plannedAt:slot.plannedAt,plannedMs:slot.plannedMs,
        status:effective.action==='taken'?'taken':'cancelled',actualAt:effective.actualAt||null,
        canTake:false,canCorrect:effective.action==='taken',correctionCount:count,countdownMode:null,countdownMs:null
      };
    }
    const waiting=slot.plannedMs>now;
    return {
      medication:med,plannedDate:slot.date,plannedTime:slot.time,plannedAt:slot.plannedAt,plannedMs:slot.plannedMs,
      status:waiting?'waiting':'missed',actualAt:null,canTake:true,canCorrect:false,correctionCount:count,
      countdownMode:waiting?'remaining':'late',countdownMs:waiting?slot.plannedMs-now:now-slot.plannedMs
    };
  }

  window.buildMedControlTimeline=function(){
    const state=getState();
    const today=currentLocalDate();
    const now=Date.now();
    const rows=[];

    for(const med of (state.medications||[])){
      if(med.cancelled||med.courseCompleted||!med.active) continue;
      if(typeof ensureTemporalChangeState==='function') ensureTemporalChangeState(med);

      const scheduled=scheduledSlots(med,today,370);
      const todayScheduled=scheduled.filter(slot=>slot.date===today);

      // Preserve every current-day event already recorded even if a later edit changed the time list.
      const historicalToday=(state.intakeLogs||[])
        .filter(log=>log.medicationId===med.id&&localDateFromISO(log.plannedAt)===today)
        .map(log=>slotFromPlannedAt(log.plannedAt));
      const correctionToday=(state.intakeCorrections||[])
        .filter(c=>c.medicationId===med.id&&localDateFromISO(c.plannedAt)===today)
        .map(c=>slotFromPlannedAt(c.plannedAt));

      const currentDaySlots=uniqueSlots([...todayScheduled,...historicalToday,...correctionToday]);
      currentDaySlots.forEach(slot=>rows.push(effectiveRow(med,slot,now)));

      if((med.scheduleType==='weekdays'||med.scheduleType==='explicit_dates')&&!todayScheduled.length){
        const next=scheduled.find(slot=>slot.date>today);
        if(next){
          scheduled
            .filter(slot=>slot.date===next.date)
            .forEach(slot=>rows.push(effectiveRow(med,slot,now)));
        }
      }
    }

    return rows.sort((a,b)=>(a.plannedMs??Infinity)-(b.plannedMs??Infinity));
  };
})();
