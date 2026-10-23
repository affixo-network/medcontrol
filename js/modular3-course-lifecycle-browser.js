/* Modular-3: course completion belongs to the same encrypted transaction as intake. */
(function(root){
'use strict';
const cancels=new Set(['cancelled','cancel_taken','undo_taken']);
const validTime=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const dayRe=/^\d{4}-\d{2}-\d{2}$/;
const local=(instant,zone)=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
};
function eligible(med,day,time) {
 const stamp=new Date(day+'T'+time+':00').getTime();
 const history=med.rowHistory||[];
 const timeChanges=history.filter(x=>x.action==='times_changed'&&Array.isArray(x.previousTimes)&&Array.isArray(x.newTimes)&&Number.isFinite(Date.parse(x.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 let times=timeChanges.length?timeChanges[0].previousTimes:(med.times||[]);
 for(const c of timeChanges){if(stamp<Date.parse(c.at))break;times=c.newTimes;}
 if(!times.includes(time))return false;
 const ruleChanges=history.filter(x=>x.action==='schedule_changed'&&x.previous&&x.next&&Number.isFinite(Date.parse(x.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 let rule=ruleChanges.length?ruleChanges[0].previous:med;
 for(const c of ruleChanges){if(stamp<Date.parse(c.at))break;rule=c.next;}
 if((rule.scheduleType||'daily')==='daily')return true;
 if(rule.scheduleType==='weekdays')return (rule.weekdays||[]).includes(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(day+'T12:00:00').getDay()]);
 if(rule.scheduleType==='explicit_dates')return (rule.explicitDates||[]).includes(day);
 return false;
}
function finalSlot(med,accept=()=>true){
 const start=med.startDate,end=med.endDate||start;
 if(!dayRe.test(start)||!dayRe.test(end)||start>end)throw Error('Invalid course dates');
 const candidates=[...new Set([...(med.times||[]),...(med.rowHistory||[]).flatMap(x=>x.action==='times_changed'?[...(x.previousTimes||[]),...(x.newTimes||[])]:[])])].filter(validTime).sort().reverse();
 const first=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
 if(!Number.isFinite(first.getTime())||!Number.isFinite(last.getTime()))throw Error('Invalid course dates');
 for(let n=0;n<36601;n++){
  const day=new Date(last);day.setDate(last.getDate()-n);
  if(day<first)break;
  const label=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
  for(const time of candidates)if(eligible(med,label,time)&&accept(label,time))return label+'T'+time;
 }
 return null;
}
function active(events){return events.sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||''))).reduce((prev,x)=>x.action==='taken'?x:(cancels.has(x.action)?null:prev),null);}
function forSlot(state,event){return state.intakeLogs.filter(x=>x.medicationId===event.medicationId&&x.plannedAt===event.plannedAt);}
function take(state,event){
 const med=state.medications.find(x=>x.id===event.medicationId);
 if(!med||med.active===false||med.cancelled||med.archivedCompleted)throw Error('Inactive course');
 if(event.action!=='taken'||!event.id||!event.plannedAt||!event.actualAt)throw Error('Invalid intake');
 if(state.intakeLogs.some(x=>x.id===event.id)||active(forSlot(state,event)))throw Error('Intake already recorded');
 const slot=local(event.plannedAt,state.settings?.timezone||'Asia/Yerevan');
 const day=slot.slice(0,10);
 if(day<med.startDate||day>(med.endDate||med.startDate))throw Error('Intake outside course dates');
 if(!eligible(med,day,slot.slice(11)))throw Error('Unscheduled intake');
 state.intakeLogs.push({...event});
 if(finalSlot(med)===slot){
  med.active=false;med.archivedCompleted=true;med.autoArchivedByIntakeId=event.id;med.archivedAt=event.actualAt;
  (med.rowHistory??=[]).push({action:'completed',origin:'auto_final_intake',intakeId:event.id,at:event.actualAt});
 }
}
function cancel(state,event){
 const med=state.medications.find(x=>x.id===event.medicationId);
 if(!med)throw Error('Course not found');
 if(!event.id||!event.plannedAt||!event.actualAt||state.intakeLogs.some(x=>x.id===event.id))throw Error('Invalid cancellation');
 const taken=active(forSlot(state,event));if(!taken)throw Error('No active intake to cancel');
 state.intakeLogs.push({...event,action:'cancel_taken'});
 if(med.archivedCompleted&&!med.cancelled&&med.autoArchivedByIntakeId===taken.id){
  med.archivedCompleted=false;med.active=true;delete med.autoArchivedByIntakeId;delete med.archivedAt;
  (med.rowHistory??=[]).push({action:'completion_reversed',reason:'accidental_taken',intakeId:taken.id,at:event.actualAt});
 }
}
root.MedControlModular3CourseLifecycle=Object.freeze({take,cancel,finalSlot});
})(typeof window!=='undefined'?window:globalThis);
