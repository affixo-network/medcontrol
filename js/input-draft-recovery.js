(function(){
  const DRAFT_KEY='affixo_medcontrol_standard_v3_input_draft';
  const PREFIX='create_';
  const FIELD_IDS=[
    'name','manufacturer','contentValue','contentUnit','contentUnitOther',
    'intakeQuantity','intakeUnit','intakeUnitOther','details','scheduleType',
    'active','times','weekdays','explicitDates','startDate','endDate'
  ];

  function element(id){return document.getElementById(PREFIX+id);}

  function readDraft(){
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

  function persistDraft(){
    const draft=collectDraft();
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

  function clearDraft(){
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
      persistDraft();
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
    window.mount=function(page){
      const result=originalMount(page);
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
    window.confirmMedicationCreate=function(){
      const beforeIds=new Set((getState().medications||[]).map(m=>m.id));
      persistDraft();
      const result=originalConfirm.apply(this,arguments);
      const after=(getState().medications||[]);
      const created=after.some(m=>!beforeIds.has(m.id));
      if(created)clearDraft();
      return result;
    };
  }

  window.medControlInputDraft={
    key:DRAFT_KEY,
    save:persistDraft,
    restore:applyDraft,
    clear:clearDraft,
    read:readDraft
  };
})();
