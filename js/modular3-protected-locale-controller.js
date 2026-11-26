/* Modular-3 only. Canonical locale changes never mutate legacy Settings state. */
(function(root){
 'use strict';
 const SELECTORS='.topbar select[onchange*="changeInterfaceLanguage"],#settingsInterfaceLanguage';
 function applyLayout(document){
  if(!document?.head||!document.documentElement)return;
  document.documentElement.setAttribute?.('data-medcontrol-protected-locale','');
  const styleId='medcontrol-protected-logical-layout';
  if(!document.getElementById(styleId)){
   const style=document.createElement('style');style.id=styleId;
   style.textContent=`
html[data-medcontrol-protected-locale] :is(.wrap,dialog) th,
html[data-medcontrol-protected-locale] :is(.wrap,dialog) td{text-align:start}
html[data-medcontrol-protected-locale] :is(.wrap,dialog) .right{text-align:end}
html[data-medcontrol-protected-locale] :is(.wrap,dialog) ul{margin-inline-start:18px;margin-inline-end:0;padding-inline-start:22px;padding-inline-end:0}
html[data-medcontrol-protected-locale] :is(.wrap,dialog) .weekday-choice input{margin-inline-start:0;margin-inline-end:6px}
html[data-medcontrol-protected-locale] :is(.wrap,dialog) .mono,
html[data-medcontrol-protected-locale] :is(.wrap,dialog) input[dir="ltr"]{direction:ltr;unicode-bidi:isolate}
html[data-medcontrol-protected-locale] :is(.wrap,dialog) [dir="auto"]{unicode-bidi:isolate}
`;
   style.textContent+='\nhtml[data-medcontrol-protected-locale] .number-pickers{direction:ltr}';
   document.head.append(style);
  }
  // Preserve user text's natural script independently of the interface direction.
  // Dates, numeric values, structured time fields and identifiers stay readable.
  for(const field of document.querySelectorAll(':is(.wrap,dialog) input,:is(.wrap,dialog) textarea,:is(.wrap,dialog) td')){
   const type=String(field.type||'').toLowerCase();
   if(['password','hidden','button','submit','checkbox','radio','file'].includes(type))continue;
   const identifier=String(field.id||'')+' '+String(field.name||'');
   const structured=['date','time','datetime-local','month','week','number','email','url','tel'].includes(type)||
    /(?:time|date|hour|minute|identifier|uuid)/i.test(identifier);
   field.setAttribute('dir',structured?'ltr':'auto');
  }
 }
 function create(options){
  const {session,policy,stage,render,failClosed,notify,document}=options;
  let queue=Promise.resolve();
  function restoreSelector(){
   const code=session.read().settings.interfaceLanguage;
   for(const selector of document.querySelectorAll(SELECTORS))selector.value=code;
  }
  function change(raw){
   const code=policy.resolve(raw);
   const expectedEntryEpoch=session.entryEpoch?.();
   const task=queue.then(async()=>{
    if(expectedEntryEpoch!==undefined&&session.entryEpoch()!==expectedEntryEpoch)return false;
    if(!session.isEntryAuthorized())return false;
    const controls=[...document.querySelectorAll(SELECTORS)];
    controls.forEach(control=>{control.disabled=true;});
    let committed=false;
    try{
     if(!code)throw Error('Unsupported interface language');
     // confirm captures/serializes the code, validates and caches the full catalog,
     // then stages the legacy translation APIs before the encrypted transaction.
     await policy.confirm(session,code,{stage:prepared=>stage(prepared.code)});
     committed=true;
     if(await render()===false)throw Error('Protected locale render failed');
     restoreSelector();
     return true;
    }catch(error){
     if(expectedEntryEpoch!==undefined&&session.entryEpoch()!==expectedEntryEpoch&&session.isEntryAuthorized())return false;
     try{restoreSelector();}catch(_){/* A locked session cannot expose settings. */}
     notify(committed?'render':'save',error);
     if(committed||!session.isUnlocked()||!session.isEntryAuthorized()||error?.code==='protected_session_changed')
      await failClosed(error,{expectedEntryEpoch});
     return false;
    }finally{controls.forEach(control=>{control.disabled=false;});}
   });
   queue=task.catch(()=>{});
   return task;
  }
  return Object.freeze({change,restoreSelector});
 }
 function install(options){
  if(!root.medcontrolProtectedInterface)throw Error('Protected locale overlay requires protected mode');
  const document=root.document,policy=options.policy,session=options.session;
  function text(source){
   const code=session.read().settings.interfaceLanguage;
   if(code==='ru')return source;
   const translated=root.MedControlProtectedUiCatalogs?.[code]?.[source];
   if(typeof translated!=='string'||!translated.trim())throw Error('Missing protected locale message');
   return translated;
  }
  function notify(kind,error){
   root.medcontrolProtectedLocaleChangeError=String(error?.message||error);
   let label='MedControl';
   try{label=text(kind==='render'?'Не удалось запустить MedControl. Локальные данные не удалялись.':'Не удалось сохранить изменение.');}catch(_){}
   let status=document.getElementById('medcontrol-locale-status');
   if(!status){status=document.createElement('p');status.id='medcontrol-locale-status';status.setAttribute('role','alert');(document.querySelector('.topbar')||document.body).append(status);}
   status.textContent=label;
   root.medcontrolProtectedLocaleFailureLabel=label;
  }
  applyLayout(document);
  const controller=create({...options,document,notify});
  root.changeInterfaceLanguage=controller.change;
  // The immutable legacy English table predates the published639-message catalog.
  // Use staged keyed labels in protected rendering without changing either built-in.
  if(!root.medcontrolOriginalProtectedTr&&typeof root.tr==='function'){
   root.medcontrolOriginalProtectedTr=root.tr;
   root.tr=function(key){
    const code=session.read().settings.interfaceLanguage;
    const staged=root.MedControlProtectedRuntimeLabels?.[code];
    if(code==='en'&&staged&&Object.prototype.hasOwnProperty.call(staged,key))return staged[key];
    return root.medcontrolOriginalProtectedTr(key);
   };
  }
  // Native validation alerts do not enter the DOM observer. Translate only
  // the recognized Hint channel; arbitrary alert/patient text stays literal.
  if(!root.medcontrolOriginalProtectedAlert&&typeof root.alert==='function'){
   const nativeAlert=root.alert;
   root.medcontrolOriginalProtectedAlert=nativeAlert;
   root.alert=function(message){
    if(!session.isEntryAuthorized?.())return nativeAlert.apply(root,arguments);
    const code=session.read().settings.interfaceLanguage;
    if(code==='ru'||typeof message!=='string')return nativeAlert.apply(root,arguments);
    const catalog=root.MedControlProtectedUiCatalogs?.[code];
    const title=root.tr('hint_title'),prefix=title+'\n\n',russianPrefix='Подсказка\n\n';
    const body=message.startsWith(prefix)?message.slice(prefix.length)
     :message.startsWith(russianPrefix)?message.slice(russianPrefix.length):null;
    if(body===null)return nativeAlert.apply(root,arguments);
    if(typeof catalog?.[body]==='string')return nativeAlert.call(root,prefix+catalog[body]);
    // The two date-boundary hints use catalog templates. Keep their date
    // values and localize only the renderer-owned date-list conjunction.
    for(const [source,translated] of Object.entries(catalog||{})){
     if(!source.startsWith(russianPrefix)||!source.includes('⟦0⟧'))continue;
     const slots=[];
     const pattern=source.split(/(⟦\d+⟧)/g).map(part=>{
      if(/^⟦\d+⟧$/.test(part)){slots.push(part);return '([\\s\\S]*?)';}
      return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
     }).join('');
     const match=new RegExp('^'+pattern+'$').exec(russianPrefix+body);
     if(!match)continue;
     const output=translated.replace(/⟦\d+⟧/g,slot=>{
      const value=match[slots.indexOf(slot)+1];
      return source.startsWith(russianPrefix+'Выбранная дата окончания')&&catalog['или']
       ?value.split(' или ').join(' '+catalog['или']+' '):value;
     });
     return nativeAlert.call(root,output);
    }
    return nativeAlert.apply(root,arguments);
   };
  }
  // Settings is inherited by the protected shell but uses the canonical registry.
  // Its device-language field must never trigger another proposal after entry.
  root.medControlDeviceLanguage=()=>session.read().settings.interfaceLanguage;
  function search(query=''){
   const target=document.getElementById('settingsLanguageMatches');if(!target)return;
   const current=session.read().settings.interfaceLanguage;
   const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
   const needle=normalize(query);
   target.replaceChildren();
   for(const entry of policy.registry){
    const aliases=[entry.name,entry.englishName,entry.code,String(entry.id)];
    if(typeof root.medControlLanguageSearchAliases==='function')aliases.push(...root.medControlLanguageSearchAliases(entry));
    if(needle&&!aliases.some(alias=>normalize(alias).includes(needle)))continue;
    const button=document.createElement('button');button.type='button';
    button.setAttribute('role','option');button.setAttribute('aria-selected',String(entry.code===current));
    button.textContent='№'+entry.id+' · '+entry.name+(entry.code===current?' ✓':'');
    button.onclick=()=>controller.change(entry.code);target.append(button);
   }
   const input=document.getElementById('settingsLanguageSearch');
   if(input){const label=text('Язык интерфейса');input.placeholder=label;input.setAttribute('aria-label',label);}
   const suggestion=document.getElementById('settingsLanguageSuggestion');
   if(suggestion)suggestion.textContent='';
  }
  root.renderMedControlLanguageSearch=search;
  root.filterMedControlLanguages=search;
  root.MedControlProtectedLocaleController.active=controller;
  return controller;
 }
 function formatMessage(value,catalog,translateSlots=false){
  if(!catalog||typeof value!=='string')return null;
  if(typeof catalog[value]==='string')return catalog[value];
  if(!/[А-Яа-яЁё]/.test(value))return null;
  for(const [source,translated] of Object.entries(catalog)){
   if(!/⟦\d+⟧/.test(source)||!/[А-Яа-яЁё]/.test(source.replace(/⟦\d+⟧/g,'')))continue;
   const slots=[],pattern=source.split(/(⟦\d+⟧)/g).map(part=>{
    if(/^⟦\d+⟧$/.test(part)){slots.push(part);return '([\\s\\S]*?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   }).join('');
   const match=new RegExp('^'+pattern+'$').exec(value);
   if(match)return translated.replace(/⟦\d+⟧/g,slot=>{
    const captured=match[slots.indexOf(slot)+1];
    return translateSlots&&typeof catalog[captured]==='string'?catalog[captured]:captured;
   });
  }
  return null;
 }
 const boundHistoryFunctions=new WeakSet();
 function bindHistoryOwners(){
  if(!root.medcontrolProtectedInterface)return;
  for(const [name,selector,kind] of [
   ['showRowHistory','#rowHistoryDialog','general'],
   ['showInputTimeHistory','#rowHistoryDialog','time'],
   ['showIntakeHistory','#intakeHistoryDialog','intake'],
   ['showArchiveMedicationHistory','#archiveHistoryDialog,#rowHistoryDialog','archive']
  ]){
   const inherited=root[name];
   if(typeof inherited!=='function'||boundHistoryFunctions.has(inherited))continue;
   const wrapped=function(id,...args){
    const result=inherited.call(this,id,...args);
    const dialog=selector.split(',').map(item=>root.document.querySelector(item)).find(Boolean);
    if(dialog){dialog.dataset.medcontrolHistoryOwner=String(id);dialog.dataset.medcontrolHistoryKind=kind;}
    return result;
   };
   boundHistoryFunctions.add(wrapped);root[name]=wrapped;
  }
 }
 // Read-only projections of owned history dialogs. Medical snapshots, custom
 // unit strings, manufacturer and patient details never enter generic lookup.
 const historyTableCache=new WeakMap();
 function historyPresentation({state,labels,readOriginal,contentUnits,intakeUnits}){
  const nodes=new Set(),projections=[];
  const metadata=new Set(['Расписание','Параметры расписания','Статус','Статус / итог','Режим','Результат','Состояние']);
  const actionLabel=entry=>entry.action==='course_completed'?'Курс завершён'
   :entry.action==='course_completion_reversed'?'Завершение курса отменено':root.rowHistoryActionLabel(entry.action);
  const knownActions=new Set(['created','edited','cancelled','activated','deactivated','active','passive','course_completed','course_completion_reversed']);
  const headerName=header=>{
   const value=readOriginal(header).trim();
   const names=[...metadata,'Событие','Единица содержания','Единица приёма'];
   return names.find(key=>key===value)||names.find(key=>labels[key]===value)||value;
  };
  const project=(cell,original,localized)=>{
   if(cell&&!cell.childElementCount&&readOriginal(cell)===original)projections.push({cell,original,localized});
  };
  const unit=(cell,source,field,composite)=>{
   const content=field==='content',code=source[content?'contentUnit':'intakeUnit'];
   const other=source[content?'contentUnitOther':'intakeUnitOther']||'';
   const known=content?contentUnits:intakeUnits;
   const label=(content?root.medicationContentUnitLabel:root.medicationIntakeUnitLabel)(code,other);
   const localized=known.has(code)?labels[label]||label:label;
   const value=source[content?'contentValue':'intakeQuantity']||'';
   const combine=part=>composite?[value,part].filter(Boolean).join(' ')||'—':String(part);
   project(cell,combine(label),combine(localized));
  };
  for(const dialog of root.document.querySelectorAll('dialog[data-medcontrol-history-owner]')){
   const med=state.medications?.find(item=>item.id===dialog.dataset.medcontrolHistoryOwner);
   if(!med)continue;
   const kind=dialog.dataset.medcontrolHistoryKind;
   const entries=(med.rowHistory||[]).filter(entry=>entry?.at).slice().sort((a,b)=>new Date(a.at)-new Date(b.at));
   const created=entries.find(entry=>entry.action==='created');
   let current={...(created?.snapshot||entries.find(entry=>entry.snapshot)?.snapshot||{})};
   const snapshots=new Map();
   for(const entry of entries){
    if(entry.action==='created'){snapshots.set(entry,{...current});continue;}
    if(['edited','activated','deactivated','active','passive'].includes(entry.action))current={...current,...entry.changes};
    snapshots.set(entry,{...current});
   }
   for(const table of dialog.querySelectorAll('table')){
    if(table.tHead?.rows.length!==1||!table.tBodies[0])continue;
    const headers=[...table.tHead.rows[0].cells].map(headerName);
    const cells=[...table.rows].flatMap(row=>[...row.cells]);
    const corrections=(state.intakeCorrections||[]).filter(item=>item.medicationId===med.id);
    const version=JSON.stringify([state.settings.interfaceLanguage,dialog.dataset.medcontrolHistoryKind,med.id,med.contentUnit,med.contentUnitOther,med.intakeUnit,med.intakeUnitOther,entries,corrections,headers]);
    const cached=historyTableCache.get(table);
    if(cached?.version===version&&cells.length===cached.cells.length&&cells.every((cell,index)=>cell===cached.cells[index])){
     cached.nodes.forEach(node=>nodes.add(node));projections.push(...cached.projections);continue;
    }
    const beforeNodes=new Set(nodes),projectionStart=projections.length,dateLabels=new Map();
    const dateTime=iso=>{
     if(!dateLabels.has(iso))dateLabels.set(iso,root.formatDateTime(iso));
     return dateLabels.get(iso);
    };
    const buckets=new Map(),positions=new Map();
    for(const entry of entries){
     let event;
     if(kind==='archive')event=actionLabel(entry);
     else if(entry===created)event='Создано';
     // Input renders each edit with field-specific event text. Match its
     // chronological rows by action, preserving same-minute edit order.
     else if(kind==='general'&&entry.action==='edited')event='Изменено';
     else if(kind==='general'&&entry.action==='cancelled')event='Отменено';
     else continue;
     const key=dateTime(entry.at)+'\0'+event;
     if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(entry);
    }
    const correctionsByPlanned=new Map();
    for(const correction of corrections){
     const key=dateTime(correction.plannedAt);
     if(!correctionsByPlanned.has(key))correctionsByPlanned.set(key,[]);
     correctionsByPlanned.get(key).push(correction);
    }
    for(const row of table.tBodies[0].rows){
     if(row.cells.length!==headers.length)continue;
     for(let i=0;i<headers.length;i++)if(metadata.has(headers[i])){
      nodes.add(row.cells[i]);row.cells[i].querySelectorAll('strong,span,small').forEach(node=>nodes.add(node));
     }
     const archive=kind==='archive'&&headers.length===13;
     const planned=archive?readOriginal(row.cells[9]):'';
     const event=readOriginal(row.cells[1]).trim();
     if(planned){
      nodes.add(row.cells[1]);
      const relevant=(correctionsByPlanned.get(planned)||[]).slice().sort((a,b)=>new Date(a.correctedAt||0)-new Date(b.correctedAt||0));
      const last=relevant[relevant.length-1];
      if(last?.correctedAt){
       const reason=last.reason==='accident'?'Случайное нажатие':last.reason==='error'?'Ошибка':'—';
       const when=dateTime(last.correctedAt);
       project(row.cells[8],when+' — '+reason,when+' — '+(labels[reason]||reason));
      }
      continue;
     }
     const when=readOriginal(row.cells[0]);
     if(!archive&&headers[1]==='Событие')nodes.add(row.cells[1]);
     const bucketEvent=kind==='general'&&!['Создано','Отменено'].includes(event)?'Изменено':event;
     const key=when+'\0'+bucketEvent,index=positions.get(key)||0,entry=buckets.get(key)?.[index];
     if(!entry)continue;
     positions.set(key,index+1);
     if(knownActions.has(entry.action))nodes.add(row.cells[1]);
     if(archive){
      if(entry.action==='course_completed')continue;
      const source=entry.action==='created'?(entry.snapshot||entry.changes||med):{...med,...entry.changes};
      unit(row.cells[3],source,'content',true);unit(row.cells[4],source,'intake',true);
     }else{
      const source=snapshots.get(entry)||{};
      const content=headers.indexOf('Единица содержания'),intake=headers.indexOf('Единица приёма');
      if(content>=0)unit(row.cells[content],source,'content',false);
      if(intake>=0)unit(row.cells[intake],source,'intake',false);
     }
    }
    historyTableCache.set(table,{version,cells,nodes:[...nodes].filter(node=>!beforeNodes.has(node)),projections:projections.slice(projectionStart)});
   }
  }
  return {nodes,projections};
 }
 const api={create,install,applyLayout,formatMessage,bindHistoryOwners,historyPresentation};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.MedControlProtectedLocaleController=api;
})(typeof window!=='undefined'?window:globalThis);
