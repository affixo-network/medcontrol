window.medcontrolScriptReady = (async function(){
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
    if(med.archivedCompleted===true)return true;
    return false;
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

  async function restoreAccidentalAutomaticReset(){
    if(window.MedControlModular3ProtectedSession?.isUnlocked())return false;
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
      if(!(await saveStateAsync(backup.state,{skipCloudSnapshot:true})))return false;
      localStorage.setItem(RECOVERED_AUTORESET_KEY,new Date().toISOString());
      return true;
    }catch(error){
      console.error('MedControl: automatic-reset recovery failed.',error);
      return false;
    }
  }

  function allMedicalRecordsArchived(state){
    const meds=state.medications;
    if(!Array.isArray(meds)||!meds.length||meds.some(m=>!m||m.cancelled||m.archivedCompleted!==true||!m.id))return false;
    const ids=new Set(meds.map(m=>String(m.id)));
    if(ids.size!==meds.length)return false;
    for(const field of ['intakeLogs','intakeCorrections','archiveHistory','archivedCourses']){
      const entries=state[field];
      if(entries!=null&&!Array.isArray(entries))return false;
      for(const entry of entries||[]){
        const linkedId=field==='archivedCourses'?(entry?.medicationId||entry?.id):entry?.medicationId;
        if(!linkedId||!ids.has(String(linkedId)))return false;
      }
    }
    return true;
  }

  let resetInProgress=false;
  async function manualCycleReset(){
    if(resetInProgress)return;
    // Never export protected medical state into a plaintext cycle-reset backup.
    const protectedExists=localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null||
      localStorage.getItem('medcontrol_modular3_local_credential_v1')!==null;
    if(protectedExists){
      const session=window.MedControlModular3ProtectedSession;
      if(!session?.isUnlocked())throw Error('Войдите с локальным паролем.');
      const {meds,current}=medicationState();
      if(!meds.length||current.length||!allMedicalRecordsArchived(getState()))return;
      if(!window.confirm('Начать заново? Все медицинские записи, история и архив будут безвозвратно удалены. Отменить удаление после подтверждения невозможно.'))return;
      resetInProgress=true;
      const cloudSnapshots=window.medcontrolCloudSnapshot;
      let resetCommitted=false;
      try{
        if(!cloudSnapshots?.suspendForReset)throw Error('Приостановка облачного резервирования недоступна. Сброс отменён.');
        const pendingSnapshot=await cloudSnapshots.suspendForReset();
        if(!pendingSnapshot?.ok&&!pendingSnapshot?.skipped)throw Error('Ожидающая облачная копия завершилась ошибкой. Сброс отменён.');
        if(cloudSnapshots?.verifyOwnSnapshotInventoryForReset){
          const inventory=await cloudSnapshots.verifyOwnSnapshotInventoryForReset();
          if(!inventory.ok)throw Error('Не удалось проверить облачные резервные копии. Сброс отменён.');
          // Inventory verified; the confirmed cleanup follows local safety checks.
        }else{
          throw Error('Проверка облачных резервных копий недоступна. Сброс отменён.');
        }
        // T-038: never report a complete reset while legacy medical backups remain.
        // Collect legacy medical storage for deletion only after user confirmation.
        // Never include the protected encrypted vault or local credential.
        const legacyMedicalKeys=[];
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);
          if(key&&(key==='affixo_medcontrol_standard_v3'||
            /^affixo_medcontrol_standard_v3_(?:before_cloud_restore_|.*(?:backup|snapshot))/i.test(key)))
            legacyMedicalKeys.push(key);
        }
        // The cloud inventory must be empty before committing the protected reset.
        // An authenticated, confirmed deletion is performed through the owner-scoped helper.
        if(!cloudSnapshots.deleteOwnSnapshotsForConfirmedReset)
          throw Error('Безопасное удаление облачных копий недоступно.');
        const deletion=await cloudSnapshots.deleteOwnSnapshotsForConfirmedReset();
        if(!deletion?.ok||!deletion.empty)
          throw Error('Облачные копии не удалены полностью. Сброс отменён.');
        // Re-check the cloud inventory immediately before committing the encrypted reset.
        // A new owner-scoped snapshot appearing during preflight must block completion.
        const finalInventory=await cloudSnapshots.verifyOwnSnapshotInventoryForReset();
        if(!finalInventory?.ok||!finalInventory.empty)
          throw Error('Повторная проверка облачных копий не пройдена. Полный сброс отменён.');
        await session.transact(state=>{
          if(!allMedicalRecordsArchived(state))throw Error('Не все медицинские записи принадлежат завершённым архивным курсам.');
          delete state.cycleBackups;
          state.medications=[];state.intakeLogs=[];state.intakeCorrections=[];state.archiveHistory=[];state.archivedCourses=[];
          delete state.inputDraft;
          delete state.deletedTimes;
          delete state.replacedTimes;
        });
        resetCommitted=true;
        // The protected transaction is durable; now clear old plaintext copies.
        for(const key of legacyMedicalKeys)localStorage.removeItem(key);
        // Catch backups written between the initial inventory and the commit.
        // Repeat once against the current storage inventory before verification.
        const lateMedicalKeys=[];
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);
          if(key&&(key==='affixo_medcontrol_standard_v3'||
            /^affixo_medcontrol_standard_v3_(?:before_cloud_restore_|.*(?:backup|snapshot))/i.test(key)))
            lateMedicalKeys.push(key);
        }
        for(const key of lateMedicalKeys)localStorage.removeItem(key);
        // Verify that no legacy plaintext medical data appeared while the encrypted
        // transaction was committing. Never report a complete wipe if it did.
        const remainingLegacyKeys=[];
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);
          if(key&&(key==='affixo_medcontrol_standard_v3'||
            /^affixo_medcontrol_standard_v3_(?:before_cloud_restore_|.*(?:backup|snapshot))/i.test(key)))
            remainingLegacyKeys.push(key);
        }
        if(remainingLegacyKeys.length)
          throw Error('После защищённого сброса обнаружены локальные медицинские копии. Полная очистка не подтверждена.');
        // Navigation is secondary: the encrypted reset has already committed.
        // Do not report a successful reset as failed solely because navigation fails.
        try{await window.medcontrolNavigateTo('input');}
        catch(navigationError){console.error('MedControl: reset committed, navigation failed.',navigationError);window.alert('Медицинские записи сброшены, но переход в раздел «Ввод» не выполнен. Откройте раздел вручную.');}
      }catch(error){window.alert('Не удалось начать новый цикл: '+error.message);}
      finally{
        if(!resetCommitted)cloudSnapshots?.resumeAfterResetFailure?.();
        resetInProgress=false;
      }
      return;
    }
    const {meds,current}=medicationState();
    if(!meds.length||current.length||meds.some(med=>med.cancelled||med.archivedCompleted!==true))return;
    window.alert('Полный сброс временно недоступен в обычном режиме: прежние медицинские записи могут сохраниться в резервных копиях. Данные не изменены.');
    return;

  }
  window.manualMedControlCycleReset=manualCycleReset;

  function showCycleReady(){
    if(document.getElementById('medControlCycleReady'))return;
    const html=`<section id="medControlCycleReady" class="card" style="border:2px solid #111827"><h2>Цикл завершён</h2><p>Все курсы применения препаратов завершены или отменены. Данные сохранены и доступны в Архиве.</p><p><strong>Сначала проверьте Архив.</strong> После проверки можно начать новый цикл.</p><button type="button" onclick="manualMedControlCycleReset()">Начать заново</button></section>`;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',html);
    else(document.querySelector('.wrap')||document.body).insertAdjacentHTML('afterbegin',html);
  }

  function evaluateCycle(){
    removeLegacyResetUi();
    const {meds,current}=medicationState();
    const unfinished=current.filter(med=>!med.courseCompleted);
    if(!meds.length){clearLastMedicationHint();return;}
    if(current.length===0&&meds.every(med=>!med.cancelled&&med.archivedCompleted===true)){clearLastMedicationHint();showCycleReady();return;}
    document.getElementById('medControlCycleReady')?.remove();
    if(unfinished.length===1){
      clearLastMedicationHint();
      showLastMedicationHint(unfinished[0]);
      return;
    }
    clearLastMedicationHint();
  }

  const restored=(await restoreAccidentalAutomaticReset());
  if(restored){
    setTimeout(()=>window.location.reload(),0);
    return;
  }

  window.isMedControlMedicationArchival=med=>isArchival(med,currentLocalDate());
  window.areAllMedControlMedicationsArchival=function(){const {meds,current}=medicationState();return meds.length>0&&current.length===0;};
  window.patchMedControlResetUi=evaluateCycle;
  const inheritedMount=window.mount;
  if(typeof inheritedMount==='function')window.mount=async function(page){const result=(await inheritedMount(page));setTimeout(evaluateCycle,0);return result;};
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