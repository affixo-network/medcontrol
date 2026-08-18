(function(){
'use strict';
async function flush(){
  const b=window.MedControlSupabaseBridge;
  if(!b)return;
  try{await b.flush();}catch(e){console.error('MedControl cloud flush failed',e);}
}
function wrap(name){
  const original=window[name];
  if(typeof original!=='function'||original.__mcWrapped)return;
  const wrapped=async function(...args){
    const result=await original.apply(this,args);
    await flush();
    return result;
  };
  wrapped.__mcWrapped=true;
  window[name]=wrapped;
}
['confirmMedicationCreate','markTaken','markCancelled','applyCorrection'].forEach(wrap);
window.addEventListener('medcontrol-supabase-bridge-ready',()=>['confirmMedicationCreate','markTaken','markCancelled','applyCorrection'].forEach(wrap));
})();