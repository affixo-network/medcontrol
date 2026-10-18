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
   form.innerHTML='<label>Название <input name="name" required></label><label>Производитель <input name="manufacturer"></label><label>Количественное содержание <input name="contentQuantity" type="number" min="0" step="any"></label><label>Единица содержания <input name="contentUnit"></label><label>Количество приёма <input name="intakeQuantity" type="number" min="0" step="any"></label><label>Единица приёма <input name="intakeUnit"></label><label>Детали <input name="details"></label><label>Дата начала <input name="date" type="date" required></label><label>Дата окончания <input name="endDate" type="date" required></label><label>Время 1 <input name="first" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ" required> <button type="button" data-picker="first" aria-label="Выбрать время 1">◷</button></label><label>Время 2 <input name="second" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ" required> <button type="button" data-picker="second" aria-label="Выбрать время 2">◷</button></label><button>Сохранить курс</button>';
   for(const name of ['first','second']){
    const field=form.elements.namedItem(name);
    field.addEventListener('input',()=>{
     const digits=field.value.replace(/\\D/g,'').slice(0,4);
     if(/^\\d{2}:\\d{2}$/.test(field.value))return;
     if(digits.length>=3)field.value=digits.slice(0,2)+':'+digits.slice(2);
    });
    const button=form.querySelector('[data-picker="'+name+'"]');
    button.onclick=()=>{
     const existing=button.nextElementSibling;
     if(existing&&existing.dataset.timePicker===name){existing.remove();return;}
     const picker=document.createElement('span');picker.dataset.timePicker=name;
     const hour=document.createElement('select'),minute=document.createElement('select');
     hour.setAttribute('aria-label','Часы');minute.setAttribute('aria-label','Минуты');
     const current=/^(\\d{2}):(\\d{2})$/.exec(field.value);
     for(let i=0;i<24;i++){const v=String(i).padStart(2,'0');hour.add(new Option(v,v));}
     for(let i=0;i<60;i++){const v=String(i).padStart(2,'0');minute.add(new Option(v,v));}
     if(current){hour.value=current[1];minute.value=current[2];}
     const apply=()=>{field.value=hour.value+':'+minute.value;field.dispatchEvent(new Event('change',{bubbles:true}));};
     hour.onchange=apply;minute.onchange=apply;
     picker.append(hour,document.createTextNode(' : '),minute);
     button.after(picker);apply();
    };
   }
   form.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(form);
    const first=String(data.get('first')),second=String(data.get('second'));
    if(first===second){notice('Расчётные времена должны различаться.');return;}if(String(data.get('endDate'))<String(data.get('date'))){notice('Дата окончания раньше даты начала.');return;}
    try{
     await pages.createCourse({id:crypto.randomUUID(),name:String(data.get('name')),manufacturer:String(data.get('manufacturer')||''),contentQuantity:String(data.get('contentQuantity')||''),contentUnit:String(data.get('contentUnit')||''),intakeQuantity:String(data.get('intakeQuantity')||''),intakeUnit:String(data.get('intakeUnit')||''),details:String(data.get('details')||''),scheduleType:'daily',startDate:String(data.get('date')),endDate:String(data.get('endDate')),times:[first,second].sort(),active:true,rowHistory:[{action:'created',at:new Date().toISOString()}]});
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
