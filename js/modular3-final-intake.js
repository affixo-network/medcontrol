/* Approved Modular-3 policy: pre-intake hint and atomic completion/archive.
 * Reuses the completed program's intake handlers and date editor.
 */
(function(root){
 'use strict';
 const pending=new Set();
 let wrappedTake=null;
 const enabled=()=>Boolean(root.medcontrolProtectedInterface&&root.MedControlModular3ProtectedSession?.isUnlocked());
 function finalPlannedAt(med){
  if(!med||med.cancelled)return null;
  const normalize=value=>{
   const copy={...value};
   if(copy.scheduleType==='explicit_dates'){
    const dates=(copy.explicitDates||[]).filter(Boolean).slice().sort();
    if(dates.length){copy.startDate=dates[0];copy.endDate=dates.at(-1);}
   }
   return copy;
  };
  try{
   const app=med.temporalApplication;
   const scoped=app&&['today','future','today_future'].includes(app.scope)&&app.todayTemporal?app:null;
   const allowed=(day,time)=>typeof root.isMedicationTimeActiveAt!=='function'||root.isMedicationTimeActiveAt(med,time,new Date(root.getScheduledDateTime(day,time)).getTime());
   const candidates=[root.MedControlModular3CourseLifecycle.finalSlot(normalize(med),(day,time)=>!(scoped&&day===scoped.date)&&allowed(day,time))];
   if(scoped){
    const today={...med,...scoped.todayTemporal,active:true};
    if(scoped.scope!=='future'||root.isMedicationApplicableOnDate(today,scoped.date)){
     candidates.push(root.MedControlModular3CourseLifecycle.finalSlot({...today,startDate:scoped.date,endDate:scoped.date,scheduleType:'daily'},allowed));
    }
   }
   const last=candidates.filter(Boolean).sort().at(-1);
   return last?root.getScheduledDateTime(last.slice(0,10),last.slice(11)):null;
  }catch(_){return null;}
 }
 function effectiveTaken(state,id,plannedAt){
  const base=(state.intakeLogs||[]).filter(x=>x.medicationId===id&&x.plannedAt===plannedAt).sort((a,b)=>new Date(b.actualAt||0)-new Date(a.actualAt||0))[0];
  if(!base||base.action!=='taken')return null;
  const last=(state.intakeCorrections||[]).filter(x=>x.medicationId===id&&x.plannedAt===plannedAt).sort((a,b)=>new Date(a.correctedAt||0)-new Date(b.correctedAt||0)).at(-1);
  if(last&&new Date(last.correctedAt)>new Date(base.actualAt)&&last.after?.action==='reset')return null;
  return base;
 }
 function capture(state){
  return {medications:new Set((state.medications||[]).map(x=>x.id)),logs:new Set((state.intakeLogs||[]).map(x=>x.id)),corrections:new Set((state.intakeCorrections||[]).map(x=>x.id))};
 }
 function history(med,action,message,at,intakeId){
  if(typeof root.recordRowHistory==='function'){
   root.recordRowHistory(med,action,message);
   Object.assign(med.rowHistory[0],{at,origin:'auto_final_intake',intakeId});
  }else (med.rowHistory??=[]).unshift({action,payload:message,at,origin:'auto_final_intake',intakeId});
 }
 function afterChange(state,before){
  if(!enabled())return;
  for(const log of state.intakeLogs||[]){
   if(before.logs.has(log.id)||!before.medications.has(log.medicationId)||log.action!=='taken')continue;
   const med=state.medications.find(x=>x.id===log.medicationId);
   if(!med||med.cancelled||med.archivedCompleted||finalPlannedAt(med)!==log.plannedAt||effectiveTaken(state,med.id,log.plannedAt)?.id!==log.id)continue;
   med.active=false;med.courseCompleted=true;med.archivedCompleted=true;
   med.archivedAt=log.actualAt;med.autoArchivedByIntakeId=log.id;
   history(med,'course_completed','Курс завершён и автоматически отправлен в Архив.',log.actualAt,log.id);
  }
  for(const correction of state.intakeCorrections||[]){
   if(before.corrections.has(correction.id)||correction.reason!=='accident'||correction.after?.action!=='reset')continue;
   const med=state.medications.find(x=>x.id===correction.medicationId);
   if(!med||med.cancelled||!med.archivedCompleted||med.autoArchivedByIntakeId!==correction.primaryLogId||effectiveTaken(state,med.id,correction.plannedAt))continue;
   med.active=true;med.courseCompleted=false;med.archivedCompleted=false;
   delete med.archivedAt;delete med.autoArchivedByIntakeId;
   history(med,'course_completion_reversed','Завершение курса отменено: случайное нажатие «Принято». Исходная запись сохранена.',correction.correctedAt,correction.primaryLogId);
  }
 }
 function confirmFinal(med,run){
  return new Promise(resolve=>{
   const english=root.getState().settings?.interfaceLanguage==='en';
   const dialog=document.createElement('dialog');dialog.id='finalIntakeDialog';
   const title=document.createElement('h2');title.textContent=english?'Last intake of the course':'Последний приём курса';
   const text=document.createElement('p');text.textContent=english?'This is the last intake of the course. To repeat the medication, change the course dates. After confirmation, the completed course will move to Archive automatically. Its full history will be retained.':'Это последний приём курса. Чтобы повторить препарат, измените даты курса. После подтверждения последнего приёма завершённый курс автоматически перейдёт в Архив. Вся история сохранится.';
   const error=document.createElement('p');error.id='finalIntakeError';error.setAttribute('role','status');
   const confirm=document.createElement('button');confirm.id='finalIntakeConfirm';confirm.textContent=english?'Confirm Taken':'Подтвердить «Принято»';
   const dates=document.createElement('button');dates.id='finalIntakeChangeDates';dates.textContent=english?'Change dates':'Изменить даты';
   const cancel=document.createElement('button');cancel.id='finalIntakeCancel';cancel.textContent=english?'Cancel':'Отмена';
   let saving=false,settled=false;
   const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
   dialog.oncancel=event=>{event.preventDefault();if(!saving)finish(false);};
   cancel.onclick=()=>{if(!saving)finish(false);};
   dates.onclick=async()=>{
    if(saving)return;
    finish(false);
    await root.medcontrolNavigateTo('input');
    root.openEditMedication(med.id);
   };
   confirm.onclick=async()=>{
    if(saving)return;
    saving=true;[confirm,dates,cancel].forEach(button=>{button.disabled=true;});error.textContent='';
    try{await run();finish(true);}
    catch(failure){
     error.textContent=(english?'Intake was not saved. Try again. ':'Приём не сохранён. Повторите действие. ')+failure.message;
     saving=false;[confirm,dates,cancel].forEach(button=>{button.disabled=false;});
    }
   };
   dialog.append(title,text,error,confirm,dates,cancel);document.body.append(dialog);dialog.showModal();
  });
 }
 function install(){
  if(!enabled())return;
  if(typeof root.markTaken==='function'&&root.markTaken!==wrappedTake){
   const inherited=root.markTaken;
   wrappedTake=async function(id,plannedAt){
    const state=root.getState(),med=state.medications.find(x=>x.id===id);
    if(!med||med.cancelled||med.archivedCompleted||finalPlannedAt(med)!==plannedAt||effectiveTaken(state,id,plannedAt))return inherited(id,plannedAt);
    const key=id+'|'+plannedAt;if(pending.has(key))return false;
    pending.add(key);
    try{return await confirmFinal(med,async()=>{
     const result=await inherited(id,plannedAt);
     if(result===false||!effectiveTaken(root.getState(),id,plannedAt))throw Error('Запись не подтверждена');
    });}finally{pending.delete(key);}
   };
   root.markTaken=wrappedTake;
  }

 }
 root.MedControlModular3FinalIntake=Object.freeze({finalPlannedAt,capture,afterChange,install});
})(typeof window!=='undefined'?window:globalThis);
