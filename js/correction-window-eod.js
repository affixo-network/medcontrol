(function(){
  function endOfLocalDay(dateISO){
    const end=getScheduledDateTime(dateISO,'23:59');
    return new Date(end).getTime()+59000;
  }

  window.canCorrectIntakeNow=function(medicationId,plannedAt){
    if(!plannedAt) return false;
    const dateISO=localDateFromISO(plannedAt);
    if(dateISO!==currentLocalDate()) return false;
    const log=getLogForSchedule(medicationId,plannedAt);
    if(!log||log.action!=='taken') return false;
    return Date.now()<endOfLocalDay(dateISO);
  };
})();
