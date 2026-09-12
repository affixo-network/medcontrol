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

  function allArchival(){
    const meds=(getState().medications||[]);
    return meds.length>0&&meds.every(med=>isArchival(med,currentLocalDate()));
  }

  window.isMedControlMedicationArchival=function(med){
    return isArchival(med,currentLocalDate());
  };
  window.areAllMedControlMedicationsArchival=allArchival;

  window.startMedControlReset=function(){
    const meds=(getState().medications||[]);
    if(!meds.length){alert('Нет данных для сброса.');return;}
    if(!allArchival()){
      alert('Полный сброс доступен только после завершения всех процедур, когда все препараты находятся в Архиве.');
      return;
    }
    if(!confirm('Все процедуры завершены, и все препараты находятся в Архиве.\n\nПолный сброс удалит архивные препараты, завершённые курсы, завершённые приёмы «Только сегодня», удалённые и заменённые времена, историю изменений, журнал приёмов и исправлений.\n\nВыполнить полный сброс данных MedControl?'))return;
    if(typeof window.resetMedControlData==='function'){
      window.resetMedControlData();
      return;
    }
    alert('Сброс сейчас недоступен на этой странице. Перейдите во «Ввод» и повторите действие.');
  };

  function removeLegacyResetSection(){
    [...document.querySelectorAll('section.card')].forEach(section=>{
      if(section.querySelector('h2')?.textContent?.trim()==='Управление данными')section.remove();
    });
  }

  function reminderHtml(){
    return `<section id="medControlArchiveCompleteReminder" class="card" style="border:2px solid #111827">
      <h2>Все процедуры завершены</h2>
      <p><strong>Все препараты и завершённые процедуры находятся в Архиве.</strong></p>
      <p class="muted">Это момент, когда доступен полный сброс MedControl. Если архив и история должны сохраниться, ничего не сбрасывайте.</p>
      <p class="muted">Полный сброс удалит завершённые и отменённые препараты, завершённые приёмы «Только сегодня», удалённые и заменённые времена, историю изменений, журнал приёмов и исправлений.</p>
      <button type="button" onclick="startMedControlReset()">Полный сброс</button>
    </section>`;
  }

  function patchGlobalReminder(){
    removeLegacyResetSection();
    const old=document.getElementById('medControlArchiveCompleteReminder');
    if(!allArchival()){
      if(old)old.remove();
      return;
    }
    if(old)return;
    const topbar=document.querySelector('.topbar');
    if(topbar)topbar.insertAdjacentHTML('afterend',reminderHtml());
    else{
      const wrap=document.querySelector('.wrap')||document.body;
      wrap.insertAdjacentHTML('afterbegin',reminderHtml());
    }
  }

  window.patchMedControlResetUi=patchGlobalReminder;

  const inheritedMount=window.mount;
  if(typeof inheritedMount==='function'){
    window.mount=function(page){
      const result=inheritedMount(page);
      setTimeout(patchGlobalReminder,0);
      return result;
    };
  }

  setTimeout(patchGlobalReminder,0);
  setInterval(patchGlobalReminder,15000);
})();