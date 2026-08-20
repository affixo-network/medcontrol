(function(){
  function endOfLocalDay(dateISO){
    const end=getScheduledDateTime(dateISO,'23:59');
    return new Date(end).getTime()+59000;
  }

  function isTakenNow(medicationId,plannedAt){
    const log=getLogForSchedule(medicationId,plannedAt);
    return Boolean(log&&log.action==='taken');
  }

  window.canCorrectIntakeNow=function(medicationId,plannedAt){
    if(!plannedAt) return false;
    const dateISO=localDateFromISO(plannedAt);
    if(dateISO!==currentLocalDate()) return false;
    if(!isTakenNow(medicationId,plannedAt)) return false;
    return Date.now()<endOfLocalDay(dateISO);
  };

  const inheritedApplyCorrection=window.applyCorrection;
  if(typeof inheritedApplyCorrection==='function'){
    window.applyCorrection=function(medicationId,plannedAt){
      if(!window.canCorrectIntakeNow(medicationId,plannedAt)){
        alert('Исправление доступно только до 23:59 дня приёма.');
        return;
      }
      return inheritedApplyCorrection.apply(this,arguments);
    };
  }
})();
