(function(){
'use strict';
const K='affixo_medcontrol_standard_v3';
function clone(v){return JSON.parse(JSON.stringify(v));}
function normalizeMedication(row){
  const d=clone(row.data||{});
  d.id=d.id||row.legacy_local_id;
  d.cancelled=!!row.cancelled;
  d.times=Array.isArray(d.times)?d.times:[];
  return d;
}
async function restore(view){
  try{
    const b=window.MedControlSupabaseBridge;
    if(!b||!b.client||typeof getState!=='function')return false;
    const c=b.client(),{data:s,error:se}=await c.auth.getSession();
    if(se)throw se;if(!s?.session)return false;
    const local=getState(),tz=local?.settings?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
    const {data:p,error:pe}=await c.rpc('mc_get_or_create_patient',{patient_timezone:tz});if(pe)throw pe;
    const [{data:m,error:me},{data:i,error:ie}]=await Promise.all([
      c.from('mc_medications').select('id,legacy_local_id,data,cancelled,created_at').eq('patient_id',p).order('created_at'),
      c.from('mc_intake_events').select('legacy_event_id,event_type,planned_at,actual_at,status,metadata,medication_id,created_at').eq('patient_id',p).order('created_at')
    ]);
    if(me)throw me;if(ie)throw ie;
    const meds=m||[],logs=i||[];
    if(!meds.length&&!logs.length)return false;
    const map=new Map(meds.map(r=>[r.id,r.legacy_local_id]));
    const next=clone(local);
    next.medications=meds.map(normalizeMedication);
    next.intakeLogs=logs.map(r=>{
      const x=clone(r.metadata||{});
      x.id=x.id||r.legacy_event_id;
      x.medicationId=x.medicationId||map.get(r.medication_id);
      x.plannedAt=x.plannedAt||r.planned_at;
      x.actualAt=x.actualAt||r.actual_at;
      x.action=x.action||r.event_type;
      x.status=x.status||r.status;
      return x;
    });
    localStorage.setItem(K,JSON.stringify(next));
    if(typeof mount==='function')mount(view);
    return true;
  }catch(e){console.error('MedControl restore failed:',e);return false;}
}
window.MedControlSupabaseRestore={restore};
})();