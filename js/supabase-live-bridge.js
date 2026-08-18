(function(){
'use strict';
const URL='https://havdtfcfqhxwdtiqqdej.supabase.co';
const KEY='sb_publishable_WRIoU60I_CWO1oOXYootow_8g3UYdBL';
let c,pid,q=Promise.resolve();
const client=()=>c||(c=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
const clone=v=>JSON.parse(JSON.stringify(v));
const legacyId=(x,p,i)=>String(x?.id??x?.localId??x?.eventId??`${p}-${i}`);
async function session(){const {data,error}=await client().auth.getSession();if(error)throw error;return data?.session||null}
async function patient(state){if(pid)return pid;const s=await session();if(!s)throw new Error('Authentication required');const tz=state?.settings?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';const {data,error}=await client().rpc('mc_get_or_create_patient',{patient_timezone:tz});if(error)throw error;pid=data;return pid}
async function sync(state){
 const s=await session();if(!s)return;
 const p=await patient(state);
 const meds=Array.isArray(state?.medications)?state.medications:[];
 const idMap=new Map();
 for(let i=0;i<meds.length;i++){
  const med=clone(meds[i]);const lid=legacyId(med,'med',i);
  const {data,error}=await client().rpc('mc_upsert_medication',{target_patient_id:p,target_legacy_local_id:lid,target_data:med,target_cancelled:!!med.cancelled});
  if(error)throw error;idMap.set(lid,data);
 }
 const logs=Array.isArray(state?.intakeLogs)?state.intakeLogs:[];
 for(let i=0;i<logs.length;i++){
  const log=clone(logs[i]);const medKey=String(log.medicationId??'');let mid=idMap.get(medKey);
  if(!mid){const {data,error}=await client().from('mc_medications').select('id').eq('patient_id',p).eq('legacy_local_id',medKey).maybeSingle();if(error)throw error;mid=data?.id}
  if(!mid)continue;
  const action=log.action==='cancelled'?'cancelled':'taken';
  const {error}=await client().rpc('mc_upsert_intake_event',{target_patient_id:p,target_medication_id:mid,target_legacy_event_id:legacyId(log,'intake',i),target_event_type:action,target_planned_at:log.plannedAt,target_actual_at:log.actualAt||null,target_status:log.status||null,target_metadata:log});
  if(error)throw error;
 }
}
async function pull(state){
 const s=await session();if(!s)return{state,remote:false};
 const p=await patient(state);
 const [{data:medRows,error:me},{data:logRows,error:le}]=await Promise.all([
  client().from('mc_medications').select('legacy_local_id,data,cancelled').eq('patient_id',p).order('created_at',{ascending:true}),
  client().from('mc_intake_events').select('legacy_event_id,event_type,planned_at,actual_at,status,metadata,medication_id').eq('patient_id',p).order('created_at',{ascending:true})
 ]);
 if(me)throw me;if(le)throw le;
 const meds=(medRows||[]).map(r=>{const m=clone(r.data||{});if(!m.id)m.id=r.legacy_local_id;m.cancelled=!!r.cancelled;return m});
 const medIdByDb=new Map();
 const {data:dbMeds,error:dbe}=await client().from('mc_medications').select('id,legacy_local_id').eq('patient_id',p);if(dbe)throw dbe;(dbMeds||[]).forEach(r=>medIdByDb.set(r.id,r.legacy_local_id));
 const logs=(logRows||[]).map(r=>{const m=clone(r.metadata||{});if(!m.id)m.id=r.legacy_event_id;if(!m.medicationId)m.medicationId=medIdByDb.get(r.medication_id)||m.medicationId;if(!m.plannedAt)m.plannedAt=r.planned_at;if(!m.actualAt)m.actualAt=r.actual_at;if(!m.action)m.action=r.event_type;if(!m.status)m.status=r.status;return m});
 const remote=meds.length>0||logs.length>0;
 if(remote){const next=clone(state);next.medications=meds;next.intakeLogs=logs;return{state:next,remote:true}}
 return{state,remote:false};
}
function queue(state){const snapshot=clone(state);q=q.then(()=>sync(snapshot)).catch(err=>console.error('MedControl Supabase sync failed:',err));return q}
async function probe(){const s=await session();if(!s)return{auth_ok:false,patient_ok:false,write_ok:false,read_ok:false,error:'Authentication required'};const {data,error}=await client().rpc('mc_e2e_roundtrip');if(error)throw error;return data}
async function boot(view){
 try{
  if(typeof window.getState!=='function')return;
  const local=window.getState();
  const loaded=await pull(local);
  if(loaded.remote){
   localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(loaded.state));
   if(typeof window.mount==='function')window.mount(view||'input');
  }else{
   await sync(local);
  }
 }catch(err){console.error('MedControl Supabase boot failed:',err)}
 client().auth.onAuthStateChange(async(event,s)=>{if(!s)return;try{if(typeof window.getState!=='function')return;const local=window.getState();const loaded=await pull(local);if(loaded.remote){localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(loaded.state));if(typeof window.mount==='function')window.mount(view||'input')}else await sync(local)}catch(err){console.error('MedControl Supabase auth sync failed:',err)}});
}
window.MedControlSupabaseBridge={queue,flush:()=>q,probe,pull,client,boot};
window.dispatchEvent(new Event('medcontrol-supabase-bridge-ready'));
})();