(function(root){
'use strict';
function create(state,name,time,date){
 if(!name||!/^\d{2}:\d{2}$/.test(time)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid course');
 const med={id:crypto.randomUUID(),name,active:true,scheduleType:'explicit_dates',explicitDates:[date],times:[time],startDate:date,endDate:date};
 state.medications.push(med);
 return med;
}
function record(state,id,action,actualAt){
 const med=state.medications.find(m=>m.id===id);
 if(!med)throw Error('Unknown medication');
 if(action!=='taken'&&action!=='cancelled')throw Error('Invalid action');
 const date=med.explicitDates[0];
 if(!isMedicationApplicableOnDate(med,date))throw Error('Schedule not applicable');
 const plannedAt=getScheduledDateTime(date,med.times[0]);
 const old=state.intakeLogs.find(l=>l.medicationId===id&&l.plannedAt===plannedAt);
 if(action==='cancelled'&&old?.action!=='taken')throw Error('Only taken intake can be cancelled');
 if(action==='taken'&&old?.action==='taken')throw Error('Already taken');
 const entry={id:crypto.randomUUID(),medicationId:id,name:med.name,plannedAt,actualAt,action,status:computeStatusForLog(plannedAt,actualAt,action)};
 state.intakeLogs=state.intakeLogs.filter(l=>!(l.medicationId===id&&l.plannedAt===plannedAt));
 state.intakeLogs.push(entry);
 return entry;
}
root.MedControlOfflineCourseEngine=Object.freeze({create,record});
})(window);
