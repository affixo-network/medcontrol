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
  if(section==='archive'){
   const controls=document.createElement('div');
   const filter=document.createElement('select');
   filter.setAttribute('aria-label','Период истории');
   for(const [value,label] of [['today','Сегодня'],['7','7 дней'],['30','30 дней'],['all','Весь период']]){
    filter.add(new Option(label,value));
   }
   filter.value=window.__medcontrolProtectedArchivePeriod||'7';
   filter.onchange=()=>{window.__medcontrolProtectedArchivePeriod=filter.value;render();};
   controls.append(document.createTextNode('Период: '),filter);
   const outcome=document.createElement('select');
   outcome.setAttribute('aria-label','Статус приёма');
   for(const [value,label] of [['all','Все'],['taken','Принято'],['missed','Не принято']])outcome.add(new Option(label,value));
   outcome.value=window.__medcontrolProtectedArchiveOutcome||'all';
   outcome.onchange=()=>{window.__medcontrolProtectedArchiveOutcome=outcome.value;render();};
   controls.append(document.createTextNode(' Статус: '),outcome);
   screen.append(controls);
  }
  if(section==='input'){
   const form=document.createElement('form');
   form.innerHTML='<label>Название <input name="name" required></label><label>Производитель <input name="manufacturer"></label><label>Количественное содержание <input name="contentQuantity" type="number" min="0" step="any"></label><label>Единица содержания <input name="contentUnit"></label><label>Количество приёма <input name="intakeQuantity" type="number" min="0" step="any"></label><label>Единица приёма <input name="intakeUnit"></label><label>Детали <input name="details"></label><label>Дата начала <input name="date" type="date" required></label><label>Дата окончания <input name="endDate" type="date" required></label><label>Время 1 <input name="first" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ" required> <button type="button" data-picker="first" aria-label="Выбрать время 1">◷</button></label><label>Время 2 <input name="second" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ (необязательно)"> <button type="button" data-picker="second" aria-label="Выбрать время 2">◷</button></label><button>Сохранить курс</button>';
   const schedule=document.createElement('fieldset');
   schedule.innerHTML='<legend>Повторение курса</legend><label>Расписание <select name="scheduleType"><option value="daily">Каждый день</option><option value="weekdays">Дни недели</option><option value="explicit_dates">Конкретные даты</option></select></label><div data-schedule-weekdays hidden>Дни недели: </div><label data-schedule-dates hidden>Даты через запятую <input name="explicitDates" placeholder="2026-10-18, 2026-10-20"></label>';
   const weekdaysBox=schedule.querySelector('[data-schedule-weekdays]');
   for(const day of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){
    const label=document.createElement('label');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='weekday';checkbox.value=day;
    label.append(checkbox,document.createTextNode(day+' '));weekdaysBox.append(label);
   }
   const scheduleSelect=schedule.querySelector('[name="scheduleType"]');
   scheduleSelect.onchange=()=>{
    weekdaysBox.hidden=scheduleSelect.value!=='weekdays';
    schedule.querySelector('[data-schedule-dates]').hidden=scheduleSelect.value!=='explicit_dates';
   };
   form.querySelector('button:not([type])').before(schedule);
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
    if(second&&first===second){notice('Расчётные времена должны различаться.');return;}if(String(data.get('scheduleType')||'daily')!=='explicit_dates'&&String(data.get('endDate'))<String(data.get('date'))){notice('Дата окончания раньше даты начала.');return;}
    const scheduleType=String(data.get('scheduleType')||'daily');
    const weekdays=data.getAll('weekday').map(String);
    const explicitDates=String(data.get('explicitDates')||'').split(',').map(x=>x.trim()).filter(Boolean).sort();
    if(scheduleType==='weekdays'&&!weekdays.length){notice('Выберите дни недели.');return;}
    if(scheduleType==='explicit_dates'&&(!explicitDates.length||explicitDates.some(x=>!/^\\d{4}-\\d{2}-\\d{2}$/.test(x)))){notice('Укажите даты в формате ГГГГ-ММ-ДД.');return;}
    try{
     await pages.createCourse({id:crypto.randomUUID(),name:String(data.get('name')),manufacturer:String(data.get('manufacturer')||''),contentQuantity:String(data.get('contentQuantity')||''),contentUnit:String(data.get('contentUnit')||''),intakeQuantity:String(data.get('intakeQuantity')||''),intakeUnit:String(data.get('intakeUnit')||''),details:String(data.get('details')||''),scheduleType,weekdays,explicitDates,startDate:scheduleType==='explicit_dates'?explicitDates[0]:String(data.get('date')),endDate:scheduleType==='explicit_dates'?explicitDates[explicitDates.length-1]:String(data.get('endDate')),times:[first,second].filter(Boolean).sort(),active:true,rowHistory:[{action:'created',at:new Date().toISOString()}]});
     notice('Курс зашифрован и сохранён.');render();
    }catch(error){notice('Не удалось сохранить курс: '+error.message);}
   };screen.append(form);
  }
  if(section==='dashboard'){
   const now=new Date();
   const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
   const today=[];
   for(const med of state.medications||[]){
    if(med.cancelled||med.archivedCompleted||med.active===false||date<med.startDate||date>(med.endDate||med.startDate))continue;
    if(med.scheduleType==='weekdays'&&!(med.weekdays||[]).includes(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]))continue;
    if(med.scheduleType==='explicit_dates'&&!(med.explicitDates||[]).includes(date))continue;
    for(const time of med.times||[]){
     const plannedAt=new Date(date+'T'+time+':00').toISOString();
     const events=(state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&x.plannedAt===plannedAt).sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||'')));
     const taken=events.reduce((active,event)=>event.action==='taken'?event:(['cancelled','cancel_taken','undo_taken'].includes(event.action)?null:active),null);
     today.push({med,time,plannedAt,taken});
    }
   }
   today.sort((a,b)=>a.plannedAt.localeCompare(b.plannedAt));
   const summary=document.createElement('p');
   summary.textContent='Сегодня: '+today.length+' приёмов; принято: '+today.filter(x=>x.taken).length+'; ожидается: '+today.filter(x=>!x.taken&&new Date(x.plannedAt)>now).length+'; не принято: '+today.filter(x=>!x.taken&&new Date(x.plannedAt)<=now).length;
   screen.append(summary);
   for(const item of today){
    const line=document.createElement('p');
    line.textContent=item.time+' — '+item.med.name+' — '+(item.taken?'Принято ('+new Date(item.taken.actualAt).toLocaleTimeString()+')':new Date(item.plannedAt)>now?'Ожидается':'Не принято');
    screen.append(line);
   }
   return;
  }
  for(const med of state.medications){
   const article=document.createElement('article');
   const heading=document.createElement('h3');heading.textContent=med.name;article.append(heading);
   const summary=document.createElement('p');summary.textContent=(med.times||[]).join(', ')+' · '+(med.startDate||'')+' — '+(med.endDate||med.startDate||'');article.append(summary);
   if(section==='input'){
    const history=document.createElement('details');
    const summaryTitle=document.createElement('summary');
    summaryTitle.textContent='История курса и изменения';
    history.append(summaryTitle);
    for(const entry of med.rowHistory||[]){
     const line=document.createElement('p');
     line.textContent=(entry.at?new Date(entry.at).toLocaleString()+' — ':'')+(entry.action||'Событие');
     history.append(line);
    }
    article.append(history);
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const stop=document.createElement('button');
     stop.type='button';
     stop.textContent='Завершить курс';
     stop.onclick=async()=>{
      if(!window.confirm('Завершить курс «'+med.name+'»? История и приёмы сохранятся.'))return;
      stop.disabled=true;
      try{
       await pages.changeCourse(med.id,course=>{
        if(course.active===false||course.archivedCompleted||course.cancelled)throw Error('Курс уже завершён');
        course.active=false;
        course.archivedCompleted=true;
        course.rowHistory=course.rowHistory||[];
        course.rowHistory.push({action:'completed',at:new Date().toISOString()});
       });
       notice('Завершение курса зашифровано и сохранено.');render();
      }catch(error){stop.disabled=false;notice('Не удалось завершить курс: '+error.message);}
     };
     article.append(stop);
    }
   }
   if(section==='action'){
    for(const time of med.times||[]){
     const today=new Date();
     const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
     if(med.cancelled||med.archivedCompleted||med.active===false||date<med.startDate||date>(med.endDate||med.startDate))continue;
     if(med.scheduleType==='weekdays'){
      const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
      if(!Array.isArray(med.weekdays)||!med.weekdays.includes(weekday))continue;
     }else if(med.scheduleType==='explicit_dates'){
      if(!Array.isArray(med.explicitDates)||!med.explicitDates.includes(date))continue;
     }else if(med.scheduleType&&med.scheduleType!=='daily'&&date!==med.startDate)continue;
     const plannedAt=new Date(date+'T'+time+':00').toISOString();
     const events=(state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&x.plannedAt===plannedAt).sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||'')));
     const log=events.reduce((active,event)=>event.action==='taken'?event:(event.action==='cancelled'||event.action==='cancel_taken'||event.action==='undo_taken'?null:active),null);
     const button=document.createElement('button');button.textContent=log?'Принято: '+new Date(log.actualAt).toLocaleString():'Принято '+time;button.disabled=!!log;
     button.onclick=async()=>{
      try{await pages.recordIntake({id:crypto.randomUUID(),medicationId:med.id,plannedAt,actualAt:new Date().toISOString(),action:'taken'});notice('Приём зашифрован и сохранён.');render();}
      catch(error){notice('Ошибка сохранения: '+error.message);}
     };article.append(button);
     if(log){
      const cancel=document.createElement('button');
      cancel.type='button';
      cancel.textContent='Отменить «Принято» (случайность)';
      cancel.onclick=async()=>{
       if(!window.confirm('Отменить ошибочное подтверждение? Запись об отмене сохранится в истории.'))return;
       cancel.disabled=true;
       try{
        await pages.cancelIntake({id:crypto.randomUUID(),medicationId:med.id,plannedAt,actualAt:new Date().toISOString()});
        notice('Отмена зашифрована и сохранена.');render();
       }catch(error){cancel.disabled=false;notice('Ошибка отмены: '+error.message);}
      };
      article.append(cancel);
     }
    }
   }
   if(section==='archive'||section==='dashboard'){
    const period=section==='archive'?(window.__medcontrolProtectedArchivePeriod||'7'):'all';
    const now=Date.now();
    const since=period==='all'?0:period==='today'?new Date().setHours(0,0,0,0):now-Number(period)*86400000;
    const slots=new Map();
    for(const log of (state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&new Date(x.plannedAt).getTime()>=since)){
     if(!slots.has(log.plannedAt))slots.set(log.plannedAt,[]);
     slots.get(log.plannedAt).push(log);
    }
    if(section==='archive'){
     const lower=Math.max(since,new Date(med.startDate+'T00:00:00').getTime());
     const upper=Math.min(now,new Date((med.endDate||med.startDate)+'T23:59:59').getTime());
     if(Number.isFinite(lower)&&Number.isFinite(upper)&&lower<=upper){
      const day=new Date(lower);day.setHours(0,0,0,0);
      const maxDays=period==='all'?3660:32;
      for(let count=0;day.getTime()<=upper&&count<maxDays;count++,day.setDate(day.getDate()+1)){
       const dayString=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
       if(med.scheduleType==='weekdays'&&!(med.weekdays||[]).includes(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.getDay()]))continue;
       if(med.scheduleType==='explicit_dates'&&!(med.explicitDates||[]).includes(dayString))continue;
       if(med.scheduleType&& !['daily','weekdays','explicit_dates'].includes(med.scheduleType)&&dayString!==med.startDate)continue;
       for(const time of med.times||[]){
        const slotDate=new Date(dayString+'T'+time+':00');
        if(slotDate.getTime()>now||slotDate.getTime()<lower)continue;
        const plannedAt=slotDate.toISOString();
        if(!slots.has(plannedAt))slots.set(plannedAt,[]);
       }
      }
     }
    }
    for(const [plannedAt,events] of [...slots].sort((a,b)=>a[0].localeCompare(b[0]))){
     events.sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||'')));
     const taken=events.reduce((active,event)=>event.action==='taken'?event:(['cancelled','cancel_taken','undo_taken'].includes(event.action)?null:active),null);
     const outcome=window.__medcontrolProtectedArchiveOutcome||'all';
     if(section==='archive'&&outcome!=='all'&&(outcome==='taken')!==Boolean(taken))continue;
     const p=document.createElement('p');
     p.textContent=(taken?'Принято':'Не принято')+': расчётное '+new Date(plannedAt).toLocaleString()+(taken?'; фактическое '+new Date(taken.actualAt).toLocaleString():'');
     article.append(p);
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
