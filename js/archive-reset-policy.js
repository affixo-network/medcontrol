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
  window.isMedControlMedicationArchival=function(med){return isArchival(med,currentLocalDate());};
  window.areAllMedControlMedicationsArchival=allArchival;
  window.startMedControlReset=function(){
    const state=getState(),meds=Array.isArray(state.medications)?state.medications:[];
    if(!meds.length){alert('Нет данных для сброса.');return;}
    if(!allArchival()){
      alert('Полный сброс доступен только тогда, когда все препараты являются архивными.');
      return;
    }
    if(!confirm('Полный сброс удалит все архивные препараты, завершённые курсы, завершённые приёмы «Только сегодня», историю изменений, журнал приёмов и исправлений. Продолжить?'))return;
    resetMedControlData();
  };

  function resetSectionHtml(){
    if(!allArchival())return '<h2>Управление данными</h2><p class="muted">Полный сброс доступен только тогда, когда все препараты являются архивными.</p>';
    return '<h2>Управление данными</h2><p class="muted">Все препараты находятся в архиве. Можно полностью очистить данные MedControl и начать новый цикл.</p><button type="button" onclick="startMedControlReset()">Начать заново</button>';
  }
  function patchResetUi(){
    const sections=[...document.querySelectorAll('section.card')];
    let section=sections.find(x=>x.querySelector('h2')?.textContent?.trim()==='Управление данными');
    if(!section&&document.querySelector('h1')?.textContent?.includes('Архив')){
      section=document.createElement('section');
      section.className='card';
      document.querySelector('.wrap')?.appendChild(section);
    }
    if(section)section.innerHTML=resetSectionHtml();
  }
  const inherited=window.renderInputPage;
  if(typeof inherited==='function')window.renderInputPage=function(){inherited();patchResetUi();};
  window.patchMedControlResetUi=patchResetUi;
  setTimeout(patchResetUi,0);
})();