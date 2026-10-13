(function(root){'use strict';
// Opt-in Modular-3 preview only. Never auto-load into the live app.
const tx=root.MedControlModular3RealPageTransaction;
const gate=root.MedControlModular3WriteThroughPreview;
if(!tx||!gate)throw Error('Encrypted preview transaction unavailable');
let busy=false;
async function commit(mutator,done){
 if(busy)return false;
 busy=true;
 try{
  if(!gate.status().active)throw Error('Preview vault locked');
  await tx.transact(mutator);
  if(done)done();
  return true;
 }catch(error){
  console.error('Encrypted intake commit failed',error);
  root.alert('Операция не сохранена. Проверьте защищённое хранилище.');
  return false;
 }finally{busy=false;}
}
root.MedControlModular3ActionPreview=Object.freeze({
 install(){
  if(!gate.status().active)throw Error('Preview vault not active');
  root.markTaken=function(medicationId,plannedAt){
   const actualAt=nowISO();
   return commit(state=>{
    if(!state.medications.some(m=>m.id===medicationId))throw Error('Medication not found');
    if(state.intakeLogs.some(log=>log.medicationId===medicationId&&log.plannedAt===plannedAt&&log.action==='taken'))throw Error('Intake already recorded');
    state.intakeLogs=state.intakeLogs.filter(log=>!(log.medicationId===medicationId&&log.plannedAt===plannedAt));
    state.intakeLogs.push({id:uid(),medicationId,plannedAt,actualAt,action:'taken',status:computeStatusForLog(plannedAt,actualAt,'taken')});
   },()=>mount('action'));
  };
  root.applyCorrection=function(medicationId,plannedAt){
   const reason=document.getElementById('correction_reason')?.value;
   if(reason!=='accident'){root.alert('Допустима только причина «Случайность».');return false;}
   const state=getState();
   const base=state.intakeLogs.find(log=>log.medicationId===medicationId&&log.plannedAt===plannedAt&&log.action==='taken');
   if(!base)return false;
   if(!root.confirm('Отменить случайную отметку «Принято»? Исходная запись останется в истории.'))return false;
   const correctedAt=nowISO();
   return commit(next=>{
    if(!next.intakeLogs.some(log=>log.id===base.id))throw Error('Original record missing');
    next.intakeCorrections=next.intakeCorrections||[];
    const ordinal=next.intakeCorrections.filter(x=>x.medicationId===medicationId&&x.plannedAt===plannedAt).length+1;
    next.intakeCorrections.push({id:uid(),medicationId,plannedAt,primaryLogId:base.id,ordinal,reason:'accident',correctedAt,before:{actualAt:base.actualAt,action:'taken',status:base.status},after:{actualAt:null,action:'reset',status:null}});
   },()=>{document.getElementById('correctionDialog')?.close();mount('action');});
  };
  return true;
 },
 busy:()=>busy
});
})(window);
