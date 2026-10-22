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
 function plannedTimes(med,day){
  const changes=(med.rowHistory||[]).filter(x=>x.action==='times_changed'&&Array.isArray(x.previousTimes)&&Array.isArray(x.newTimes)&&Number.isFinite(Date.parse(x.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const candidates=new Set([...(med.times||[]),...changes.flatMap(x=>[...x.previousTimes,...x.newTimes])]);
  return [...candidates].filter(time=>{
   if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))return false;
   const slot=new Date(day+'T'+time+':00').getTime();
   if(!Number.isFinite(slot))return false;
   let active=changes.length?[...changes[0].previousTimes]:[...(med.times||[])];
   for(const change of changes){
    if(slot<Date.parse(change.at))break;
    active=change.newTimes;
   }
   return active.includes(time);
  }).sort();
 }
 function scheduledOn(med,day,time){
  const moment=new Date(day+'T'+time+':00').getTime();
  if(!Number.isFinite(moment))return false;
  const changes=(med.rowHistory||[]).filter(x=>x.action==='schedule_changed'&&x.previous&&x.next&&Number.isFinite(Date.parse(x.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  let rule=changes.length?changes[0].previous:med;
  for(const change of changes){if(moment<Date.parse(change.at))break;rule=change.next;}
  const type=rule.scheduleType||'daily';
  if(type==='daily')return true;
  if(type==='weekdays')return (rule.weekdays||[]).includes(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(day+'T12:00:00').getDay()]);
  if(type==='explicit_dates')return (rule.explicitDates||[]).includes(day);
  return day===med.startDate;
 }
 function validCalendarDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const parsed=new Date(day+'T12:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
 }
 function zoneParts(instant,zone){
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 }
 function zoneDay(instant,zone){const p=zoneParts(instant,zone);return p.year+'-'+p.month+'-'+p.day;}
 function zonedSlot(day,time,zone){
  const [year,month,date]=day.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
  const target=Date.UTC(year,month-1,date,hour,minute);
  if(!Number.isFinite(target))throw Error('Invalid scheduled time');
  let stamp=target;
  for(let n=0;n<3;n++){
   const p=zoneParts(new Date(stamp),zone);
   const wall=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));
   const adjustment=target-wall;
   if(!adjustment)break;
   stamp+=adjustment;
  }
  const p=zoneParts(new Date(stamp),zone);
  if(p.year+'-'+p.month+'-'+p.day!==day||p.hour+':'+p.minute!==time)throw Error('Nonexistent time in configured timezone');
  return new Date(stamp).toISOString();
 }
 function notice(text){message.textContent=text;}
 function show(){login.hidden=true;workspace.hidden=false;render();}
 function render(){
  if(!session.isUnlocked()){workspace.hidden=true;login.hidden=false;screen.replaceChildren();return;}
  const state=pages.read(section);
  screen.replaceChildren();
  const title=document.createElement('h2');title.textContent={input:'Ввод',action:'Приём препаратов',dashboard:'Табло',archive:'Архив'}[section];screen.append(title);
  if(section==='archive'){
   const controls=document.createElement('section');controls.className='card';
   const heading=document.createElement('h2');heading.textContent='История приёмов';controls.append(heading);
   const actions=document.createElement('div');actions.className='inline';
   const active=window.__medcontrolProtectedArchiveOutcome||'';
   for(const [value,label] of [['taken','Принято'],['missed','Не принято']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.setAttribute('aria-pressed',String(active===value));
    button.onclick=()=>{window.__medcontrolProtectedArchiveOutcome=value;render();};
    actions.append(button);
   }
   if(active){
    const filter=document.createElement('select');filter.setAttribute('aria-label','Период истории');
    for(const [value,label] of [['today','Сегодня'],['7','7 дней'],['30','30 дней'],['all','Весь период']])filter.add(new Option(label,value));
    filter.value=window.__medcontrolProtectedArchivePeriod||'7';
    filter.onchange=()=>{window.__medcontrolProtectedArchivePeriod=filter.value;render();};
    const periodLabel=document.createElement('label');periodLabel.textContent='Период';periodLabel.append(filter);actions.append(periodLabel);
    const collapse=document.createElement('button');collapse.type='button';collapse.textContent='Свернуть';
    collapse.onclick=()=>{window.__medcontrolProtectedArchiveOutcome='';render();};actions.append(collapse);
   }
   controls.append(actions);screen.append(controls);
  }
  if(section==='input'){
   const form=document.createElement('form');
   form.innerHTML='<label>Название <input name="name" required></label><label>Производитель <input name="manufacturer"></label><label>Количественное содержание <input name="contentQuantity" type="number" min="0" step="any"></label><label>Единица содержания <input name="contentUnit"></label><label>Другая единица содержания <input name="contentUnitOther"></label><label>Количество приёма <input name="intakeQuantity" type="number" min="0" step="any"></label><label>Единица приёма <input name="intakeUnit"></label><label>Другая единица приёма <input name="intakeUnitOther"></label><label>Детали <input name="details"></label><label>Дата начала <input name="date" type="date" required></label><label>Дата окончания <input name="endDate" type="date" required></label><label>Время 1 <input name="first" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ" required> <button type="button" data-picker="first" aria-label="Выбрать время 1">◷</button></label><label>Время 2 <input name="second" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ (необязательно)"> <button type="button" data-picker="second" aria-label="Выбрать время 2">◷</button></label><button>Сохранить курс</button>';
   const mode=document.createElement('label');mode.textContent='Активный режим ';const activeInput=document.createElement('input');activeInput.type='checkbox';activeInput.name='active';activeInput.checked=true;mode.append(activeInput);form.querySelector('button:not([type])').before(mode);
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
     const digits=field.value.replace(/\D/g,'').slice(0,4);
     if(/^\d{2}:\d{2}$/.test(field.value))return;
     if(digits.length>=3)field.value=digits.slice(0,2)+':'+digits.slice(2);
    });
    const button=form.querySelector('[data-picker="'+name+'"]');
    button.onclick=()=>{
     const existing=button.nextElementSibling;
     if(existing&&existing.dataset.timePicker===name){existing.remove();return;}
     const picker=document.createElement('span');picker.dataset.timePicker=name;
     const hour=document.createElement('select'),minute=document.createElement('select');
     hour.setAttribute('aria-label','Часы');minute.setAttribute('aria-label','Минуты');
     const current=/^(\d{2}):(\d{2})$/.exec(field.value);
     for(let i=0;i<24;i++){const v=String(i).padStart(2,'0');hour.add(new Option(v,v));}
     for(let i=0;i<60;i++){const v=String(i).padStart(2,'0');minute.add(new Option(v,v));}
     if(current){hour.value=current[1];minute.value=current[2];}
     const apply=()=>{field.value=hour.value+':'+minute.value;field.dispatchEvent(new Event('change',{bubbles:true}));};
     hour.onchange=apply;minute.onchange=apply;
     picker.append(hour,document.createTextNode(' : '),minute);
     button.after(picker);apply();
    };
   }
   // Match original Input unit controls without changing encrypted data keys.
   for(const [name,otherName,options] of [
    ['contentUnit','contentUnitOther',['мг','г','мкг','мл','МЕ','%','Другая']],
    ['intakeUnit','intakeUnitOther',['таблетка','капсула','мл','капля','доза','шт.','Другая']]
   ]){
    const oldInput=form.elements.namedItem(name);
    const dropdown=document.createElement('select');dropdown.name=name;dropdown.required=true;
    dropdown.add(new Option('Выберите',''));
    for(const value of options)dropdown.add(new Option(value,value));
    const other=form.elements.namedItem(otherName);
    const otherLabel=other.closest('label');otherLabel.hidden=true;
    other.placeholder='Укажите другую единицу';other.required=false;
    dropdown.onchange=()=>{
     otherLabel.hidden=dropdown.value!=='Другая';
     other.required=dropdown.value==='Другая';
     if(!other.required)other.value='';
    };
    oldInput.replaceWith(dropdown);
   }
   // Familiar presentation for Input; existing encrypted handlers remain intact.
   form.classList.add('protected-input-form');
   const panel=document.createElement('div');panel.className='protected-input-layout';
   const editor=document.createElement('section');editor.className='protected-input-editor';
   const editorTitle=document.createElement('h3');editorTitle.textContent='Новый препарат';editor.append(editorTitle);
   const fields=document.createElement('div');fields.className='protected-input-fields';
   const moveField=name=>{
    const field=form.elements.namedItem(name);
    const label=field?.closest('label');
    if(!label)throw Error('Missing Input field: '+name);
    fields.append(label);
   };
   for(const name of ['name','manufacturer','contentQuantity','contentUnit','contentUnitOther','intakeQuantity','intakeUnit','intakeUnitOther','details'])moveField(name);
   fields.querySelector('label:has([name="details"])')?.classList.add('protected-full-field');
   editor.append(fields);
   const scheduleTitle=document.createElement('h4');scheduleTitle.textContent='Расписание';editor.append(scheduleTitle);
   const scheduleFields=document.createElement('div');scheduleFields.className='protected-schedule-fields';
   scheduleFields.append(schedule,mode);
   const firstInput=form.elements.namedItem('first'),secondInput=form.elements.namedItem('second');
   const times=new Set();
   const timeBox=document.createElement('fieldset');timeBox.className='protected-time-editor';
   const legend=document.createElement('legend');legend.textContent='Время приёма';timeBox.append(legend);
   const controls=document.createElement('div');controls.className='protected-time-controls';
   const hour=document.createElement('select'),minute=document.createElement('select');
   hour.setAttribute('aria-label','Часы приёма');minute.setAttribute('aria-label','Минуты приёма');
   for(let i=0;i<24;i++){const n=String(i).padStart(2,'0');hour.add(new Option(n,n));}
   for(let i=0;i<60;i++){const n=String(i).padStart(2,'0');minute.add(new Option(n,n));}
   const add=document.createElement('button');add.type='button';add.textContent='Добавить время';
   const list=document.createElement('div');list.className='protected-time-list';
   const sync=()=>{
    const values=[...times].sort();
    firstInput.value=values[0]||'';secondInput.value=values[1]||'';
    list.replaceChildren();
    for(const time of values){
     const chip=document.createElement('span');chip.className='protected-time-chip';
     const value=document.createElement('span');value.textContent=time;
     const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Удалить время '+time);
     remove.onclick=()=>{times.delete(time);sync();};chip.append(value,remove);list.append(chip);
    }
   };
   add.onclick=()=>{const time=hour.value+':'+minute.value;if(times.has(time)){notice('Это время уже добавлено.');return;}times.add(time);sync();};
   controls.append(hour,minute,add);timeBox.append(controls,list);
   const hiddenFields=document.createElement('div');hiddenFields.hidden=true;
   for(const field of [firstInput,secondInput]){field.required=false;hiddenFields.append(field.closest('label'));}
   timeBox.append(hiddenFields);scheduleFields.append(timeBox);
   for(const name of ['date','endDate'])scheduleFields.append(form.elements.namedItem(name).closest('label'));
   editor.append(scheduleFields);
   const save=form.querySelector('button:not([type])');
   save.textContent='Добавить';save.classList.add('protected-save-course');editor.append(save);
   const help=document.createElement('aside');help.className='protected-input-help';
   const helpTitle=document.createElement('h3');helpTitle.textContent='Варианты заполнения';help.append(helpTitle);
   const hints=document.createElement('ul');
   for(const hint of ['Укажите название препарата и дозировку.','Выберите расписание и время приёма.','Для второго приёма используйте «Время 2».','Проверьте даты начала и окончания.','Нажмите «Добавить» для защищённого сохранения.']){
    const item=document.createElement('li');item.textContent=hint;hints.append(item);
   }
   help.append(hints);panel.append(editor,help);form.append(panel);
   form.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(form);
    for(const legacy of [String(data.get('first')||''),String(data.get('second')||'')])if(/^([01]\\d|2[0-3]):[0-5]\\d$/.test(legacy))times.add(legacy);
    const courseTimes=[...times].sort();
    if(!courseTimes.length){notice('Добавьте хотя бы одно время приёма.');return;}if(String(data.get('scheduleType')||'daily')!=='explicit_dates'&&String(data.get('endDate'))<String(data.get('date'))){notice('Дата окончания раньше даты начала.');return;}
    const scheduleType=String(data.get('scheduleType')||'daily');
    const weekdays=data.getAll('weekday').map(String);
    const explicitDates=String(data.get('explicitDates')||'').split(',').map(x=>x.trim()).filter(Boolean).sort();
    if(scheduleType==='weekdays'&&!weekdays.length){notice('Выберите дни недели.');return;}
    if(scheduleType==='explicit_dates'&&(!explicitDates.length||explicitDates.some(x=>!validCalendarDay(x)))){notice('Укажите даты в формате ГГГГ-ММ-ДД.');return;}
    try{
     await pages.createCourse({id:crypto.randomUUID(),name:String(data.get('name')),manufacturer:String(data.get('manufacturer')||''),contentValue:String(data.get('contentQuantity')||''),contentUnit:String(data.get('contentUnit')||''),contentUnitOther:String(data.get('contentUnitOther')||''),intakeQuantity:String(data.get('intakeQuantity')||''),intakeUnit:String(data.get('intakeUnit')||''),intakeUnitOther:String(data.get('intakeUnitOther')||''),details:String(data.get('details')||''),scheduleType,weekdays,explicitDates,startDate:scheduleType==='explicit_dates'?explicitDates[0]:String(data.get('date')),endDate:scheduleType==='explicit_dates'?explicitDates[explicitDates.length-1]:String(data.get('endDate')),times:courseTimes,active:data.get('active')==='on',rowHistory:[{action:'created',at:new Date().toISOString()}]});
     notice('Курс зашифрован и сохранён.');render();
    }catch(error){notice('Не удалось сохранить курс: '+error.message);}
   };screen.append(form);
  }
  if(section==='dashboard'){
   const now=new Date();
   const zone=state.settings?.timezone||'Asia/Yerevan';
   const date=zoneDay(now,zone);
   const today=[];
   for(const med of state.medications||[]){
    const completedToday=med.archivedCompleted&&med.autoArchivedByIntakeId&&med.archivedAt&&zoneDay(new Date(med.archivedAt),zone)===date;
     if(med.cancelled||(!completedToday&&(med.archivedCompleted||med.active===false))||date<med.startDate||date>(med.endDate||med.startDate))continue;
    for(const time of plannedTimes(med,date)){
     if(!scheduledOn(med,date,time))continue;
     const plannedAt=zonedSlot(date,time,zone);
     const events=(state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&x.plannedAt===plannedAt).sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||'')));
     const taken=events.reduce((active,event)=>event.action==='taken'?event:(['cancelled','cancel_taken','undo_taken'].includes(event.action)?null:active),null);
     today.push({med,time,plannedAt,taken});
    }
   }
   today.sort((a,b)=>a.plannedAt.localeCompare(b.plannedAt));
   const panel=document.createElement('section');panel.className='card';
   const heading=document.createElement('h2');heading.textContent='Расписание на сегодня';panel.append(heading);
   const summary=document.createElement('p');
   summary.className='muted';
   summary.textContent='Всего: '+today.length+'; принято: '+today.filter(x=>x.taken).length+'; ожидается: '+today.filter(x=>!x.taken&&new Date(x.plannedAt)>now).length+'; не принято: '+today.filter(x=>!x.taken&&new Date(x.plannedAt)<=now).length;
   panel.append(summary);
   const table=document.createElement('table');
   const thead=document.createElement('thead');
   const header=document.createElement('tr');
   for(const label of ['№','Препарат','Доза','Расчётное время','Состояние']){const th=document.createElement('th');th.textContent=label;header.append(th);}
   thead.append(header);table.append(thead);
   const tbody=document.createElement('tbody');
   for(const [index,item] of today.entries()){
    const row=document.createElement('tr');
    const dose=[item.med.intakeQuantity||item.med.dose||'',item.med.intakeUnit||''].filter(Boolean).join(' ');
    const status=item.taken?'Принято · '+new Date(item.taken.actualAt).toLocaleTimeString():new Date(item.plannedAt)>now?'Ожидается':'Не принято';
    for(const value of [String(item.med.order||index+1),item.med.name,dose,item.time,status]){
     const td=document.createElement('td');td.textContent=value;row.append(td);
    }
    row.lastElementChild.className=item.taken?'success':new Date(item.plannedAt)>now?'upcoming':'overdue';
    tbody.append(row);
   }
   if(!today.length){const row=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='Нет запланированных приёмов';row.append(td);tbody.append(row);}
   table.append(tbody);panel.append(table);screen.append(panel);
   return;
  }
  for(const med of state.medications){
   if(section==='archive'&&!(med.cancelled||med.archivedCompleted))continue;
   if(section==='action'&&(med.cancelled||med.archivedCompleted||med.active===false))continue;
   const article=document.createElement('article');
   const heading=document.createElement('h3');heading.textContent=med.name;article.append(heading);
   const summary=document.createElement('p');summary.textContent=(med.times||[]).join(', ')+' · '+(med.startDate||'')+' — '+(med.endDate||med.startDate||'');article.append(summary);
   if(section==='input'){
    if(!med.cancelled&&!med.archivedCompleted){
     const toggle=document.createElement('button');toggle.type='button';toggle.textContent=med.active===false?'Активировать препарат':'Перевести в пассивный режим';
     toggle.onclick=async()=>{toggle.disabled=true;try{await pages.changeCourse(med.id,course=>{if(course.cancelled||course.archivedCompleted)throw Error('Курс завершён');course.active=course.active===false;course.rowHistory=course.rowHistory||[];course.rowHistory.push({action:'edited',at:new Date().toISOString(),details:course.active?'Статус препарата изменён на «Активно».':'Статус препарата изменён на «Пассивно».'});});notice('Режим препарата зашифрован и сохранён.');render();}catch(error){toggle.disabled=false;notice('Не удалось изменить режим: '+error.message);}};
     article.append(toggle);
    }
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const edit=document.createElement('details');
     const caption=document.createElement('summary');caption.textContent='Изменить будущие времена приёма';edit.append(caption);
     const form=document.createElement('form');
     const label=document.createElement('label');label.textContent='Времена (ЧЧ:ММ через запятую) ';
     const field=document.createElement('input');field.required=true;field.value=(med.times||[]).join(', ');label.append(field);
     const save=document.createElement('button');save.type='submit';save.textContent='Сохранить изменения';
     form.append(label,save);
     form.onsubmit=async event=>{
      event.preventDefault();
      const times=field.value.split(',').map(x=>x.trim()).filter(Boolean);
      if(!times.length||times.some(x=>!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(x))||new Set(times).size!==times.length){notice('Укажите различные времена в формате ЧЧ:ММ.');return;}
      if(!window.confirm('Изменить времена только для будущих приёмов? Прошлая история сохранится.'))return;
      save.disabled=true;
      try{
       const changedAt=new Date().toISOString();
       await pages.changeCourse(med.id,course=>{
        if(course.active===false||course.cancelled||course.archivedCompleted)throw Error('Курс завершён');
        course.rowHistory=course.rowHistory||[];
        course.rowHistory.push({action:'times_changed',at:changedAt,previousTimes:[...(course.times||[])],newTimes:[...times]});
        course.times=[...times].sort();
       });
       notice('Новые времена зашифрованы и сохранены.');render();
      }catch(error){save.disabled=false;notice('Не удалось изменить времена: '+error.message);}
     };
     edit.append(form);article.append(edit);
    }
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const editInfo=document.createElement('details');
     const title=document.createElement('summary');title.textContent='Изменить сведения о препарате';editInfo.append(title);
     const form=document.createElement('form');
     const keys=['name','manufacturer','contentValue','contentUnit','contentUnitOther','intakeQuantity','intakeUnit','intakeUnitOther','details'];
     const captions=['Название','Производитель','Количественное содержание','Единица содержания','Другая единица содержания','Количество приёма','Единица приёма','Другая единица приёма','Детали'];
     keys.forEach((key,index)=>{
      const label=document.createElement('label');label.textContent=captions[index];
      const input=document.createElement('input');input.name=key;input.value=String(key==='contentValue'?(med.contentValue??med.contentQuantity??''):(med[key]??''));
      if(key==='name')input.required=true;
      if(key==='contentValue'||key==='intakeQuantity'){input.type='number';input.min='0';input.step='any';}
      label.append(input);form.append(label);
     });
     const save=document.createElement('button');save.textContent='Сохранить сведения';form.append(save);
     form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form),next={};
      for(const key of keys)next[key]=String(data.get(key)||'').trim();
      if(!next.name){notice('Название обязательно.');return;}
      save.disabled=true;
      try{
       await pages.changeCourse(med.id,course=>{
        if(course.active===false||course.cancelled||course.archivedCompleted)throw Error('Курс завершён');
        const previous={};let changed=false;
        for(const key of keys){previous[key]=course[key]??'';if(String(previous[key])!==next[key])changed=true;}
        if(!changed)return;
        Object.assign(course,next);
        course.rowHistory=course.rowHistory||[];
        course.rowHistory.push({action:'details_changed',at:new Date().toISOString(),previous,next:{...next}});
       });
       notice('Сведения зашифрованы и сохранены.');render();
      }catch(error){save.disabled=false;notice('Ошибка сохранения: '+error.message);}
     };
     editInfo.append(form);article.append(editInfo);
    }
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const scheduleEdit=document.createElement('details');
     const caption=document.createElement('summary');caption.textContent='Изменить будущее расписание курса';scheduleEdit.append(caption);
     const form=document.createElement('form');
     const rule=document.createElement('select');rule.name='scheduleType';
     for(const [value,label] of [['daily','Каждый день'],['weekdays','Дни недели'],['explicit_dates','Конкретные даты']])rule.add(new Option(label,value));
     rule.value=med.scheduleType||'daily';
     const label=document.createElement('label');label.textContent='Расписание';label.append(rule);form.append(label);
     const weekdays=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent='Дни недели';weekdays.append(legend);
     for(const [value,text] of [['Mon','Пн'],['Tue','Вт'],['Wed','Ср'],['Thu','Чт'],['Fri','Пт'],['Sat','Сб'],['Sun','Вс']]){
      const dayLabel=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='weekday';input.value=value;input.checked=(med.weekdays||[]).includes(value);
      dayLabel.append(input,document.createTextNode(text));weekdays.append(dayLabel);
     }
     form.append(weekdays);
     const datesLabel=document.createElement('label');datesLabel.textContent='Конкретные даты (через запятую)';
     const dates=document.createElement('input');dates.name='explicitDates';dates.value=(med.explicitDates||[]).join(', ');datesLabel.append(dates);form.append(datesLabel);
     const sync=()=>{weekdays.hidden=rule.value!=='weekdays';datesLabel.hidden=rule.value!=='explicit_dates';};rule.onchange=sync;sync();
     const save=document.createElement('button');save.textContent='Сохранить расписание';form.append(save);
     form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form);
      const next={scheduleType:String(data.get('scheduleType')),weekdays:data.getAll('weekday').map(String),explicitDates:String(data.get('explicitDates')||'').split(',').map(x=>x.trim()).filter(Boolean).sort()};
      if(next.scheduleType==='weekdays'&&!next.weekdays.length){notice('Выберите дни недели.');return;}
      if(next.scheduleType==='explicit_dates'&&(!next.explicitDates.length||next.explicitDates.some(x=>!validCalendarDay(x)))){notice('Проверьте конкретные даты.');return;}
      if(!window.confirm('Изменить будущее расписание? История прошлых приёмов останется без изменений.'))return;
      save.disabled=true;
      try{
       await pages.changeCourse(med.id,course=>{
        if(course.active===false||course.cancelled||course.archivedCompleted)throw Error('Курс завершён');
        const previous={scheduleType:course.scheduleType||'daily',weekdays:[...(course.weekdays||[])],explicitDates:[...(course.explicitDates||[])]};
        course.rowHistory=course.rowHistory||[];
        course.rowHistory.push({action:'schedule_changed',at:new Date().toISOString(),previous,next:{...next}});
        Object.assign(course,next);
       });
       notice('Расписание зашифровано и сохранено.');render();
      }catch(error){save.disabled=false;notice('Не удалось сохранить расписание: '+error.message);}
     };
     scheduleEdit.append(form);article.append(scheduleEdit);
    }
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const cancelCourse=document.createElement('button');
     cancelCourse.type='button';cancelCourse.textContent='Отменить препарат';
     cancelCourse.onclick=async()=>{
      if(!window.confirm('Отменить препарат «'+med.name+'»? Все уже зарегистрированные приёмы и история изменений сохранятся.'))return;
      cancelCourse.disabled=true;
      try{
       await pages.changeCourse(med.id,course=>{
        if(course.active===false||course.cancelled||course.archivedCompleted)throw Error('Препарат уже выведен из рабочего цикла');
        course.cancelled=true;course.active=false;
        course.rowHistory=course.rowHistory||[];
        course.rowHistory.push({action:'cancelled',at:new Date().toISOString()});
       });
       notice('Отмена препарата зашифрована и сохранена.');render();
      }catch(error){cancelCourse.disabled=false;notice('Ошибка отмены препарата: '+error.message);}
     };
     article.append(cancelCourse);
    }
    const history=document.createElement('details');
    const summaryTitle=document.createElement('summary');
    summaryTitle.textContent='История курса и изменения';
    history.append(summaryTitle);
    for(const entry of med.rowHistory||[]){
     const line=document.createElement('p');
     const labels={created:'Создано',completed:'Завершён',cancelled:'Отменён',times_changed:'Изменены времена приёма',schedule_changed:'Изменено расписание',details_changed:'Изменены сведения',edited:'Изменён режим препарата'};
     const action=labels[entry.action]||entry.action||'Событие';
     line.textContent=(entry.at?new Date(entry.at).toLocaleString()+' — ':'')+action;
     if(entry.action==='edited'&&entry.details)line.textContent+=': '+entry.details;
     if(entry.action==='times_changed'){
      line.textContent+=': '+(entry.previousTimes||[]).join(', ')+' → '+(entry.newTimes||[]).join(', ');
     }else if(entry.action==='schedule_changed'){
      const describe=rule=>rule.scheduleType==='weekdays'?'Дни недели: '+(rule.weekdays||[]).join(', '):rule.scheduleType==='explicit_dates'?'Даты: '+(rule.explicitDates||[]).join(', '):'Каждый день';
      if(entry.previous&&entry.next)line.textContent+=': '+describe(entry.previous)+' → '+describe(entry.next);
     }else if(entry.action==='details_changed'&&entry.previous&&entry.next){
      const keys=Object.keys(entry.next).filter(key=>String(entry.previous[key]??'')!==String(entry.next[key]??''));
      const details=document.createElement('ul');
      for(const key of keys){
       const item=document.createElement('li');item.textContent=key+': '+String(entry.previous[key]??'')+' → '+String(entry.next[key]??'');details.append(item);
      }
      line.append(details);
     }
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
    const today=new Date();
    const zone=state.settings?.timezone||'Asia/Yerevan';
    const date=zoneDay(today,zone);
    for(const time of plannedTimes(med,date)){
     if(med.cancelled||med.archivedCompleted||med.active===false||date<med.startDate||date>(med.endDate||med.startDate))continue;
     if(!scheduledOn(med,date,time))continue;
     const plannedAt=zonedSlot(date,time,zone);
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
    const zone=state.settings?.timezone||'Asia/Yerevan';
    const since=period==='all'?0:period==='today'?Date.parse(zonedSlot(zoneDay(new Date(now),zone),'00:00',zone)):now-Number(period)*86400000;
    const slots=new Map();
    for(const log of (state.intakeLogs||[]).filter(x=>x.medicationId===med.id&&new Date(x.plannedAt).getTime()>=since)){
     if(!slots.has(log.plannedAt))slots.set(log.plannedAt,[]);
     slots.get(log.plannedAt).push(log);
    }
    if(section==='archive'){
     const lower=Math.max(since,Date.parse(zonedSlot(med.startDate,'00:00',zone)));
     const endDay=med.endDate||med.startDate;
     const upper=Math.min(now,Date.parse(zonedSlot(endDay,'23:59',zone))+59999);
     if(Number.isFinite(lower)&&Number.isFinite(upper)&&lower<=upper){
      const day=new Date(med.startDate+'T12:00:00Z');
      const maxDays=period==='all'?3660:32;
      for(let count=0;count<maxDays;count++,day.setUTCDate(day.getUTCDate()+1)){
       const dayString=day.toISOString().slice(0,10);
       if(dayString>endDay)break;
       for(const time of plannedTimes(med,dayString)){
        if(!scheduledOn(med,dayString,time))continue;
        const timestamp=Date.parse(zonedSlot(dayString,time,zone));
        if(timestamp>upper||timestamp<lower)continue;
        const plannedAt=new Date(timestamp).toISOString();
        if(!slots.has(plannedAt))slots.set(plannedAt,[]);
       }
      }
     }
    }
    for(const [plannedAt,events] of [...slots].sort((a,b)=>a[0].localeCompare(b[0]))){
     events.sort((a,b)=>String(a.actualAt||a.createdAt||'').localeCompare(String(b.actualAt||b.createdAt||'')));
     const taken=events.reduce((active,event)=>event.action==='taken'?event:(['cancelled','cancel_taken','undo_taken'].includes(event.action)?null:active),null);
     const outcome=window.__medcontrolProtectedArchiveOutcome||'';
     if(section==='archive'&&(!outcome||(outcome==='taken')!==Boolean(taken)))continue;
     const p=document.createElement('p');
     p.textContent=(taken?'Принято':'Не принято')+': расчётное '+new Date(plannedAt).toLocaleString()+(taken?'; фактическое '+new Date(taken.actualAt).toLocaleString():'');
     article.append(p);
     if(section==='archive'&&taken){
      const undo=document.createElement('button');undo.type='button';
      undo.textContent='Отменить «Принято» (случайность)';
      undo.onclick=async()=>{
       if(!window.confirm('Отменить ошибочное подтверждение? Запись об отмене сохранится в истории.'))return;
       undo.disabled=true;
       try{
        await pages.cancelIntake({id:crypto.randomUUID(),medicationId:med.id,plannedAt,actualAt:new Date().toISOString()});
        notice('Отмена зашифрована и сохранена.');render();
       }catch(error){undo.disabled=false;notice('Ошибка отмены: '+error.message);}
      };
      article.append(undo);
     }
     if(section==='archive'&&events.length){
      const timeline=document.createElement('details');
      const caption=document.createElement('summary');caption.textContent='История событий ('+events.length+')';timeline.append(caption);
      for(const entry of events){
       const line=document.createElement('p');
       const kind=entry.action==='taken'?'Принято':['cancelled','cancel_taken','undo_taken'].includes(entry.action)?'Отмена «Принято»':String(entry.action||'Событие');
       const at=entry.actualAt||entry.createdAt;
       line.textContent=kind+(at?' — '+new Date(at).toLocaleString():'');
       timeline.append(line);
      }
      article.append(timeline);
     }
    }
   }
   screen.append(article);
  }
  if(section==='input'){
   const panel=document.createElement('section');panel.className='card protected-time-history';
   const heading=document.createElement('h3');heading.textContent='Удалённые и заменённые времена';panel.append(heading);
   let shown=0;
   for(const med of state.medications||[]){
    for(const entry of med.rowHistory||[]){
     if(entry.action!=='times_changed'||!Array.isArray(entry.previousTimes)||!Array.isArray(entry.newTimes))continue;
     const removed=entry.previousTimes.filter(v=>!entry.newTimes.includes(v));
     const added=entry.newTimes.filter(v=>!entry.previousTimes.includes(v));
     if(!removed.length&&!added.length)continue;
     shown++;
     const line=document.createElement('p');
     const date=entry.at?new Date(entry.at):null;
     const zone=state.settings?.timezone||'Asia/Yerevan';
     const when=date&&Number.isFinite(date.getTime())?date.toLocaleString('ru-RU',{timeZone:zone}):'Дата не указана';
     line.textContent=med.name+' · '+when+': '+(removed.length?'Удалено/заменено '+removed.join(', '):'')+(added.length?' → добавлено '+added.join(', '):'');
     panel.append(line);
    }
   }
   if(!shown){const p=document.createElement('p');p.className='muted';p.textContent='Нет удалённых или заменённых времён.';panel.append(p);}
   screen.append(panel);
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
 document.getElementById('import-backup').onclick=async()=>{
  const selected=document.getElementById('legacy-backup').files?.[0];
  const button=document.getElementById('import-backup');
  if(!selected){notice('Выберите зашифрованную копию MedControl в формате JSON.');return;}
  if(selected.size>20*1024*1024){notice('Файл превышает допустимый размер 20 МБ.');return;}
  if(!password.value||password.value.length<12){notice('Введите новый локальный пароль длиной не менее 12 символов.');return;}
  if(!window.confirm('Импортировать зашифрованную копию? Существующие данные не будут перезаписаны.'))return;
  button.disabled=true;
  const entered=password.value;
  try{
   const raw=await selected.text();
   const result=await window.MedControlModular3CopyMigration.importBackup(raw,entered);
   if(!await session.unlock(entered))throw Error('Не удалось открыть зашифрованную копию');
   password.value='';
   document.getElementById('legacy-backup').value='';
   notice('Зашифрованная копия импортирована и проверена. Препаратов: '+result.medications+'; приёмов: '+result.intakeLogs+'.');
   show();
  }catch(error){notice('Импорт не завершён: '+error.message+'. Исходный файл не изменён.');}
  finally{button.disabled=false;}
 };
 document.getElementById('recover').onclick=async()=>{
  const key='medcontrol_modular3_protected_state_v1';
  const credential='medcontrol_modular3_local_credential_v1';
  const source='affixo_medcontrol_standard_v3';
  const button=document.getElementById('recover');
  const entered=password.value;
  if(!entered){notice('Введите пароль, использованный при создании защищённой копии.');return;}
  if(localStorage.getItem(credential)!==null){
   notice('Локальный пароль уже зарегистрирован. Для открытия данных нажмите «Войти».');return;
  }
  if(localStorage.getItem(key)===null){
   notice('Незавершённая зашифрованная копия не найдена. Ничего не изменено.');return;
  }
  if(!window.confirm('Завершить восстановление защищённого хранилища? Существующая зашифрованная копия и исходные данные не будут удалены.'))return;
  button.disabled=true;
  try{
   const before=localStorage.getItem(key);
   if(localStorage.getItem(source)!==null){
    await window.MedControlModular3CopyMigration.resume(entered);
   }else{
    // Recover interrupted initialize(): enroll() verifies the password by decrypting the saved vault.
    await window.MedControlModular3OfflineCredential.enroll(entered);
   }
   if(localStorage.getItem(key)!==before)throw Error('Зашифрованная копия неожиданно изменилась');
   if(!await session.unlock(entered))throw Error('Не удалось открыть восстановленное хранилище');
   password.value='';
   notice('Доступ восстановлен. Зашифрованные данные проверены и открыты.');
   show();
  }catch(error){
   notice('Восстановление не завершено: '+error.message+'. Сохранённые данные не удалялись.');
  }finally{button.disabled=false;}
 };
 document.getElementById('unlock').onclick=async()=>{try{if(await session.unlock(password.value)){password.value='';notice('Автономный вход выполнен.');show();}else notice('Неверный пароль.');}catch(error){notice('Ошибка входа: '+error.message);}};
 document.getElementById('enroll').onclick=async()=>{try{await session.initialize({settings:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},medications:[],intakeLogs:[]},password.value);password.value='';notice('Защищённое хранилище создано.');show();}catch(error){notice('Не удалось создать хранилище: '+error.message);}};
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{section=button.dataset.tab;render();});
 document.getElementById('lock').onclick=async()=>{await session.lock();notice('Данные заблокированы.');render();};
 render();
})();
