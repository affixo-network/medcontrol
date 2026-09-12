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
    if(!confirm('Сброс не обязателен. Без сброса можно продолжить работу и добавлять новые препараты, а архив и история сохранятся.\n\nЕсли продолжить сброс, будут удалены все архивные препараты, завершённые курсы, завершённые приёмы «Только сегодня», история изменений, журнал приёмов и исправлений.\n\nВыполнить полный сброс?'))return;
    resetMedControlData();
  };

  function resetSectionHtml(){
    if(!allArchival())return '<h2>Управление данными</h2><p class="muted">Полный сброс доступен только тогда, когда все препараты являются архивными.</p>';
    return '<h2>Управление данными</h2><p><strong>Все препараты находятся в архиве.</strong></p><p class="muted">Сброс не обязателен. Вы можете продолжить работу без сброса: перейти во «Ввод» и добавить новые препараты — архив и вся история сохранятся.</p><p class="muted">Кнопка «Начать заново» нужна только если вы хотите полностью очистить архив, историю изменений и журнал приёмов и начать MedControl с пустыми данными.</p><button type="button" onclick="startMedControlReset()">Начать заново</button>';
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