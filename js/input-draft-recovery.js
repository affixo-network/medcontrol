(function(){
  const DRAFT_KEY='affixo_medcontrol_standard_v3_input_draft';
  const PREFIX='create_';
  const FIELD_IDS=[
    'name','manufacturer','contentValue','contentUnit','contentUnitOther',
    'intakeQuantity','intakeUnit','intakeUnitOther','details','scheduleType',
    'active','times','weekdays','explicitDates','startDate','endDate'
  ];

  function protectedExists(){return localStorage.getItem('medcontrol_modular3_local_credential_v1')!==null||localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null;}

  function element(id){return document.getElementById(PREFIX+id);}

  function readDraft(){
    if(window.MedControlModular3ProtectedSession?.isUnlocked())return window.MedControlModular3ProtectedSession.read().inputDraft||null;
    if(protectedExists())return null;
    try{
      const raw=localStorage.getItem(DRAFT_KEY);
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      return parsed&&parsed.version===1&&parsed.fields?parsed:null;
    }catch(error){
      console.warn('MedControl: input draft is unreadable.',error);
      return null;
    }
  }

  function collectDraft(){
    const fields={};
    let meaningful=false;
    FIELD_IDS.forEach(id=>{
      const el=element(id);
      if(!el)return;
      if(id==='active')fields[id]=Boolean(el.checked);
      else fields[id]=el.value||'';
      if(id!=='active'&&id!=='scheduleType'&&String(fields[id]).trim())meaningful=true;
    });
    return {version:1,updatedAt:new Date().toISOString(),fields,meaningful};
  }

  let latestDraft=null,draftWriting=null;
  async function persistDraft(){
    const draft=collectDraft();
    if(window.MedControlModular3ProtectedSession?.isUnlocked()){
      latestDraft=draft;
      if(!draftWriting){
        draftWriting=(async()=>{
          try{
            while(latestDraft){
              const captured=latestDraft;latestDraft=null;
              await window.MedControlModular3ProtectedSession.transact(state=>{
                if(captured.meaningful)state.inputDraft=captured;else delete state.inputDraft;
              });
            }
            return true;
          }finally{draftWriting=null;}
        })();
      }
      return draftWriting;
    }
    if(protectedExists())throw Error('Черновик заблокирован. Войдите с локальным паролем.');
    try{
      if(!draft.meaningful){
        localStorage.removeItem(DRAFT_KEY);
        return true;
      }
      localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
      return true;
    }catch(error){
      console.error('MedControl: failed to save input draft.',error);
      return false;
    }
  }

  async function clearDraft(){
    if(window.MedControlModular3ProtectedSession?.isUnlocked()){
      await window.MedControlModular3ProtectedSession.transact(state=>{delete state.inputDraft;});return;
    }
    if(protectedExists())throw Error('Черновик заблокирован. Войдите с локальным паролем.');
    try{localStorage.removeItem(DRAFT_KEY);}catch(error){console.warn('MedControl: failed to clear input draft.',error);}
  }

  function applyDraft(){
    const draft=readDraft();
    if(!draft||!draft.meaningful)return false;
    const fields=draft.fields||{};
    FIELD_IDS.forEach(id=>{
      const el=element(id);
      if(!el||!Object.prototype.hasOwnProperty.call(fields,id))return;
      if(id==='active')el.checked=Boolean(fields[id]);
      else el.value=fields[id]??'';
    });
    const schedule=element('scheduleType');
    if(schedule) schedule.dataset.previousValue=schedule.value||'daily';
    try{window.syncMedicationOtherUnit?.(PREFIX,'content');}catch(_){ }
    try{window.syncMedicationOtherUnit?.(PREFIX,'intake');}catch(_){ }
    try{window.syncCreateScheduleFields?.();}catch(_){ }
    try{window.renderStructuredTimes?.(PREFIX);}catch(_){ }
    try{window.renderStructuredDates?.(PREFIX);}catch(_){ }
    try{window.syncStructuredWeekdays?.(PREFIX);}catch(_){ }
    return true;
  }

  function attachAutosave(){
    const root=document.getElementById('app')||document.body;
    if(!root||root.dataset?.draftAutosaveBound==='1')return;
    if(root.dataset)root.dataset.draftAutosaveBound='1';
    const handler=event=>{
      const target=event.target;
      if(!target?.id?.startsWith(PREFIX))return;
      persistDraft().catch(error=>console.error('Черновик не сохранён.',error));
    };
    root.addEventListener('input',handler,true);
    root.addEventListener('change',handler,true);
    root.addEventListener('click',event=>{
      const target=event.target;
      if(!target)return;
      if(target.closest?.('[onclick*="addStructuredTime(\'create_\')"], [onclick*="removeStructuredTime(\'create_\')"], [onclick*="addStructuredDate(\'create_\')"], [onclick*="removeStructuredDate(\'create_\')"]')){
        setTimeout(persistDraft,0);
      }
    },true);
  }

  const originalMount=window.mount;
  if(typeof originalMount==='function'){
    window.mount=async function(page){
      const result=(await originalMount(page));
      if(page==='input'){
        setTimeout(()=>{
          applyDraft();
          attachAutosave();
        },0);
      }
      return result;
    };
  }

  const originalConfirm=window.confirmMedicationCreate;
  if(typeof originalConfirm==='function'){
    window.confirmMedicationCreate=async function(){
      try{
        const beforeIds=new Set((getState().medications||[]).map(m=>m.id));
        if(!await persistDraft())throw Error('Не удалось сохранить черновик.');
        const result=await originalConfirm.apply(this,arguments);
        const created=getState().medications.some(m=>!beforeIds.has(m.id));
        if(created){
          // Protected course creation clears its draft in the same encrypted transaction.
          if(!window.MedControlModular3ProtectedSession?.isUnlocked())await clearDraft();
          await window.mount('input');
        }
        return result;
      }catch(error){
        window.alert('Не удалось сохранить препарат. Изменения не подтверждены. '+error.message);
        return false;
      }
    };
  }

  window.medControlInputDraft={
    key:DRAFT_KEY,
    save:persistDraft,
    flush:()=>draftWriting||Promise.resolve(true),
    restore:applyDraft,
    clear:clearDraft,
    read:readDraft
  };
})();
