(function(){
  const PREVIEW_INPUT='https://htmlpreview.github.io/?https://github.com/affixo-network/medcontrol/blob/modular-2.000/input.html';
  const CYCLE_RESET_BACKUP_KEY='affixo_medcontrol_standard_v3_pre_reset_backup';
  const RECOVERED_AUTORESET_KEY='affixo_medcontrol_standard_v3_autoreset_recovered';
  const MANUAL_RESET_MARKER_KEY='affixo_medcontrol_standard_v3_manual_reset_marker';

  function lastScheduledDate(med){
    const type=med?.scheduleType||((med?.explicitDates||[]).length?'explicit_dates':(med?.weekdays||[]).length?'weekdays':'daily');
    if(type==='explicit_dates'){
      const dates=(med.explicitDates||[]).filter(Boolean).slice().sort();
      return dates[dates.length-1]||'';
    }
    return med?.endDate||'';
  }
  function isArchival(med,today){
    if(!med)return true;
    if(med.cancelled)return true;
    const end=lastScheduledDate(med);
    return Boolean(end&&end<today);
  }
  function medicationState(){
    const meds=(getState().medications||[]);
    const today=currentLocalDate();
    const current=meds.filter(med=>!isArchival(med,today));
    return {meds,current};
  }
  function removeLegacyResetUi(){
    document.getElementById('medControlArchiveCompleteReminder')?.remove();
    document.getElementById('medControlCycleReady')?.remove();
    [...document.querySelectorAll('section.card')].forEach(section=>{
      if(section.querySelector('h2')?.textContent?.trim()==='Управление данными')section.remove();
    });
  }
  function lastMedicationHintHtml(med){
    return `<section id="medControlLastMedicationHint" class="card" style="border:2px solid #111827"><h2>Остался последний препарат</h2><p><strong>${escapeHtml(med?.name||'Последний препарат')}</strong> — последний незавершённый препарат текущего цикла.</p><p>После его завершения или отмены данные останутся в MedControl и Архиве до явной команды пользователя «Начать заново».</p></section>`;
  }
  function showLastMedicationHint(med){
    if(document.getElementById('medControlLastMedicationHint'))return;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',lastMedicationHintHtml(med));
    else(document.querySelector('.wrap')||document.body).insertAdjacentHTML('afterbegin',lastMedicationHintHtml(med));
  }
  function clearLastMedicationHint(){document.getElementById('medControlLastMedicationHint')?.remove();}

  function preserveCycleResetBackup(oldState,reason='manual_cycle_reset'){
    const backup={createdAt:new Date().toISOString(),reason,sourceVersion:'modular-2.000',state:oldState};
    try{localStorage.setItem(CYCLE_RESET_BACKUP_KEY,JSON.stringify(backup));return true;}
    catch(error){
      console.error('MedControl: failed to preserve pre-reset backup.',error);
      window.alert('Сброс остановлен: не удалось создать резервную копию текущего цикла. Данные не изменены.');
      return false;
    }
  }

  function restoreAccidentalAutomaticReset(){
    let state;
    try{state=getState();}catch(_){return false;}
    if((state.medications||[]).length)return false;
    let recovered='',manual='';
    try{
      recovered=localStorage.getItem(RECOVERED_AUTORESET_KEY)||'';
      manual=localStorage.getItem(MANUAL_RESET_MARKER_KEY)||'';
      if(recovered||manual)return false;
      const raw=localStorage.getItem(CYCLE_RESET_BACKUP_KEY);
      if(!raw)return false;
      const backup=JSON.parse(raw);
      if(backup?.reason!=='automatic_cycle_reset'||!backup.state||!Array.isArray(backup.state.medications)||!backup.state.medications.length)return false;
      if(!saveState(backup.state,{skipCloudSnapshot:true}))return false;
      localStorage.setItem(RECOVERED_AUTORESET_KEY,new Date().toISOString());
      return true;
    }catch(error){
      console.error('MedControl: automatic-reset recovery failed.',error);
      return false;
    }
  }

  let resetInProgress=false;
  async function manualCycleReset(){
    if(resetInProgress)return;
    const {meds,current}=medicationState();
    if(!meds.length||current.length)return;
    if(!window.confirm('Начать заново?\n\nТекущий цикл уже находится в Архиве. После сброса рабочие данные этого цикла будут очищены. Резервная копия будет сохранена.'))return;
    resetInProgress=true;
    const oldState=getState();
    if(!preserveCycleResetBackup(oldState,'manual_cycle_reset')){resetInProgress=false;return;}
    if(window.medcontrolCloudSnapshot&&window.medcontrolSupabaseUser){
      const flushed=await window.medcontrolCloudSnapshot.flush();
      if(flushed&&flushed.ok===false&&!flushed.skipped){
        resetInProgress=false;
        window.alert('Сброс остановлен: ожидающая cloud-копия не была подтверждена. Данные не изменены.');
        return;
      }
      const cloud=await window.medcontrolCloudSnapshot.create({state:oldState});
      if(!cloud.ok){
        resetInProgress=false;
        window.alert('Сброс остановлен: cloud snapshot подтвердить не удалось. Данные не изменены.');
        return;
      }
    }
    try{localStorage.setItem(MANUAL_RESET_MARKER_KEY,new Date().toISOString());}catch(_){}
    const ok=saveState({settings:{...(oldState.settings||{})},medications:[],intakeLogs:[]},{skipCloudSnapshot:true});
    if(!ok){resetInProgress=false;return;}
    window.location.replace(window.location.hostname==='htmlpreview.github.io'?PREVIEW_INPUT:'input.html');
  }
  window.manualMedControlCycleReset=manualCycleReset;

  function showCycleReady(){
    if(document.getElementById('medControlCycleReady'))return;
    const html=`<section id="medControlCycleReady" class="card" style="border:2px solid #111827"><h2>Цикл завершён</h2><p>Все препараты завершены или отменены. Данные сохранены и доступны в Архиве.</p><p><strong>Сначала проверьте Архив.</strong> После проверки можно начать новый цикл.</p><button type="button" onclick="manualMedControlCycleReset()">Начать заново</button></section>`;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',html);
    else(document.querySelector('.wrap')||document.body).insertAdjacentHTML('afterbegin',html);
  }

  function evaluateCycle(){
    removeLegacyResetUi();
    const {meds,current}=medicationState();
    if(!meds.length){clearLastMedicationHint();return;}
    if(current.length===0){clearLastMedicationHint();showCycleReady();return;}
    if(current.length===1){showLastMedicationHint(current[0]);return;}
    clearLastMedicationHint();
  }

  const restored=restoreAccidentalAutomaticReset();
  if(restored){
    setTimeout(()=>window.location.reload(),0);
    return;
  }

  window.isMedControlMedicationArchival=med=>isArchival(med,currentLocalDate());
  window.areAllMedControlMedicationsArchival=function(){const {meds,current}=medicationState();return meds.length>0&&current.length===0;};
  window.patchMedControlResetUi=evaluateCycle;
  const inheritedMount=window.mount;
  if(typeof inheritedMount==='function')window.mount=function(page){const result=inheritedMount(page);setTimeout(evaluateCycle,0);return result;};
  function scheduleNextDayCheck(){
    if(window.__medcontrolCycleDayTimer)clearTimeout(window.__medcontrolCycleDayTimer);
    const now=new Date();
    const next=new Date(now);
    next.setHours(24,0,1,0);
    window.__medcontrolCycleDayTimer=setTimeout(()=>{
      evaluateCycle();
      scheduleNextDayCheck();
    },Math.max(1000,next.getTime()-now.getTime()));
  }
  setTimeout(evaluateCycle,0);
  scheduleNextDayCheck();
})();