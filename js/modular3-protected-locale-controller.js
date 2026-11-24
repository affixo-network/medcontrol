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
html[data-medcontrol-protected-locale] .wrap th,
html[data-medcontrol-protected-locale] .wrap td{text-align:start}
html[data-medcontrol-protected-locale] .wrap .right{text-align:end}
html[data-medcontrol-protected-locale] .wrap ul{margin-inline-start:18px;margin-inline-end:0;padding-inline-start:22px;padding-inline-end:0}
html[data-medcontrol-protected-locale] .wrap .weekday-choice input{margin-inline-start:0;margin-inline-end:6px}
html[data-medcontrol-protected-locale] .wrap .mono,
html[data-medcontrol-protected-locale] .wrap input[dir="ltr"]{direction:ltr;unicode-bidi:isolate}
html[data-medcontrol-protected-locale] .wrap [dir="auto"]{unicode-bidi:isolate}
`;
   style.textContent+='\nhtml[data-medcontrol-protected-locale] .number-pickers{direction:ltr}';
   document.head.append(style);
  }
  // Preserve user text's natural script independently of the interface direction.
  // Dates, numeric values, structured time fields and identifiers stay readable.
  for(const field of document.querySelectorAll('.wrap input,.wrap textarea,.wrap td')){
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
 const api={create,install,applyLayout};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.MedControlProtectedLocaleController=api;
})(typeof window!=='undefined'?window:globalThis);
