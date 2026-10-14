/* Isolated protected workspace; existing MedControl storage remains untouched. */
(function(){
 'use strict';
 const session=window.MedControlModular3ProtectedSession;
 const pages=window.MedControlModular3ProtectedPages;
 const password=document.getElementById('password');
 const message=document.getElementById('message');
 const workspace=document.getElementById('workspace');
 const login=document.getElementById('login');
 const screen=document.getElementById('screen');
 let section='input';
 function notice(text){message.textContent=text;}
 function show(){login.hidden=true;workspace.hidden=false;render();}
 function render(){
  if(!session.isUnlocked()){workspace.hidden=true;login.hidden=false;screen.replaceChildren();return;}
  const state=pages.read(section);
  screen.replaceChildren();
  const title=document.createElement('h2');title.textContent={input:'Ввод',action:'Приём препаратов',dashboard:'Табло',archive:'Архив'}[section];screen.append(title);
  if(section==='input'){
   const form=document.createElement('form');
   form.innerHTML='<label>Название <input name="name" required></label><label>Дата <input name="date" type="date" required></label><label>Время 1 <input name="first" type="time" required></label><label>Время 2 <input name="second" type="time" required></label><button>Сохранить курс</button>';
   form.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(form);
    const first=data.get('first'),second=data.get('second');
    if(first===second){notice('Расчётные времена должны различаться.');return;}
    try{
     await pages.createCourse({id:crypto.randomUUID(),name:String(data.get('name')),scheduleType:'daily',startDate:String(data.get('date')),endDate:String(data.get('date')),times:[first,second].sort(),active:true,rowHistory:[{action:'created',at:new Date().toISOString()}]});
     notice('Курс зашифрован и сохранён.');render();
    }catch(error){notice('Не удалось сохранить курс: '+error.message);}
   };screen.append(form);
  }
  for(const med of state.medications){
   const article=document.createElement('article');
   const heading=document.createElement('h3');heading.textContent=med.name;article.append(heading);
   const summary=document.createElement('p');summary.textContent=(med.times||[]).join(', ');article.append(summary);
   if(section==='action'){
    for(const time of med.times||[]){
     const date=med.startDate;
     const plannedAt=new Date(date+'T'+time+':00').toISOString();
     const log=state.intakeLogs.find(x=>x.medicationId===med.id&&x.plannedAt===plannedAt);
     const button=document.createElement('button');button.textContent=log?'Принято: '+new Date(log.actualAt).toLocaleString():'Принято '+time;button.disabled=!!log;
     button.onclick=async()=>{
      try{await pages.recordIntake({id:crypto.randomUUID(),medicationId:med.id,plannedAt,actualAt:new Date().toISOString(),action:'taken'});notice('Приём зашифрован и сохранён.');render();}
      catch(error){notice('Ошибка сохранения: '+error.message);}
     };article.append(button);
    }
   }
   if(section==='archive'||section==='dashboard'){
    for(const log of state.intakeLogs.filter(x=>x.medicationId===med.id)){
     const p=document.createElement('p');p.textContent='Принято: расчётное '+new Date(log.plannedAt).toLocaleString()+'; фактическое '+new Date(log.actualAt).toLocaleString();article.append(p);
    }
   }
   screen.append(article);
  }
 }
 document.getElementById('unlock').onclick=async()=>{try{if(await session.unlock(password.value)){password.value='';notice('Автономный вход выполнен.');show();}else notice('Неверный пароль.');}catch(error){notice('Ошибка входа: '+error.message);}};
 document.getElementById('enroll').onclick=async()=>{try{await session.initialize({settings:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},medications:[],intakeLogs:[]},password.value);password.value='';notice('Защищённое хранилище создано.');show();}catch(error){notice('Не удалось создать хранилище: '+error.message);}};
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{section=button.dataset.tab;render();});
 document.getElementById('lock').onclick=async()=>{await session.lock();notice('Данные заблокированы.');render();};
 render();
})();
