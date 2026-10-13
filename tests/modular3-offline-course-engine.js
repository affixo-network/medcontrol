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
 const old=[...state.intakeLogs].reverse().find(l=>l.medicationId===id&&l.plannedAt===plannedAt);
 if(action==='cancelled'&&old?.action!=='taken')throw Error('Only taken intake can be cancelled');
 if(action==='taken'&&old?.action==='taken')throw Error('Already taken');
 const entry={id:crypto.randomUUID(),medicationId:id,name:med.name,plannedAt,actualAt,action,status:computeStatusForLog(plannedAt,actualAt,action)};
 state.intakeLogs.push(entry);
 reconcile(state,actualAt);
 return entry;
}
function reconcile(state,nowISO=new Date().toISOString()){
 const now=new Date(nowISO).getTime();
 if(!Number.isFinite(now))throw Error('Invalid current time');
 let changed=false;
 for(const med of state.medications){
  if(med.cancelled)continue;
  const dates=med.scheduleType==='explicit_dates'?[...(med.explicitDates||[])].sort():[];
  const lastDate=dates[dates.length-1]||med.endDate;
  if(!lastDate)continue;
  const times=[...(med.times||[])].sort();
  if(!times.length)continue;
  const plannedAt=getScheduledDateTime(lastDate,times[times.length-1]);
  const events=state.intakeLogs.filter(l=>l.medicationId===med.id&&l.plannedAt===plannedAt);
  const latest=events[events.length-1];
  const finalDayEnd=new Date(getScheduledDateTime(lastDate,'23:59')).getTime()+59000;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const completed=(lastDate<=today&&latest?.action==='taken')||now>=finalDayEnd;
  if(completed&&!med.courseCompleted){
   med.courseCompleted=true;med.active=false;
   med.courseCompletedAt=latest?.action==='taken'&&Date.parse(latest.actualAt)<=finalDayEnd?latest.actualAt:new Date(finalDayEnd).toISOString();
   changed=true;
  }else if(!completed&&med.courseCompleted&&!med.archivedCompleted){
   med.courseCompleted=false;med.active=true;med.courseCompletedAt=null;changed=true;
  }
  if(med.courseCompleted&&!med.archivedCompleted){
   const completedAt=new Date(med.courseCompletedAt).getTime();
   if(Number.isFinite(completedAt)&&now>=completedAt+7*86400000){
    med.archivedCompleted=true;med.archivedAt=new Date(completedAt+7*86400000).toISOString();changed=true;
   }
  }
 }
 return changed;
}
root.MedControlOfflineCourseEngine=Object.freeze({create,record,reconcile});
})(window);
