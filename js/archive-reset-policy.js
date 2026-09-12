(function(){
  const PREVIEW_INPUT='https://htmlpreview.github.io/?https://github.com/affixo-network/medcontrol/blob/modular-2.000/input.html';

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
    [...document.querySelectorAll('section.card')].forEach(section=>{
      if(section.querySelector('h2')?.textContent?.trim()==='Управление данными')section.remove();
    });
  }

  function lastMedicationHintHtml(med){
    return `<section id="medControlLastMedicationHint" class="card" style="border:2px solid #111827">
      <h2>Остался последний препарат</h2>
      <p><strong>${escapeHtml(med?.name||'Последний препарат')}</strong> — последний незавершённый препарат текущего цикла.</p>
      <p><strong>Внимание:</strong> если до завершения его курса не будут введены новые препараты, после завершения этот препарат автоматически перейдёт в Архив и MedControl автоматически выполнит полный сброс текущего цикла.</p>
      <p><strong>Все архивные данные будут безвозвратно удалены и восстановлению в MedControl не подлежат:</strong> завершённые и отменённые препараты, завершённые приёмы «Только сегодня», удалённые и заменённые времена, история изменений, журнал приёмов и исправлений.</p>
      <p class="muted">Если необходимо сохранить текущий цикл и его Архив, до завершения последнего курса должен быть введён новый действующий препарат. После автоматического сброса можно начинать ввод нового цикла с пустыми данными.</p>
    </section>`;
  }

  function showLastMedicationHint(med){
    if(document.getElementById('medControlLastMedicationHint'))return;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',lastMedicationHintHtml(med));
    else (document.querySelector('.wrap')||document.body).insertAdjacentHTML('afterbegin',lastMedicationHintHtml(med));
  }

  function clearLastMedicationHint(){document.getElementById('medControlLastMedicationHint')?.remove();}

  function inputRedirectUrl(){
    return window.location.hostname==='htmlpreview.github.io' ? PREVIEW_INPUT : 'input.html';
  }

  let resetInProgress=false;
  function automaticCycleReset(){
    if(resetInProgress)return;
    const {meds,current}=medicationState();
    if(!meds.length||current.length)return;
    resetInProgress=true;
    const oldState=getState();
    saveState({settings:{...(oldState.settings||{})},medications:[],intakeLogs:[]});
    try{sessionStorage.setItem('medcontrol_cycle_reset_notice','1');}catch(_){ }
    window.location.replace(inputRedirectUrl());
  }

  function showCycleResetNotice(){
    let shouldShow=false;
    try{
      shouldShow=sessionStorage.getItem('medcontrol_cycle_reset_notice')==='1';
      if(shouldShow)sessionStorage.removeItem('medcontrol_cycle_reset_notice');
    }catch(_){ }
    if(shouldShow)setTimeout(()=>alert('Предыдущий цикл завершён. Последний препарат был переведён в Архив, после чего все данные завершённого цикла и его Архив были безвозвратно удалены. Можно начинать ввод новых препаратов.'),0);
  }

  function evaluateCycle(){
    removeLegacyResetUi();
    const {meds,current}=medicationState();
    if(!meds.length){clearLastMedicationHint();return;}
    if(current.length===0){clearLastMedicationHint();automaticCycleReset();return;}
    if(current.length===1){showLastMedicationHint(current[0]);return;}
    clearLastMedicationHint();
  }

  window.isMedControlMedicationArchival=med=>isArchival(med,currentLocalDate());
  window.areAllMedControlMedicationsArchival=function(){const {meds,current}=medicationState();return meds.length>0&&current.length===0;};
  window.patchMedControlResetUi=evaluateCycle;

  const inheritedMount=window.mount;
  if(typeof inheritedMount==='function')window.mount=function(page){const result=inheritedMount(page);setTimeout(evaluateCycle,0);return result;};
  showCycleResetNotice();
  setTimeout(evaluateCycle,0);
  setInterval(evaluateCycle,15000);
})();