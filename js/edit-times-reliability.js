(function(){
  function hiddenTimes(){
    const input=document.getElementById('edit_times');
    if(!input||!input.value.trim()) return [];
    return input.value.split(',').map(v=>v.trim()).filter(Boolean);
  }

  function writeTimes(values){
    const input=document.getElementById('edit_times');
    if(!input) return;
    input.value=[...new Set(values)].sort().join(',');
    if(typeof window.renderStructuredTimes==='function') window.renderStructuredTimes('edit_');
  }

  window.addStructuredTime=function(prefix){
    if(prefix!=='edit_'){
      const hour=document.getElementById(`${prefix}timeHour`)?.value;
      const minute=document.getElementById(`${prefix}timeMinute`)?.value;
      if(hour==null||minute==null) return;
      const input=document.getElementById(`${prefix}times`);
      const values=input?.value?input.value.split(',').map(v=>v.trim()).filter(Boolean):[];
      const value=`${hour}:${minute}`;
      if(values.includes(value)){if(typeof showMedicationHint==='function')showMedicationHint('duplicate_time');return;}
      values.push(value);
      if(input) input.value=[...new Set(values)].sort().join(',');
      if(typeof window.renderStructuredTimes==='function') window.renderStructuredTimes(prefix);
      return;
    }

    const hour=document.getElementById('edit_timeHour')?.value;
    const minute=document.getElementById('edit_timeMinute')?.value;
    if(hour==null||minute==null) return;
    const value=`${hour}:${minute}`;
    const values=hiddenTimes();
    if(values.includes(value)){
      if(typeof showMedicationHint==='function') showMedicationHint('duplicate_time');
      document.getElementById('edit_times')?.removeAttribute('data-pending-time');
      return;
    }
    values.push(value);
    writeTimes(values);
    document.getElementById('edit_times')?.removeAttribute('data-pending-time');
  };

  const originalOpenEditMedication=window.openEditMedication;
  if(typeof originalOpenEditMedication==='function'){
    window.openEditMedication=function(id){
      const result=originalOpenEditMedication.apply(this,arguments);
      const hidden=document.getElementById('edit_times');
      const hour=document.getElementById('edit_timeHour');
      const minute=document.getElementById('edit_timeMinute');
      const markPending=()=>hidden?.setAttribute('data-pending-time','1');
      hour?.addEventListener('change',markPending);
      minute?.addEventListener('change',markPending);
      return result;
    };
  }

  const originalSaveMedicationEdit=window.saveMedicationEdit;
  if(typeof originalSaveMedicationEdit==='function'){
    window.saveMedicationEdit=function(id){
      const hidden=document.getElementById('edit_times');
      if(hidden?.dataset.pendingTime==='1'){
        window.addStructuredTime('edit_');
      }
      return originalSaveMedicationEdit.apply(this,arguments);
    };
  }
})();
