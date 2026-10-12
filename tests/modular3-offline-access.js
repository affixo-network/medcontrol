/* Isolated test-only offline access shell, no Supabase and no production route changes. */
'use strict';
const form=document.getElementById('unlock');
const nav=document.getElementById('sections');
const content=document.getElementById('content');
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const secret=document.getElementById('passphrase').value;
 try{
  const auth=window.medcontrolOfflineProofAuth;
  const exists=!!localStorage.getItem('medcontrol_offline_proof_credential_v1');
  const ok=exists?await auth.unlock(secret):await auth.enroll(secret);
  if(!ok)throw Error('Wrong passphrase');
  form.hidden=true;nav.hidden=false;content.textContent='Unlocked. Select section.';
 }catch(error){content.textContent='Access denied: '+error.message;}
});
nav.addEventListener('click',e=>{
 if(e.target.id==='lock'){window.medcontrolOfflineProofAuth.lock();nav.hidden=true;form.hidden=false;content.textContent='Locked';return;}
 const section=e.target.dataset.section;
 if(!section||!window.medcontrolOfflineProofAuth.isUnlocked())return;
 const names={input:'Ввод',action:'Приём препаратов',dashboard:'Табло',archive:'Архив'};
 content.textContent='Offline prototype section: '+names[section];
});
