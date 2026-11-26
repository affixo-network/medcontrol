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

 // Canonical 96-language registry including Filipino (#96).
 const policy=window.MedControlEntryLanguages;
 const languageRegistry=policy.registry.map(({code,name,englishName})=>[code,name,englishName]);
 let currentLanguage='ru',preparedEntry=null,pendingOperationNotice=null,displayLocaleUnavailable=false;
 const languagePanel=document.createElement('section');languagePanel.id='protected-language-choice';languagePanel.hidden=true;
 const languageTitle=document.createElement('label');languageTitle.htmlFor='protected-language-select';
 const languageSelect=document.createElement('select');languageSelect.id='protected-language-select';
 policy.registry.forEach(item=>languageSelect.add(new Option(item.name,item.code)));
 const languageConfirm=document.createElement('button');languageConfirm.id='protected-language-confirm';
 const languageHint=document.createElement('span');languagePanel.append(languageTitle,languageSelect,languageConfirm,languageHint);workspace.prepend(languagePanel);
 const entryOriginals=new Map();
 const entryWalker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(entryWalker.nextNode()){
  const node=entryWalker.currentNode;
  if(!node.parentElement?.closest('script,style,#workspace')&&node.textContent.trim())entryOriginals.set(node,node.textContent);
 }
 function textFor(prepared,text){
  if(text==='MedControl'||!prepared||prepared.code==='ru')return text;
  const exact=policy.translate(prepared,text);if(exact)return exact;
  const trimmed=String(text).trim(),plain=policy.translate(prepared,trimmed);
  if(plain)return text.replace(trimmed,plain);
  for(const item of Object.values(prepared.source)){
   if(!/⟦\d+⟧/.test(item.source)||!/[А-Яа-яЁё]/.test(item.source.replace(/⟦\d+⟧/g,'')))continue;
   const slots=[];
   const escaped=item.source.split(/(⟦\d+⟧)/g).map(part=>{
    if(/^⟦\d+⟧$/.test(part)){slots.push(part);return '([\\s\\S]*?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   }).join('');
   const match=new RegExp('^'+escaped+'$').exec(text),translated=policy.translate(prepared,item.source);
   if(match&&translated)return translated.replace(/⟦\d+⟧/g,slot=>match[slots.indexOf(slot)+1]);
  }
  const fragments=Object.keys(prepared.lookup||{}).filter(key=>prepared.lookup[key]&&/[А-Яа-яЁё]/.test(key)).sort((a,b)=>b.length-a.length);
  const escapedFragments=fragments.map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(escapedFragments.length){
   const pattern=new RegExp(escapedFragments.join('|'),'g');
   const remainder=String(text).replace(pattern,'');
   if(!/[А-Яа-яЁё]/.test(remainder))return String(text).replace(pattern,key=>prepared.lookup[key]);
  }
  return null;
 }
 // Rehearsal wording predates the canonical catalog. Resolve authored labels to
 // existing source phrases; never infer translations from medical names/values.
 const rehearsalAliases={
  'Название':'Название препарата','Другая единица содержания':'Другая единица содержания *','Другая единица приёма':'Другая единица приёма *',
  'Сохранить курс':'Сохранить','Активный режим':'Режим','Повторение курса':'Параметры расписания',
  'Конкретные даты':'Даты','Даты через запятую':'Даты','Конкретные даты (через запятую)':'Даты',
  'Другая':'Другое','шт.':'ед.','Часы приёма':'Часы','Минуты приёма':'Минуты',
  'ЧЧ:ММ':'00:00','Время в формате ЧЧ:ММ':'Укажите корректное время.',
  'Время в формате ЧЧ:ММ (необязательно)':'Укажите корректное время.',
  'Выбрать время 1':'Время 1','Выбрать время 2':'Время 2',
  'Укажите название препарата и дозировку.':'Во Вводе создаётся правило приёма: название, доза, расписание, время, дата начала, дата окончания и режим Активно / Пассивно.',
  'Выберите расписание и время приёма.':'Выберите режим расписания.',
  'Для второго приёма используйте «Время 2».':'Отметьте часы и минуты, затем нажмите «Добавить время».',
  'Проверьте даты начала и окончания.':'Проверьте дату окончания, дни недели / даты и время приёма.',
  'Нажмите «Добавить» для защищённого сохранения.':'Подтвердить и сохранить',
  'Добавьте хотя бы одно время приёма.':'Добавьте хотя бы одно время.',
  'Курс зашифрован и сохранён.':'Сохранённые данные курса',
  'Режим препарата зашифрован и сохранён.':'Изменено','Новые времена зашифрованы и сохранены.':'Изменено',
  'Сведения зашифрованы и сохранены.':'Изменено','Расписание зашифровано и сохранено.':'Изменено',
  'Отмена препарата зашифрована и сохранена.':'Отменено','Завершение курса зашифровано и сохранено.':'Курс завершён',
  'Приём зашифрован и сохранён.':'Принято','Отмена зашифрована и сохранена.':'Отмена «Принято»',
  'Дата окончания раньше даты начала.':'Дата окончания не может быть раньше даты начала.',
  'Выберите дни недели.':'Отметьте хотя бы один день недели.',
  'Укажите даты в формате ГГГГ-ММ-ДД.':'Например: 2026-04-10, 2026-04-20',
  'Расписание на сегодня':'Состояния текущего дня','Всего:':'Расчётный приём',
  '; принято:':'Принято','; ожидается:':'Ожидается','; не принято:':'Не принято',
  'Нет запланированных приёмов':'На сегодня активных позиций нет.',
  'Активировать препарат':'Активировать','Перевести в пассивный режим':'Сделать пассивным',
  'Изменить будущие времена приёма':'Изменить время','Времена (ЧЧ:ММ через запятую)':'Например: 09:00, 14:30, 21:00',
  'Сохранить изменения':'Сохранить','Укажите различные времена в формате ЧЧ:ММ.':'Укажите корректное время.',
  'Изменить сведения о препарате':'Изменить препарат','Сохранить сведения':'Сохранить',
  'Название обязательно.':'Введите название препарата.',
  'Изменить будущее расписание курса':'Параметры расписания','Сохранить расписание':'Сохранить',
  'Проверьте конкретные даты.':'Проверьте дату окончания, дни недели / даты и время приёма.',
  'История курса и изменения':'История изменений строки',
  'Изменены времена приёма':'Изменены данные времени.','Изменено расписание':'Параметры расписания заменены',
  'Изменены сведения':'Изменено','Изменён режим препарата':'Режим',
  'Завершить курс':'Отправить в архив',
  'Отменить «Принято» (случайность)':'Отменить «Принято»',
  'Отменить ошибочное подтверждение? Запись об отмене сохранится в истории.':'Отменить случайное нажатие «Принято»? Исходное фактическое время сохранится в истории.',
  ': расчётное':'Расчётное время','; фактическое':'Фактическое время',
  'История событий (':'История событий','Дата не указана':'Дата',
  'Удалено/заменено':'Удалено','→ добавлено':'добавлено',
  'Завершить курс «⟦0⟧»? История и приёмы сохранятся.':'Отправить завершённый курс «⟦0⟧» в Архив?',
  'Отменить препарат «⟦0⟧»? Все уже зарегистрированные приёмы и история изменений сохранятся.':['Отменить препарат','Препарат: ⟦0⟧','Продолжить?'],
  'Изменить времена только для будущих приёмов? Прошлая история сохранится.':['Изменение действует онлайн и не может создавать новые расчётные приёмы задним временем.','Продолжить?'],
  'Изменить будущее расписание? История прошлых приёмов останется без изменений.':['Изменение действует онлайн и не может создавать новые расчётные приёмы задним временем.','Продолжить?']
 };
 function ui(text){
  if(!preparedEntry||currentLanguage==='ru'||!/[А-Яа-яЁё]/.test(text))return text;
  const trimmed=text.trim(),alias=rehearsalAliases[trimmed];
  const translateAlias=value=>{
   if(value==='00:00')return value;
   const translated=textFor(preparedEntry,value);
   if(!translated)throw Error('Missing rehearsal catalog phrase: '+value);
   return translated;
  };
  if(alias){
   let translated=(Array.isArray(alias)?alias:[alias]).map(translateAlias).join(' ');
   if(/^[:;]/.test(trimmed))translated=trimmed[0]+' '+translated;
   if(/[:(]$/.test(trimmed))translated+=(trimmed.endsWith('(')?' (':':');
   if(trimmed.startsWith('→'))translated='→ '+translated;
   return text.replace(trimmed,translated);
  }
  const direct=textFor(preparedEntry,text);if(direct)return direct;
  // Preserve punctuation around a known system label, without processing values.
  const plain=trimmed.replace(/^[:;]\s*/,'').replace(/[:(]\s*$/,'');
  if(plain!==trimmed){
   const translated=textFor(preparedEntry,plain);
   if(translated)return text.replace(plain,translated);
  }
  window.medcontrolRehearsalLocaleError='Missing rehearsal catalog phrase: '+text;
  throw Error(window.medcontrolRehearsalLocaleError);
 }
 function localizeMarkup(element){
  if(currentLanguage==='ru')return;
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode;if(node.textContent.trim())node.textContent=ui(node.textContent);
  }
  for(const field of element.querySelectorAll('[aria-label],[title],[placeholder]'))for(const key of ['aria-label','title','placeholder']){
   const value=field.getAttribute(key);if(value)field.setAttribute(key,ui(value));
  }
 }
 function weekday(value,russian=value){
  if(currentLanguage==='ru')return russian;
  const offset=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(value);
  return new Intl.DateTimeFormat(currentLanguage,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,10,23+offset,12)));
 }
 function calendarDate(value){
  if(!value||currentLanguage==='ru')return value||'';
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(currentLanguage,{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):value;
 }
 function rehearsalConfirmation(template,values){
  return ui(template).replace(/⟦(\d+)⟧/g,(_,index)=>String(values[Number(index)]));
 }
 function userContent(text){
  const span=document.createElement('span');span.dataset.medcontrolUserContent='';span.dir='auto';span.textContent=text;return span;
 }
 function paintEntry(prepared){
  displayLocaleUnavailable=false;
  for(const [node,original]of entryOriginals){if(node.isConnected){const translated=textFor(prepared,original);if(translated)node.textContent=translated;}}
  document.documentElement.lang=prepared.code;
  document.documentElement.dir=policy.registry.find(item=>item.code===prepared.code).direction;
 }
 function applyLanguage(code,prepared=preparedEntry){
  if(!prepared||prepared.code!==code)throw Error('Selected catalog is not prepared');
  currentLanguage=code;preparedEntry=prepared;
  document.documentElement.lang=code;document.documentElement.dir=policy.registry.find(item=>item.code===code).direction;
  const labels=['Ввод','Приём препаратов','Табло','Архив'];
  document.querySelectorAll('#workspace nav [data-tab]').forEach((button,index)=>button.textContent=ui(labels[index]));
  document.getElementById('lock').textContent=textFor(prepared,'Выйти')||'MedControl';
  languageTitle.textContent=textFor(prepared,'Язык интерфейса')||'MedControl';
  languageSelect.setAttribute('aria-label',languageTitle.textContent);
  languageConfirm.textContent=textFor(prepared,'Подтвердить')||'MedControl';
  const heading=screen.querySelector('h2');if(heading)heading.textContent=textFor(prepared,labels[['input','action','dashboard','archive'].indexOf(section)])||'MedControl';
  window.medcontrolRenderActionSemantics?.(code);
 }
 function offerLanguage(){languagePanel.hidden=true;applyLanguage(session.read().settings.interfaceLanguage);}
 const changeLanguage=document.createElement('button');changeLanguage.id='protected-language-change';changeLanguage.type='button';
 changeLanguage.onclick=()=>{if(session.isEntryAuthorized()){languagePanel.hidden=false;languageSelect.value=currentLanguage;}};
 workspace.querySelector('nav').append(changeLanguage);
 function updateLanguageChange(){changeLanguage.textContent=textFor(preparedEntry,'Язык интерфейса')||'MedControl';}
 languageConfirm.onclick=async()=>{
  if(!session.isEntryAuthorized())return;
  const code=languageSelect.value;languageSelect.disabled=true;languageConfirm.disabled=true;
  try{const prepared=await policy.confirm(session,code);applyLanguage(code,prepared);languagePanel.hidden=true;render();}
  catch(error){languageSelect.value=currentLanguage;notice('Не удалось сохранить изменения. Предыдущие данные сохранены.');}
  finally{languageSelect.disabled=false;languageConfirm.disabled=false;}
 };
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
 // Language is detected only after successful password confirmation/unlock.
 const entryLanguage=document.getElementById('entry-language');
 const languageStep=document.getElementById('entry-language-step');
 const confirmEntryLanguage=document.getElementById('confirm-entry-language');
 const confirmPasswordLabel=document.getElementById('confirm-password-label');
 const confirmPassword=document.getElementById('confirm-password');
 let languagePending=false;
 let languageConfirmed=false;
 const suggested='ru';
 let entryLocaleVersion=0;
 let confirmationBusy=false,confirmingCode=null;
 async function renderEntryLanguage(){
  const ticket=++entryLocaleVersion;
  const code=entryLanguage.value||'en',policy=window.MedControlEntryLanguages;
  confirmEntryLanguage.disabled=true;
  document.getElementById('entry-language-label').firstChild.textContent='MedControl ';
  document.getElementById('entry-language-hint').textContent='';
  try{
   const prepared=await policy.prepare(code);
   if(ticket!==entryLocaleVersion)return;
   preparedEntry=prepared;currentLanguage=code;paintEntry(prepared);
   document.documentElement.lang=code;document.documentElement.dir=policy.registry.find(item=>item.code===code).direction;
   const localized=value=>code==='ru'?value:policy.translate(prepared,value);
   const language=localized('Язык интерфейса');
   const confirm=localized('Подтвердить');
   const enter=localized('Войти');
   if(!language||!confirm||!enter)throw Error('Mandatory entry labels are missing for '+code);
   document.getElementById('entry-language-label').firstChild.textContent=language+' ';
   entryLanguage.setAttribute('aria-label',language);
   confirmEntryLanguage.textContent=confirm;
   document.getElementById('unlock').textContent=enter;
   confirmEntryLanguage.disabled=confirmationBusy;
   if(languagePending)notice(pendingOperationNotice||'Язык интерфейса');
  }catch(error){
   if(ticket!==entryLocaleVersion)return;
   window.medcontrolEntryLocaleError=String(error?.message||error);
   document.getElementById('entry-language-hint').textContent=textFor(preparedEntry,'Ошибка')||'MedControl';
   entryLanguage.value=currentLanguage;
  }
 }
 entryLanguage.addEventListener('change',()=>{if(confirmationBusy){entryLanguage.value=confirmingCode;return;}renderEntryLanguage();});
 entryLanguage.replaceChildren();
 for(const [code,native,english] of languageRegistry)entryLanguage.add(new Option(native,code));
 entryLanguage.value=suggested;
 function beginLanguageStep(){
  languagePending=true;languageConfirmed=false;
  refreshImportControls();
  for(const child of login.children)if(child!==languageStep&&child.id!=='unlock'&&!child.contains(message)&&!child.contains(document.getElementById('preserved-backups')))child.hidden=true;
  const preferences=Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language];
  entryLanguage.value=policy.propose(preferences);
  renderEntryLanguage();languageStep.hidden=false;
  password.closest('label').hidden=true;confirmPasswordLabel.hidden=true;
  document.getElementById('unlock').hidden=true;
  document.getElementById('enroll').hidden=true;
  notice(pendingOperationNotice||'MedControl');
 }
 function resetEntryAfterLock(error){
  ++entryLocaleVersion;languagePending=false;languageConfirmed=false;
  confirmationBusy=false;confirmingCode=null;pendingOperationNotice=null;
  workspace.hidden=true;document.getElementById('screen')?.replaceChildren?.();login.hidden=false;
  password.value='';password.closest('label').hidden=false;
  confirmPassword.value='';confirmPasswordLabel.hidden=true;
  languageStep.hidden=true;languagePanel.hidden=true;
  const unlock=document.getElementById('unlock');unlock.hidden=false;unlock.disabled=false;
  entryLanguage.disabled=false;confirmEntryLanguage.disabled=false;
  if(typeof refreshImportControls==='function'){try{refreshImportControls();}catch(_){}}
  notice('Ошибка входа: '+String(error?.message||error));
 }
 confirmEntryLanguage.onclick=async()=>{
  if(!languagePending||!session.isUnlocked()||confirmationBusy)return;
  const code=entryLanguage.value;confirmingCode=code;confirmationBusy=true;confirmEntryLanguage.disabled=true;entryLanguage.disabled=true;++entryLocaleVersion;
  try{
   const prepared=await policy.confirm(session,code);
   preparedEntry=prepared;currentLanguage=code;paintEntry(prepared);languagePending=false;languageConfirmed=true;languageStep.hidden=true;
   document.getElementById('unlock').hidden=false;document.getElementById('unlock').disabled=false;
   document.getElementById('unlock').textContent=textFor(prepared,'Войти');
   document.documentElement.lang=code;document.documentElement.dir=policy.registry.find(item=>item.code===code).direction;
   notice('MedControl');
  }catch(error){
   if(!session.isUnlocked())resetEntryAfterLock(error);
   else notice('Не удалось сохранить изменение.');
  }
  finally{confirmationBusy=false;confirmingCode=null;entryLanguage.disabled=false;confirmEntryLanguage.disabled=false;}
 };
 async function afterUnlock({enter=false}={}){
  if(!session.isUnlocked())throw Error('Protected session is locked');
  if(!policy.confirmed(session.read().settings)){beginLanguageStep();return;}
  const prepared=await policy.restore(session);
  preparedEntry=prepared;currentLanguage=prepared.code;paintEntry(prepared);languagePending=false;languageConfirmed=true;languageStep.hidden=true;
  document.documentElement.lang=prepared.code;document.documentElement.dir=policy.registry.find(item=>item.code===prepared.code).direction;
  document.getElementById('unlock').textContent=textFor(prepared,'Войти');
  document.getElementById('unlock').hidden=false;document.getElementById('unlock').disabled=false;
  if(enter){session.authorizeEntry();languageConfirmed=false;show();}
 }
 document.getElementById('enroll').addEventListener('click',()=>{confirmPasswordLabel.hidden=false;},{capture:true});
 function operationNotice(text){pendingOperationNotice=text;notice(text);}
 function notice(text){
  if(displayLocaleUnavailable&&!preparedEntry){message.textContent='MedControl';return;}
  let localized=textFor(preparedEntry,text);
  if(preparedEntry&&new URLSearchParams(window.location.search).get('rehearsal')==='1'){try{localized=ui(text);}catch(_){/* Keep the existing selected-language generic failure label. */}}
  message.textContent=localized||(preparedEntry&&preparedEntry.code!=='ru'?(textFor(preparedEntry,'Ошибка')||'MedControl'):text);
 }
 function show(){
  // No protected interface may open before first-run language confirmation.
  if(session.isUnlocked()&&!window.MedControlEntryLanguages.confirmed(session.read().settings)){beginLanguageStep();return;}
  if(!session.isEntryAuthorized())throw Error('Explicit Enter authorization required');
  // Enter the established four-page Modular-3 interface after protected unlock.
  // Its auth guard retains the unlocked encrypted session and offers first-run language selection.
  if(new URLSearchParams(window.location.search).get('rehearsal')==='1'){
   login.hidden=true;workspace.hidden=false;render();offerLanguage();updateLanguageChange();return;
  }
  document.head.querySelectorAll('style').forEach(style=>style.remove());
  document.body.innerHTML='<div id="app">MedControl</div>';
  window.history.replaceState({medcontrolPage:'input'},'','/input.html');
  const script=document.createElement('script');
  script.src='/js/auth-guard.js';script.dataset.page='input';
  script.onerror=()=>{document.getElementById('app').textContent='Не удалось загрузить защищённый интерфейс. Медицинские записи не изменены.';};
  document.head.appendChild(script);
 }
 function render(){
  if(!session.isEntryAuthorized()){workspace.hidden=true;login.hidden=false;screen.replaceChildren();return;}
  const state=pages.read(section);
  screen.replaceChildren();
  const title=document.createElement('h2');title.textContent={input:ui('Ввод'),action:ui('Приём препаратов'),dashboard:ui('Табло'),archive:ui('Архив')}[section];screen.append(title);
  if(session.read().settings?.languageChoiceConfirmed)applyLanguage(session.read().settings.interfaceLanguage||currentLanguage);
  if(section==='archive'){
   const controls=document.createElement('section');controls.className='card';
   const heading=document.createElement('h2');heading.textContent=ui('История приёмов');controls.append(heading);
   const actions=document.createElement('div');actions.className='inline';
   const active=window.__medcontrolProtectedArchiveOutcome||'';
   for(const [value,label] of [['taken','Принято'],['missed','Не принято']]){
    const button=document.createElement('button');button.type='button';button.textContent=ui(label);
    button.setAttribute('aria-pressed',String(active===value));
    button.onclick=()=>{window.__medcontrolProtectedArchiveOutcome=value;render();};
    actions.append(button);
   }
   if(active){
    const filter=document.createElement('select');filter.setAttribute('aria-label',ui('Период истории'));
    for(const [value,label] of [['today','Сегодня'],['7','7 дней'],['30','30 дней'],['all','Весь период']])filter.add(new Option(ui(label),value));
    filter.value=window.__medcontrolProtectedArchivePeriod||'7';
    filter.onchange=()=>{window.__medcontrolProtectedArchivePeriod=filter.value;render();};
    const periodLabel=document.createElement('label');periodLabel.textContent=ui('Период');periodLabel.append(filter);actions.append(periodLabel);
    const collapse=document.createElement('button');collapse.type='button';collapse.textContent=ui('Свернуть');
    collapse.onclick=()=>{window.__medcontrolProtectedArchiveOutcome='';render();};actions.append(collapse);
   }
   controls.append(actions);screen.append(controls);
  }
  if(section==='input'){
   const form=document.createElement('form');
   form.innerHTML='<label>Название <input name="name" required></label><label>Производитель <input name="manufacturer"></label><label>Количественное содержание <input name="contentQuantity" type="number" min="0" step="any"></label><label>Единица содержания <input name="contentUnit"></label><label>Другая единица содержания <input name="contentUnitOther"></label><label>Количество приёма <input name="intakeQuantity" type="number" min="0" step="any"></label><label>Единица приёма <input name="intakeUnit"></label><label>Другая единица приёма <input name="intakeUnitOther"></label><label>Детали <input name="details"></label><label>Дата начала <input name="date" type="date" required></label><label>Дата окончания <input name="endDate" type="date" required></label><label>Время 1 <input name="first" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ" required> <button type="button" data-picker="first" aria-label="Выбрать время 1">◷</button></label><label>Время 2 <input name="second" type="text" inputmode="numeric" placeholder="ЧЧ:ММ" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Время в формате ЧЧ:ММ (необязательно)"> <button type="button" data-picker="second" aria-label="Выбрать время 2">◷</button></label><button>Сохранить курс</button>';localizeMarkup(form);
   const mode=document.createElement('label');mode.textContent=ui('Активный режим ');const activeInput=document.createElement('input');activeInput.type='checkbox';activeInput.name='active';activeInput.checked=true;mode.append(activeInput);form.querySelector('button:not([type])').before(mode);
   const schedule=document.createElement('fieldset');
   schedule.innerHTML='<legend>Повторение курса</legend><label>Расписание <select name="scheduleType"><option value="daily">Каждый день</option><option value="weekdays">Дни недели</option><option value="explicit_dates">Конкретные даты</option></select></label><div data-schedule-weekdays hidden>Дни недели: </div><label data-schedule-dates hidden>Даты через запятую <input name="explicitDates" placeholder="2026-10-18, 2026-10-20"></label>';localizeMarkup(schedule);
   const weekdaysBox=schedule.querySelector('[data-schedule-weekdays]');
   for(const day of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){
    const label=document.createElement('label');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='weekday';checkbox.value=day;
    label.append(checkbox,document.createTextNode(weekday(day)+' '));weekdaysBox.append(label);
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
     hour.setAttribute('aria-label',ui('Часы'));minute.setAttribute('aria-label',ui('Минуты'));
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
    dropdown.add(new Option(ui('Выберите'),''));
    for(const value of options)dropdown.add(new Option(ui(value),value));
    const other=form.elements.namedItem(otherName);
    const otherLabel=other.closest('label');otherLabel.hidden=true;
    other.placeholder=ui(name==='contentUnit'?'Укажите другую единицу содержания.':'Укажите другую единицу приёма.');other.required=false;
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
   const editorTitle=document.createElement('h3');editorTitle.textContent=ui('Новый препарат');editor.append(editorTitle);
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
   const scheduleTitle=document.createElement('h4');scheduleTitle.textContent=ui('Расписание');editor.append(scheduleTitle);
   const scheduleFields=document.createElement('div');scheduleFields.className='protected-schedule-fields';
   scheduleFields.append(schedule,mode);
   const firstInput=form.elements.namedItem('first'),secondInput=form.elements.namedItem('second');
   const times=new Set();
   const timeBox=document.createElement('fieldset');timeBox.className='protected-time-editor';
   const legend=document.createElement('legend');legend.textContent=ui('Время приёма');timeBox.append(legend);
   const controls=document.createElement('div');controls.className='protected-time-controls';
   const hour=document.createElement('select'),minute=document.createElement('select');
   hour.setAttribute('aria-label',ui('Часы приёма'));minute.setAttribute('aria-label',ui('Минуты приёма'));
   for(let i=0;i<24;i++){const n=String(i).padStart(2,'0');hour.add(new Option(n,n));}
   for(let i=0;i<60;i++){const n=String(i).padStart(2,'0');minute.add(new Option(n,n));}
   const add=document.createElement('button');add.type='button';add.textContent=ui('Добавить время');
   const list=document.createElement('div');list.className='protected-time-list';
   const sync=()=>{
    const values=[...times].sort();
    firstInput.value=values[0]||'';secondInput.value=values[1]||'';
    list.replaceChildren();
    for(const time of values){
     const chip=document.createElement('span');chip.className='protected-time-chip';
     const value=document.createElement('span');value.textContent=time;
     const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',ui('Удалить время')+' '+time);
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
   save.textContent=ui('Добавить');save.classList.add('protected-save-course');editor.append(save);
   const help=document.createElement('aside');help.className='protected-input-help';
   const helpTitle=document.createElement('h3');helpTitle.textContent=ui('Варианты заполнения');help.append(helpTitle);
   const hints=document.createElement('ul');
   for(const hint of ['Укажите название препарата и дозировку.','Выберите расписание и время приёма.','Для второго приёма используйте «Время 2».','Проверьте даты начала и окончания.','Нажмите «Добавить» для защищённого сохранения.']){
    const item=document.createElement('li');item.textContent=ui(hint);hints.append(item);
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
   const heading=document.createElement('h2');heading.textContent=ui('Расписание на сегодня');panel.append(heading);
   const summary=document.createElement('p');
   summary.className='muted';
   summary.textContent=ui('Всего: ')+today.length+ui('; принято: ')+today.filter(x=>x.taken).length+ui('; ожидается: ')+today.filter(x=>!x.taken&&new Date(x.plannedAt)>now).length+ui('; не принято: ')+today.filter(x=>!x.taken&&new Date(x.plannedAt)<=now).length;
   panel.append(summary);
   const table=document.createElement('table');
   const thead=document.createElement('thead');
   const header=document.createElement('tr');
   for(const label of ['№','Препарат','Доза','Расчётное время','Состояние']){const th=document.createElement('th');th.textContent=ui(label);header.append(th);}
   thead.append(header);table.append(thead);
   const tbody=document.createElement('tbody');
   for(const [index,item] of today.entries()){
    const row=document.createElement('tr');
    const dose=[item.med.intakeQuantity||item.med.dose||'',item.med.intakeUnit||''].filter(Boolean).join(' ');
    const status=item.taken?ui('Принято · ')+new Date(item.taken.actualAt).toLocaleTimeString(currentLanguage==='ru'?undefined:currentLanguage):new Date(item.plannedAt)>now?ui('Ожидается'):ui('Не принято');
    for(const value of [String(item.med.order||index+1),item.med.name,dose,item.time,status]){
     const td=document.createElement('td');td.textContent=value;if(value===item.med.name||value===dose)td.dataset.medcontrolUserContent='';row.append(td);
    }
    row.lastElementChild.className=item.taken?'success':new Date(item.plannedAt)>now?'upcoming':'overdue';
    tbody.append(row);
   }
   if(!today.length){const row=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent=ui('Нет запланированных приёмов');row.append(td);tbody.append(row);}
   table.append(tbody);panel.append(table);screen.append(panel);
   return;
  }
  for(const med of state.medications){
   if(section==='archive'&&!(med.cancelled||med.archivedCompleted))continue;
   if(section==='action'&&(med.cancelled||med.archivedCompleted||med.active===false))continue;
   const article=document.createElement('article');
   const heading=document.createElement('h3');heading.textContent=med.name;article.append(heading);
   const summary=document.createElement('p');summary.textContent=(med.times||[]).join(', ')+' · '+calendarDate(med.startDate)+' — '+calendarDate(med.endDate||med.startDate);article.append(summary);
   if(section==='input'){
    if(!med.cancelled&&!med.archivedCompleted){
     const toggle=document.createElement('button');toggle.type='button';toggle.textContent=med.active===false?ui('Активировать препарат'):ui('Перевести в пассивный режим');
     toggle.onclick=async()=>{toggle.disabled=true;try{await pages.changeCourse(med.id,course=>{if(course.cancelled||course.archivedCompleted)throw Error('Курс завершён');course.active=course.active===false;course.rowHistory=course.rowHistory||[];course.rowHistory.push({action:'edited',at:new Date().toISOString(),details:course.active?'Статус препарата изменён на «Активно».':'Статус препарата изменён на «Пассивно».'});});notice('Режим препарата зашифрован и сохранён.');render();}catch(error){toggle.disabled=false;notice('Не удалось изменить режим: '+error.message);}};
     article.append(toggle);
    }
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const edit=document.createElement('details');
     const caption=document.createElement('summary');caption.textContent=ui('Изменить будущие времена приёма');edit.append(caption);
     const form=document.createElement('form');
     const label=document.createElement('label');label.textContent=ui('Времена (ЧЧ:ММ через запятую) ');
     const field=document.createElement('input');field.required=true;field.value=(med.times||[]).join(', ');label.append(field);
     const save=document.createElement('button');save.type='submit';save.textContent=ui('Сохранить изменения');
     form.append(label,save);
     form.onsubmit=async event=>{
      event.preventDefault();
      const times=field.value.split(',').map(x=>x.trim()).filter(Boolean);
      if(!times.length||times.some(x=>!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(x))||new Set(times).size!==times.length){notice('Укажите различные времена в формате ЧЧ:ММ.');return;}
      if(!window.confirm(ui('Изменить времена только для будущих приёмов? Прошлая история сохранится.')))return;
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
     const title=document.createElement('summary');title.textContent=ui('Изменить сведения о препарате');editInfo.append(title);
     const form=document.createElement('form');
     const keys=['name','manufacturer','contentValue','contentUnit','contentUnitOther','intakeQuantity','intakeUnit','intakeUnitOther','details'];
     const captions=['Название','Производитель','Количественное содержание','Единица содержания','Другая единица содержания','Количество приёма','Единица приёма','Другая единица приёма','Детали'];
     keys.forEach((key,index)=>{
      const label=document.createElement('label');label.textContent=ui(captions[index]);
      const input=document.createElement('input');input.name=key;input.value=String(key==='contentValue'?(med.contentValue??med.contentQuantity??''):(med[key]??''));
      if(key==='name')input.required=true;
      if(key==='contentValue'||key==='intakeQuantity'){input.type='number';input.min='0';input.step='any';}
      label.append(input);form.append(label);
     });
     const save=document.createElement('button');save.textContent=ui('Сохранить сведения');form.append(save);
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
     const caption=document.createElement('summary');caption.textContent=ui('Изменить будущее расписание курса');scheduleEdit.append(caption);
     const form=document.createElement('form');
     const rule=document.createElement('select');rule.name='scheduleType';
     for(const [value,label] of [['daily','Каждый день'],['weekdays','Дни недели'],['explicit_dates','Конкретные даты']])rule.add(new Option(ui(label),value));
     rule.value=med.scheduleType||'daily';
     const label=document.createElement('label');label.textContent=ui('Расписание');label.append(rule);form.append(label);
     const weekdays=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=ui('Дни недели');weekdays.append(legend);
     for(const [value,text] of [['Mon','Пн'],['Tue','Вт'],['Wed','Ср'],['Thu','Чт'],['Fri','Пт'],['Sat','Сб'],['Sun','Вс']]){
      const dayLabel=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='weekday';input.value=value;input.checked=(med.weekdays||[]).includes(value);
      dayLabel.append(input,document.createTextNode(weekday(value,text)));weekdays.append(dayLabel);
     }
     form.append(weekdays);
     const datesLabel=document.createElement('label');datesLabel.textContent=ui('Конкретные даты (через запятую)');
     const dates=document.createElement('input');dates.name='explicitDates';dates.value=(med.explicitDates||[]).join(', ');datesLabel.append(dates);form.append(datesLabel);
     const sync=()=>{weekdays.hidden=rule.value!=='weekdays';datesLabel.hidden=rule.value!=='explicit_dates';};rule.onchange=sync;sync();
     const save=document.createElement('button');save.textContent=ui('Сохранить расписание');form.append(save);
     form.onsubmit=async event=>{
      event.preventDefault();
      const data=new FormData(form);
      const next={scheduleType:String(data.get('scheduleType')),weekdays:data.getAll('weekday').map(String),explicitDates:String(data.get('explicitDates')||'').split(',').map(x=>x.trim()).filter(Boolean).sort()};
      if(next.scheduleType==='weekdays'&&!next.weekdays.length){notice('Выберите дни недели.');return;}
      if(next.scheduleType==='explicit_dates'&&(!next.explicitDates.length||next.explicitDates.some(x=>!validCalendarDay(x)))){notice('Проверьте конкретные даты.');return;}
      if(!window.confirm(ui('Изменить будущее расписание? История прошлых приёмов останется без изменений.')))return;
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
     cancelCourse.type='button';cancelCourse.textContent=ui('Отменить препарат');
     cancelCourse.onclick=async()=>{
      if(!window.confirm(rehearsalConfirmation('Отменить препарат «⟦0⟧»? Все уже зарегистрированные приёмы и история изменений сохранятся.',[med.name])))return;
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
    summaryTitle.textContent=ui('История курса и изменения');
    history.append(summaryTitle);
    for(const entry of med.rowHistory||[]){
     const line=document.createElement('p');
     const labels={created:ui('Создано'),completed:ui('Завершён'),cancelled:ui('Отменён'),times_changed:ui('Изменены времена приёма'),schedule_changed:ui('Изменено расписание'),details_changed:ui('Изменены сведения'),edited:ui('Изменён режим препарата')};
     const action=labels[entry.action]||entry.action||'Событие';
     line.textContent=(entry.at?new Date(entry.at).toLocaleString(currentLanguage==='ru'?undefined:currentLanguage)+' — ':'')+action;
     if(entry.action==='edited'&&entry.details){line.append(document.createTextNode(': '));if(['Статус препарата изменён на «Активно».','Статус препарата изменён на «Пассивно».'].includes(entry.details))line.append(document.createTextNode(ui(entry.details)));else line.append(userContent(entry.details));}
     if(entry.action==='times_changed'){
      line.textContent+=': '+(entry.previousTimes||[]).join(', ')+' → '+(entry.newTimes||[]).join(', ');
     }else if(entry.action==='schedule_changed'){
      const describe=rule=>rule.scheduleType==='weekdays'?ui('Дни недели: ')+(rule.weekdays||[]).map(value=>weekday(value)).join(', '):rule.scheduleType==='explicit_dates'?ui('Даты: ')+(rule.explicitDates||[]).map(calendarDate).join(', '):ui('Каждый день');
      if(entry.previous&&entry.next)line.textContent+=': '+describe(entry.previous)+' → '+describe(entry.next);
     }else if(entry.action==='details_changed'&&entry.previous&&entry.next){
      const keys=Object.keys(entry.next).filter(key=>String(entry.previous[key]??'')!==String(entry.next[key]??''));
      const details=document.createElement('ul');
      for(const key of keys){
       const item=document.createElement('li');const captions={name:'Название препарата',manufacturer:'Производитель',contentValue:'Количественное содержание',contentUnit:'Единица содержания',contentUnitOther:'Другая единица содержания',intakeQuantity:'Количество приёма',intakeUnit:'Единица приёма',intakeUnitOther:'Другая единица приёма',details:'Детали'};if(currentLanguage==='ru')item.textContent=key+': '+String(entry.previous[key]??'')+' → '+String(entry.next[key]??'');else item.append(document.createTextNode(ui(captions[key]||'Детали')+': '),userContent(String(entry.previous[key]??'')),document.createTextNode(' → '),userContent(String(entry.next[key]??'')));details.append(item);
      }
      line.append(details);
     }
     history.append(line);
    }
    article.append(history);
    if(med.active!==false&&!med.cancelled&&!med.archivedCompleted){
     const stop=document.createElement('button');
     stop.type='button';
     stop.textContent=ui('Завершить курс');
     stop.onclick=async()=>{
      if(!window.confirm(rehearsalConfirmation('Завершить курс «⟦0⟧»? История и приёмы сохранятся.',[med.name])))return;
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
     const button=document.createElement('button');button.textContent=log?ui('Принято: ')+new Date(log.actualAt).toLocaleString(currentLanguage==='ru'?undefined:currentLanguage):ui('Принято ')+time;button.disabled=!!log;
     button.onclick=async()=>{
      try{await pages.recordIntake({id:crypto.randomUUID(),medicationId:med.id,plannedAt,actualAt:new Date().toISOString(),action:'taken'});notice('Приём зашифрован и сохранён.');render();}
      catch(error){notice('Ошибка сохранения: '+error.message);}
     };article.append(button);
     if(log){
      const cancel=document.createElement('button');
      cancel.type='button';
      cancel.textContent=ui('Отменить «Принято» (случайность)');
      cancel.onclick=async()=>{
       if(!window.confirm(ui('Отменить ошибочное подтверждение? Запись об отмене сохранится в истории.')))return;
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
     p.textContent=(taken?ui('Принято'):ui('Не принято'))+ui(': расчётное ')+new Date(plannedAt).toLocaleString(currentLanguage==='ru'?undefined:currentLanguage)+(taken?ui('; фактическое ')+new Date(taken.actualAt).toLocaleString(currentLanguage==='ru'?undefined:currentLanguage):'');
     article.append(p);
     if(section==='archive'&&taken){
      const undo=document.createElement('button');undo.type='button';
      undo.textContent=ui('Отменить «Принято» (случайность)');
      undo.onclick=async()=>{
       if(!window.confirm(ui('Отменить ошибочное подтверждение? Запись об отмене сохранится в истории.')))return;
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
      const caption=document.createElement('summary');caption.textContent=ui('История событий (')+events.length+')';timeline.append(caption);
      for(const entry of events){
       const line=document.createElement('p');
       const kind=entry.action==='taken'?ui('Принято'):['cancelled','cancel_taken','undo_taken'].includes(entry.action)?ui('Отмена «Принято»'):String(entry.action||ui('Событие'));
       const at=entry.actualAt||entry.createdAt;
       line.textContent=kind+(at?' — '+new Date(at).toLocaleString(currentLanguage==='ru'?undefined:currentLanguage):'');
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
   const heading=document.createElement('h3');heading.textContent=ui('Удалённые и заменённые времена');panel.append(heading);
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
     const when=date&&Number.isFinite(date.getTime())?date.toLocaleString(currentLanguage==='ru'?'ru-RU':currentLanguage,{timeZone:zone}):ui('Дата не указана');
     line.append(userContent(med.name));line.append(document.createTextNode(' · '+when+': '+(removed.length?ui('Удалено/заменено ')+removed.join(', '):'')+(added.length?ui(' → добавлено ')+added.join(', '):'')));
     panel.append(line);
    }
   }
   if(!shown){const p=document.createElement('p');p.className='muted';p.textContent=ui('Нет удалённых или заменённых времён.');panel.append(p);}
   screen.append(panel);
  }
 }
 function comparisonNotice(plan){
  const check=plan.comparison;
  return 'Сверка завершена. Курсов из файла найдено: '+check.medications.matched+' из '+check.medications.total+'; событий приёма: '+check.intakeLogs.matched+' из '+check.intakeLogs.total+'. Различий в полях файла: '+check.differentFields.length+'. Дополнительно в хранилище: '+check.medications.additional+' курсов; '+check.intakeLogs.additional+' событий. '+(check.allIncluded?'Все данные выбранного файла уже присутствуют. Повторный импорт не требуется.':'Полное соответствие файлу не подтверждено.')+' Сверка данные не изменяет.';
 }
 document.getElementById('inspect-migration').onclick=async()=>{
  const controls=[...document.querySelectorAll('#login button')];
  let compared=false;
  try{
   const selected=document.getElementById('legacy-backup').files?.[0];
   const existingVault=localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null;
   if(existingVault&&!selected){
    notice('Для сверки выберите файл medcontrol-encrypted-transfer.json в блоке «Резервная копия MedControl (.json)». После обновления страницы файл нужно выбрать заново. Сверка не запускалась; данные не изменены.');
    document.getElementById('legacy-backup').focus();return;
   }
   if(selected&&existingVault){
    compared=true;controls.forEach(button=>{button.disabled=true;});
    document.getElementById('open-imported').hidden=true;
    if(selected.size>20*1024*1024)throw Error('Файл превышает допустимый размер 20 МБ');
    if(!password.value)throw Error('Введите прежний локальный пароль');
    const filePassword=document.getElementById('transfer-password').value;
    if(filePassword.length<12)throw Error('Введите пароль файла переноса в отдельное поле');
    if(!await session.unlock(password.value))throw Error('Неверный пароль существующего хранилища');
    const plan=await window.MedControlModular3CopyMigration.previewExistingImport(await selected.text(),filePassword);
    notice(comparisonNotice(plan));return;
   }
   const result=window.MedControlModular3CopyMigration.inspect();
   if(result.reason==='legacy_missing'){notice('Исходные данные на этом устройстве не найдены. Перенос не запускался.');return;}
   if(!result.ready){notice('Перенос пока недоступен: '+result.reason+'. Данные не изменены.');return;}
   const counts=result.counts;
   notice('Проверка без изменений завершена. Препаратов: '+counts.medications+'; приёмов: '+counts.intakeLogs+'; отмен: '+(counts.intakeCorrections||0)+'; архивных событий: '+(counts.archiveHistory||0)+'. Перенос не запускался.');
  }catch(error){notice('Проверка не выполнена: '+error.message);}
  finally{if(compared)await session.lock();controls.forEach(button=>{button.disabled=false;});}
 };
 document.getElementById('commit-migration').onclick=async()=>{
  const migration=window.MedControlModular3CopyMigration;
  const inspection=migration.inspect();
  if(!inspection.ready){notice('Перенос недоступен: '+inspection.reason+'. Данные не изменены.');return;}
  if(!password.value){notice('Для переноса введите новый локальный пароль.');return;}
  const counts=inspection.counts;
  const confirmed=window.confirm('Создать зашифрованную копию '+counts.medications+' препаратов и '+counts.intakeLogs+' приёмов? Исходная история сохранится без изменений.');
  if(!confirmed){notice('Перенос отменён. Исходные данные не изменены.');return;}
  document.getElementById('unlock').disabled=true;
  document.getElementById('commit-migration').disabled=true;
  try{
   const result=await migration.commit(password.value);
   const unlocked=await session.unlock(password.value);
   if(!unlocked)throw Error('Не удалось проверить локальный вход после переноса');
   password.value='';
   operationNotice('Защищённая копия проверена и сохранена. Исходная история не изменена. Препаратов: '+result.medications+'; приёмов: '+result.intakeLogs+'.');
   await afterUnlock();
  }catch(error){notice('Перенос не завершён: '+error.message+'. Исходная история не удалялась.');}
  finally{document.getElementById('unlock').disabled=false;document.getElementById('commit-migration').disabled=false;}
 };
 function refreshImportControls(){
  try{
   document.getElementById('existing-import').hidden=languagePending||(localStorage.getItem('medcontrol_modular3_protected_state_v1')===null&&localStorage.getItem('medcontrol_modular3_local_credential_v1')===null);
   const backups=window.MedControlModular3CopyMigration.listPreservedBackups();
   const list=document.getElementById('preserved-backup');list.replaceChildren();
   for(const backup of backups)list.add(new Option(new Date(backup.createdAt).toLocaleString(),backup.key));
   document.getElementById('preserved-backups').hidden=backups.length===0;
  }catch(_){/* A storage error is reported by the requested login/import operation. */}
 }
 document.getElementById('download-preserved-backup').onclick=()=>{
  try{
   const key=document.getElementById('preserved-backup').value;
   const raw=window.MedControlModular3CopyMigration.exportPreservedBackup(key);
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='medcontrol-preserved-before-import.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){notice('Не удалось скачать сохранённую копию: '+error.message);}
 };
 document.getElementById('open-imported').onclick=async()=>{try{await afterUnlock({enter:true});}catch(error){notice('Ошибка входа: '+error.message);}};
 refreshImportControls();
 document.getElementById('import-backup').onclick=async()=>{
  const selected=document.getElementById('legacy-backup').files?.[0];
  const button=document.getElementById('import-backup');
  if(!selected){notice('Выберите зашифрованную копию MedControl в формате JSON.');return;}
  if(selected.size>20*1024*1024){notice('Файл превышает допустимый размер 20 МБ.');return;}
  if(!password.value||password.value.length<12){notice('Введите локальный пароль длиной не менее 12 символов.');return;}
  button.disabled=true;
  languagePending=false;languageConfirmed=false;
  const entryButtons=[...document.querySelectorAll('#login button')];
  entryButtons.forEach(control=>{control.disabled=true;});
  document.getElementById('open-imported').hidden=true;
  const entered=password.value;
  let existing=false;
  let activated=false;
  try{
   const data=localStorage.getItem('medcontrol_modular3_protected_state_v1');
   const credential=localStorage.getItem('medcontrol_modular3_local_credential_v1');
   existing=data!==null||credential!==null;
   if(existing){
    if(data===null||credential===null)throw Error('Хранилище создано не полностью. Сначала используйте «Восстановить доступ».');
    document.getElementById('existing-import').hidden=false;
    const filePassword=document.getElementById('transfer-password').value;
    if(filePassword.length<12)throw Error('Введите пароль файла переноса в отдельное поле (не менее 12 символов)');
    if(!await session.unlock(entered))throw Error('Неверный пароль существующего хранилища');
    const raw=await selected.text();
    const migration=window.MedControlModular3CopyMigration;
    const plan=await migration.previewExistingImport(raw,filePassword);
    const confirmed=plan.comparison.allIncluded||window.confirm('Перенести из файла '+plan.incoming.medications+' курсов и '+plan.incoming.intakeLogs+' событий приёма в рабочее хранилище?\nТекущее хранилище ('+plan.existing.medications+' курсов; '+plan.existing.intakeLogs+' событий) сначала сохранится отдельной зашифрованной копией. Её можно будет скачать.\nПароль входа останется прежним. Исходный Modular-2 и файл переноса не изменяются.');
    if(!confirmed){notice('Импорт отменён. Хранилище не изменено.');return;}
    const result=await migration.commitExistingImport(plan);
    password.value='';document.getElementById('transfer-password').value='';document.getElementById('legacy-backup').value='';
    refreshImportControls();
    operationNotice((result.alreadyImported?comparisonNotice(plan):'Копия перенесена и проверена. Прежнее хранилище сохранено отдельно.')+' Препаратов: '+result.medications+'; приёмов: '+result.intakeLogs+'. Пароль входа остался прежним.');
    await afterUnlock();
    document.getElementById('open-imported').hidden=false;
    activated=true;
    return;
   }
   if(!window.confirm('Импортировать зашифрованную копию? Существующие данные не будут перезаписаны.'))return;
   const raw=await selected.text();
   const result=await window.MedControlModular3CopyMigration.importBackup(raw,entered);
   if(!await session.unlock(entered))throw Error('Не удалось открыть зашифрованную копию');
   password.value='';
   document.getElementById('legacy-backup').value='';
   operationNotice('Зашифрованная копия импортирована и проверена. Препаратов: '+result.medications+'; приёмов: '+result.intakeLogs+'.');
   await afterUnlock();
  }catch(error){notice('Импорт не завершён: '+error.message+'. Исходный файл не изменён.');refreshImportControls();}
  finally{
   // A preview unlock is not authorization to leave medical data open after cancellation/failure.
   if(existing&&!activated)await session.lock();
   entryButtons.forEach(control=>{control.disabled=false;});
  }
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
   operationNotice('Доступ восстановлен. Зашифрованные данные проверены и открыты.');
   await afterUnlock();
  }catch(error){
   notice('Восстановление не завершено: '+error.message+'. Сохранённые данные не удалялись.');
  }finally{button.disabled=false;}
 };
 document.getElementById('unlock').onclick=async()=>{
  const button=document.getElementById('unlock');
  if(languageConfirmed){
   try{await afterUnlock({enter:true});password.value='';}
   catch(error){notice('Выбранный языковой каталог недоступен: '+error.message);}
   return;
  }
  if(!password.value){notice('Введите локальный пароль.');return;}
  try{
   const vault=localStorage.getItem('medcontrol_modular3_protected_state_v1');
   const credential=localStorage.getItem('medcontrol_modular3_local_credential_v1');
   if(vault===null&&credential===null){notice('На этом адресе защищённое хранилище не найдено. Для существующих записей требуется перенос защищённой копии.');return;}
   if(vault!==null&&credential===null){notice('Создание защищённого хранилища не завершено. Нажмите «Восстановить доступ» с прежним паролем.');return;}
   if(vault===null){notice('Защищённая копия данных на этом адресе не найдена. Ничего не изменено.');return;}
   button.disabled=true;
   if(await session.unlock(password.value)){
    password.value='';
    try{await afterUnlock({enter:true});}catch(error){await session.lock();notice('Ошибка входа: '+error.message);}
   }else notice('Неверный пароль.');
  }catch(error){notice('Ошибка входа: '+error.message);}
  finally{button.disabled=false;}
 };
 document.getElementById('enroll').onclick=async()=>{
  if(!confirmPassword.value){confirmPasswordLabel.hidden=false;notice('Повторите новый пароль.');return;}
  if(password.value!==confirmPassword.value){notice('Пароли не совпадают.');return;}
  const button=document.getElementById('enroll');button.disabled=true;
  try{
   await session.initialize({settings:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},medications:[],intakeLogs:[]},password.value);
   password.value='';confirmPassword.value='';beginLanguageStep();
  }catch(error){notice('Не удалось создать хранилище: '+error.message);}
  finally{button.disabled=false;}
 };
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{if(!session.isEntryAuthorized())return;section=button.dataset.tab;render();});
 document.getElementById('lock').onclick=async()=>{await session.lock();languagePending=false;languageConfirmed=false;notice('Данные заблокированы.');render();};
 render();
 window.medcontrolEntryText=text=>displayLocaleUnavailable&&!preparedEntry?'MedControl':textFor(preparedEntry,text)||(preparedEntry?textFor(preparedEntry,'Ошибка')||'MedControl':text);
 window.medcontrolProtectedLocaleReady=(async()=>{
  const code=policy.readDisplayLanguage(),pending=policy.displayPending();
  const neutral=()=>{
   displayLocaleUnavailable=true;currentLanguage=code||'ru';
   document.documentElement.lang=code||'und';document.documentElement.dir=policy.registry.find(item=>item.code===code)?.direction||'auto';
   for(const [node,original]of entryOriginals)if(node.isConnected&&/[А-Яа-яЁё]/.test(original))node.textContent='MedControl';
   message.textContent='MedControl';
  };
  try{
   if(code){
    const prepared=await policy.prepareDisplay(code);preparedEntry=prepared;currentLanguage=code;paintEntry(prepared);
    if(message.textContent)notice(message.textContent);
   }else if(pending)neutral();
  }catch(error){
   neutral();window.medcontrolEntryDisplayLocaleError=String(error?.message||error);
  }finally{document.documentElement.removeAttribute('data-entry-locale-pending');}
 })();
 window.medcontrolProtectedWorkspaceReady=true;
})();
