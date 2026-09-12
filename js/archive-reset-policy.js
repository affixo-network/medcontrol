(function(){
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
    const archived=meds.filter(med=>isArchival(med,today));
    return {meds,current,archived};
  }

  function removeLegacyResetUi(){
    document.getElementById('medControlArchiveCompleteReminder')?.remove();
    [...document.querySelectorAll('section.card')].forEach(section=>{
      const title=section.querySelector('h2')?.textContent?.trim();
      if(title==='Управление данными')section.remove();
    });
  }

  function lastMedicationHintHtml(med){
    return `<section id="medControlLastMedicationHint" class="card" style="border:2px solid #111827">
      <h2>Остался последний препарат</h2>
      <p><strong>${escapeHtml(med?.name||'Последний препарат')}</strong> — последний незавершённый препарат текущего цикла.</p>
      <p class="muted">Если до завершения его курса не будут введены новые препараты, после завершения курс автоматически перейдёт в Архив, затем MedControl автоматически полностью очистит препараты текущего цикла, Архив, историю изменений, журнал приёмов и исправлений.</p>
      <p class="muted">После автоматической очистки можно сразу начинать ввод нового цикла препаратов.</p>
    </section>`;
  }

  function showLastMedicationHint(med){
    const existing=document.getElementById('medControlLastMedicationHint');
    if(existing)return;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',lastMedicationHintHtml(med));
    else{
      const wrap=document.querySelector('.wrap')||document.body;
      wrap.insertAdjacentHTML('afterbegin',lastMedicationHintHtml(med));
    }
  }

  function clearLastMedicationHint(){
    document.getElementById('medControlLastMedicationHint')?.remove();
  }

  let resetInProgress=false;
  function automaticCycleReset(){
    if(resetInProgress)return;
    const {meds,current}=medicationState();
    if(!meds.length||current.length)return;
    resetInProgress=true;

    const oldState=getState();
    const fresh={
      settings:{...(oldState.settings||{})},
      medications:[],
      intakeLogs:[]
    };
    saveState(fresh);

    try{sessionStorage.setItem('medcontrol_cycle_reset_notice','1');}catch(_){ }
    window.location.href='input.html';
  }

  function showCycleResetNotice(){
    let shouldShow=false;
    try{
      shouldShow=sessionStorage.getItem('medcontrol_cycle_reset_notice')==='1';
      if(shouldShow)sessionStorage.removeItem('medcontrol_cycle_reset_notice');
    }catch(_){ }
    if(!shouldShow)return;
    setTimeout(()=>alert('Предыдущий цикл завершён. Последний препарат был переведён в Архив, после чего данные завершённого цикла автоматически полностью очищены. Можно начинать ввод новых препаратов.'),0);
  }

  function evaluateCycle(){
    removeLegacyResetUi();
    const {meds,current}=medicationState();
    if(!meds.length){
      clearLastMedicationHint();
      return;
    }
    if(current.length===0){
      clearLastMedicationHint();
      automaticCycleReset();
      return;
    }
    if(current.length===1){
      showLastMedicationHint(current[0]);
      return;
    }
    clearLastMedicationHint();
  }

  window.isMedControlMedicationArchival=function(med){
    return isArchival(med,currentLocalDate());
  };
  window.areAllMedControlMedicationsArchival=function(){
    const {meds,current}=medicationState();
    return meds.length>0&&current.length===0;
  };
  window.patchMedControlResetUi=evaluateCycle;

  const inheritedMount=window.mount;
  if(typeof inheritedMount==='function'){
    window.mount=function(page){
      const result=inheritedMount(page);
      setTimeout(evaluateCycle,0);
      return result;
    };
  }

  showCycleResetNotice();
  setTimeout(evaluateCycle,0);
  setInterval(evaluateCycle,15000);
})();