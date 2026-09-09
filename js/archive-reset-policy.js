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
  window.isMedControlMedicationArchival=function(med){return isArchival(med,currentLocalDate());};
  window.areAllMedControlMedicationsArchival=function(){
    const meds=(getState().medications||[]);
    return meds.length>0&&meds.every(med=>isArchival(med,currentLocalDate()));
  };
  window.startMedControlReset=function(){
    const state=getState(),meds=Array.isArray(state.medications)?state.medications:[];
    if(!meds.length){alert('Нет данных для сброса.');return;}
    if(!meds.every(med=>isArchival(med,currentLocalDate()))){
      alert('Полный сброс доступен только тогда, когда все препараты являются архивными.');
      return;
    }
    if(!confirm('Полный сброс удалит все архивные препараты, завершённые курсы, завершённые приёмы «Только сегодня», историю изменений, журнал приёмов и исправлений. Продолжить?'))return;
    resetMedControlData();
  };

  function patchResetUi(){
    const sections=[...document.querySelectorAll('section.card')];
    const section=sections.find(x=>x.querySelector('h2')?.textContent?.trim()==='Управление данными');
    if(!section)return;
    const meds=(getState().medications||[]),canReset=meds.length>0&&meds.every(med=>isArchival(med,currentLocalDate()));
    if(canReset){
      section.innerHTML='<h2>Управление данными</h2><p class="muted">Все препараты являются архивными. При необходимости можно полностью очистить данные MedControl и начать заново.</p><button type="button" onclick="startMedControlReset()">Начать заново</button>';
    }else{
      section.innerHTML='<h2>Управление данными</h2><p class="muted">Полный сброс доступен только тогда, когда все препараты являются архивными.</p>';
    }
  }
  const inherited=window.renderInputPage;
  if(typeof inherited==='function')window.renderInputPage=function(){inherited();patchResetUi();};
})();