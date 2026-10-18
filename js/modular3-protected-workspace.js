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
   form.innerHTML='<label>Название <input name="name" required></label><label>Дата <input name="date" type="date" required></label><label>Время 1 <select name="firstHour" aria-label="Часы первого приёма" required></select> : <select name="firstMinute" aria-label="Минуты первого приёма" required></select></label><label>Время 2 <select name="secondHour" aria-label="Часы второго приёма" required></select> : <select name="secondMinute" aria-label="Минуты второго приёма" required></select></label><button>Сохранить курс</button>';
   for(const [name,max,placeholder] of [['firstHour',23,'ЧЧ'],['firstMinute',59,'ММ'],['secondHour',23,'ЧЧ'],['secondMinute',59,'ММ']]){
    const select=form.elements.namedItem(name);
    const empty=new Option(placeholder,'');empty.selected=true;empty.disabled=true;select.add(empty);
    for(let value=0;value<=max;value++){const padded=String(value).padStart(2,'0');select.add(new Option(padded,padded));}
   }
   form.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(form);
    const first=data.get('firstHour')+':'+data.get('firstMinute'),second=data.get('secondHour')+':'+data.get('secondMinute');
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
 document.getElementById('inspect-migration').onclick=()=>{
  try{
   const result=window.MedControlModular3CopyMigration.inspect();
   if(result.reason==='legacy_missing'){notice('Исходные данные на этом устройстве не найдены. Перенос не запускался.');return;}
   if(!result.ready){notice('Перенос пока недоступен: '+result.reason+'. Данные не изменены.');return;}
   const counts=result.counts;
   notice('Проверка без изменений завершена. Препаратов: '+counts.medications+'; приёмов: '+counts.intakeLogs+'; отмен: '+(counts.intakeCorrections||0)+'; архивных событий: '+(counts.archiveHistory||0)+'. Перенос не запускался.');
  }catch(error){notice('Проверка не выполнена: '+error.message);}
 };
 document.getElementById('commit-migration').onclick=async()=>{
  const migration=window.MedControlModular3CopyMigration;
  const inspection=migration.inspect();
  if(!inspection.ready){notice('Перенос недоступен: '+inspection.reason+'. Данные не изменены.');return;}
  if(!password.value){notice('Для переноса введите новый локальный пароль.');return;}
  const counts=inspection.counts;
  const confirmed=window.confirm('Создать зашифрованную копию '+counts.medications+' препаратов и '+counts.intakeLogs+' приёмов? Исходная история сохранится без изменений.');
  if(!confirmed){notice('Перенос отменён. Исходные данные не изменены.');return;}
  try{
   const result=await migration.commit(password.value);
   const unlocked=await session.unlock(password.value);
   if(!unlocked)throw Error('Не удалось проверить локальный вход после переноса');
   password.value='';
   notice('Защищённая копия проверена и сохранена. Исходная история не изменена. Препаратов: '+result.medications+'; приёмов: '+result.intakeLogs+'.');
   show();
  }catch(error){notice('Перенос не завершён: '+error.message+'. Исходная история не удалялась.');}
 };
 document.getElementById('unlock').onclick=async()=>{try{if(await session.unlock(password.value)){password.value='';notice('Автономный вход выполнен.');show();}else notice('Неверный пароль.');}catch(error){notice('Ошибка входа: '+error.message);}};
 document.getElementById('enroll').onclick=async()=>{try{await session.initialize({settings:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},medications:[],intakeLogs:[]},password.value);password.value='';notice('Защищённое хранилище создано.');show();}catch(error){notice('Не удалось создать хранилище: '+error.message);}};
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{section=button.dataset.tab;render();});
 document.getElementById('lock').onclick=async()=>{await session.lock();notice('Данные заблокированы.');render();};
 render();
})();
