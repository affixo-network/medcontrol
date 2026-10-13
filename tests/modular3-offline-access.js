/* Isolated functional offline prototype; encrypted storage only. Never loaded by production pages. */
'use strict';
const form=document.getElementById('unlock'),nav=document.getElementById('sections'),content=document.getElementById('content');
const bridge=window.MedControlOfflineEncryptedBridge;
const initial=()=>({settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[],intakeLogs:[]});
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current='input',busy=false,mutationQueue=Promise.resolve();
function render(){
 const state=bridge.read(),meds=state.medications,logs=state.intakeLogs;
 if(current==='input'){
  content.innerHTML='<h2>Ввод</h2><form id="add-med"><label>Препарат <input name="name" required></label><label>Время <input name="time" type="time" required value="09:00"></label><button type="submit">Добавить</button></form><ul>'+meds.map(m=>'<li>'+escapeHtml(m.name)+' — '+escapeHtml(m.times?.join(', ')||m.time||'')+' — '+(m.archivedCompleted?'Архив':m.courseCompleted?'Курс завершён':'Активен')+'</li>').join('')+'</ul>';
 }else if(current==='action'){
  content.innerHTML='<h2>Приём препаратов</h2><ul>'+meds.map(m=>'<li>'+escapeHtml(m.name)+' <button type="button" data-take="'+escapeHtml(m.id)+'">Принято</button> <button type="button" data-cancel="'+escapeHtml(m.id)+'">Отменить случайное нажатие</button></li>').join('')+'</ul>';
 }else if(current==='dashboard'){
  content.innerHTML='<h2>Табло</h2><p>Препаратов: '+meds.length+'; записей приёма: '+logs.length+'</p><ul>'+meds.map(m=>'<li>'+escapeHtml(m.name)+' '+escapeHtml(m.time)+'</li>').join('')+'</ul>';
 }else{
  content.innerHTML='<h2>Архив</h2><h3>Завершённые курсы</h3><ul>'+meds.filter(m=>m.archivedCompleted).map(m=>'<li>'+escapeHtml(m.name)+' — '+escapeHtml(m.archivedAt)+'</li>').join('')+'</ul><h3>История событий</h3><ul>'+logs.map(l=>'<li>'+escapeHtml(l.name)+' — '+escapeHtml(l.actualAt||l.at||'')+'</li>').join('')+'</ul>';
 }
}
function mutate(update){
 const task=mutationQueue.then(async()=>{
  busy=true;
  try{
   const state=bridge.read();
   update(state);
   bridge.write(state);
   await bridge.checkpoint();
   render();
  }catch(e){
   content.insertAdjacentHTML('beforeend','<p role="alert">'+escapeHtml(e.message)+'</p>');
   console.error('Offline action rejected:',e);
  }finally{busy=false;}
 });
 mutationQueue=task.catch(()=>{});
 return task;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const secret=document.getElementById('passphrase').value;
 try{
  const auth=window.medcontrolOfflineProofAuth;
  const exists=!!localStorage.getItem('medcontrol_offline_proof_credential_v1');
  const ok=exists?await auth.unlock(secret):await auth.enroll(secret);
  if(!ok)throw Error('Wrong passphrase');
  if(exists)await bridge.unlock(secret);else await bridge.initialize(initial(),secret);
  document.getElementById('passphrase').value='';
  const state=bridge.read();
  if(window.MedControlOfflineCourseEngine.reconcile(state)){bridge.write(state);await bridge.checkpoint();}
  form.hidden=true;nav.hidden=false;render();
 }catch(error){window.medcontrolOfflineProofAuth.lock();try{bridge.lock();}catch(_){}nav.hidden=true;form.hidden=false;content.textContent='Access denied: '+error.message;}
});
nav.addEventListener('click',async e=>{
 if(e.target.id==='lock'){
  await mutationQueue;
  try{await bridge.checkpoint();bridge.lock();window.medcontrolOfflineProofAuth.lock();nav.hidden=true;form.hidden=false;content.textContent='Locked';}
  catch(error){content.textContent='Lock refused: '+error.message;}
  return;
 }
 const section=e.target.dataset.section;
 if(!section||!window.medcontrolOfflineProofAuth.isUnlocked())return;
 current=section;render();
});
content.addEventListener('submit',e=>{
 if(e.target.id!=='add-med')return;
 e.preventDefault();
 const data=new FormData(e.target),name=String(data.get('name')||'').trim(),time=String(data.get('time')||'');
 if(!name||!/^\d{2}:\d{2}$/.test(time))return;
 void mutate(state=>window.MedControlOfflineCourseEngine.create(state,name,time,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Yerevan'})));
});
content.addEventListener('click',e=>{
 const id=e.target.dataset.take||e.target.dataset.cancel;
 if(!id)return;
 void mutate(state=>window.MedControlOfflineCourseEngine.record(state,id,e.target.dataset.cancel?'cancelled':'taken',new Date().toISOString()));
});
