(async function(){
  const currentScript=document.currentScript;
  const page=currentScript?.dataset?.page||'';
  const SUPABASE_URL='https://lewdbjjaohqxbirzhrbm.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ';
  const SUPABASE_STORAGE_KEY='sb-lewdbjjaohqxbirzhrbm-auth-token';
  const protectedModules=['js/modular3-entry-languages.js','js/modular3-encrypted-vault.js','js/modular3-offline-credential.js','js/modular3-protected-session.js','js/modular3-write-boundary.js','js/modular3-course-lifecycle-browser.js','js/modular3-protected-pages.js','js/modular3-final-intake.js'];
  const common=['js/translations.js','js/storage.js?v=force-majeure-20260918-2','js/cloud-snapshot.js?v=force-majeure-20260918-2'];
  const reset='js/archive-reset-policy.js?v=manual-reset-recovery-1';
  const loadedScriptPaths=new Set(Array.from(document.scripts||[]).filter(script=>script.src&&script!==currentScript).map(script=>new URL(script.src,window.location.href).pathname));
  const prefetchedScriptPaths=new Set();
  const scriptsByPage={
    input:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js?v=force-majeure-20260918-3','js/temporal-change-hotfix.js','js/medication-edit-noop-guard.js','js/schedule-change-scope.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/intake-history-slot-scope.js','js/history.js?v=archive-time-events-only-5','js/render.js?v=428014d','js/clock.js','core.js','js/settings.js?v=force-majeure-20260918-2','js/navigation.js?v=force-majeure-20260918-2','js/medication-sequence-controller.js','js/intake-cancellation-policy.js','js/input-qa-fixes.js?v=cd10202b-course-completion','js/edit-times-reliability.js','js/a1-integrity-fix.js','js/completed-archive-history-fallback.js','js/scope-history-repair.js','js/today-scope-resolver.js','js/input-temporal-scope-display.js','js/unified-history-ui.js?v=58cd006','js/time-status-controller.js?v=bf2bfd3','js/edit-dialog-compat.js?v=c75a1d3','js/input-architecture-fix.js?v=c0a1361','js/archive-course-history.js?v=input-completed-course-history-1','js/input-time-history-fix.js?v=e949059','js/input-time-editor-v2.js?v=adf40cb',reset,'js/input-time-editor-v3-fix.js?v=hour-minute-select-1','js/input-time-history-scope-fix.js?v=scope-column-1','js/input-draft-recovery.js?v=draft-recovery-1'],
    action:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/history.js','js/render.js','js/next-intake-slot.js','js/medcontrol-status-engine.js','js/clock.js','core.js','js/settings.js','js/navigation.js?v=force-majeure-20260918-2','js/intake-cancellation-policy.js','js/correction-guard-engine.js','js/correction-reset-dashboard-history.js','js/correction-cancel-taken-policy.js','js/intake-history-title.js','js/correction-window-eod.js','js/intake-unit-display.js','js/intake-history-slot-scope.js?v=1f94159','js/a1-integrity-fix.js','js/time-status-controller.js?v=b5186b0','js/daily-timeline-final.js?v=0b2ad73','js/archive-course-history.js?v=action-intake-history-1','js/action-intake-history-summary.js?v=1','js/action-history-direct-bind.js?v=f1e12c9',reset],
    dashboard:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/history.js','js/render.js','js/clock.js','core.js','js/settings.js','js/navigation.js?v=force-majeure-20260918-2','js/medcontrol-status-engine.js','js/correction-guard-engine.js','js/correction-reset-dashboard-history.js','js/correction-cancel-taken-policy.js','js/dashboard-target-compat.js','js/intake-history-title.js','js/intake-unit-display.js','js/intake-history-slot-scope.js?v=09df5b0','js/a1-integrity-fix.js','js/time-status-controller.js?v=b5186b0','js/daily-timeline-final.js?v=0b2ad73','js/action-history-direct-bind.js',reset],
    archive:[...common,'js/utils.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/history.js?v=archive-unified-history-2','js/render.js','js/clock.js','js/navigation.js?v=archive-preview-nav-2','js/intake-history-slot-scope.js','js/time-status-controller.js?v=archive-course-history-1','js/archive-page.js?v=archive-time-order-6','js/archive-course-history.js?v=archive-course-history-1',reset]
  };
  function showStartupError(message){const app=document.getElementById('app');if(app)app.innerHTML='<div style="font-family:Arial,sans-serif;padding:24px;white-space:pre-wrap"><h1>Ошибка запуска MedControl</h1><p>'+String(message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</p></div>';}
  function goToLogin(reason){const next=window.location.pathname;const q=new URLSearchParams({next});if(reason)q.set('reason',reason);window.location.replace('/auth-login.html?'+q.toString());}
  function pageScripts(){
    const list=scriptsByPage[page];
    if(!list)throw new Error('Неизвестная страница Auth Guard: '+page);
    return list;
  }
  function scriptKey(src){return new URL(src,window.location.href).pathname;}
  function preloadPageScripts(list){
    list.forEach(src=>{
      const link=document.createElement('link');
      link.rel='preload';
      link.as='script';
      link.href=src;
      document.head.appendChild(link);
    });
  }
  function prefetchOtherPageScripts(activePage){
    Object.entries(scriptsByPage).forEach(([name,list])=>{
      if(name===activePage)return;
      list.forEach(src=>{
        const key=scriptKey(src);
        if(loadedScriptPaths.has(key)||prefetchedScriptPaths.has(key))return;
        prefetchedScriptPaths.add(key);
        const link=document.createElement('link');
        link.rel='prefetch';
        link.as='script';
        link.href=src;
        document.head.appendChild(link);
      });
    });
  }
  function loadScript(src){
    const key=scriptKey(src);
    if(loadedScriptPaths.has(key))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.async=false;
      s.onload=async()=>{try{await window.medcontrolScriptReady;window.medcontrolScriptReady=null;loadedScriptPaths.add(key);prefetchedScriptPaths.delete(key);resolve();}catch(error){reject(error);}};
      s.onerror=()=>reject(new Error('Не удалось загрузить '+src));
      document.head.appendChild(s);
    });
  }
  let modular3Loader=null;
  async function ensureModular3Loader(){
    if(modular3Loader)return modular3Loader;
    await loadScript('js/modular3-script-loader.js');
    if(!window.MedControlScriptLoader?.createLoader)throw new Error('MedControl script loader unavailable');
    modular3Loader=window.MedControlScriptLoader.createLoader({load:loadScript});
    return modular3Loader;
  }
  async function ensurePageScripts(targetPage){
    const list=scriptsByPage[targetPage];
    if(!list)throw new Error('Неизвестная страница MedControl: '+targetPage);
    const loader=await ensureModular3Loader();
    await loader.ensureScripts(protectedModules);
    await loader.ensureScripts(list);
    await ensureSelectedPublicLocale();
    if(window.medcontrolProtectedInterface){
      await loadScript('js/modular3-action-help.js');
      window.MedControlModular3FinalIntake?.install();
    }
  }
  async function stagePublicLocale(language){
    if(!window.MedControlEntryLanguages.registry.some(entry=>entry.code===language))throw Error('Unsupported interface language');
    if(language==='ru')return true;
    if(TRANSLATIONS[language]&&window.MedControlProtectedUiCatalogs?.[language]&&
       (language!=='en'||window.MedControlProtectedRuntimeLabels?.en))return true;
    await loadScript('js/modular3-locale-bootstrap.js');
    const installed=await window.MedControlLocaleBootstrap.install({
      language,fallback:TRANSLATIONS.en,fetcher:window.fetch.bind(window),
      loadScript,register:prepared=>{
        if(language==='en'){
          window.MedControlProtectedRuntimeLabels=Object.freeze({
            ...window.MedControlProtectedRuntimeLabels,en:prepared.labels
          });
          return true;
        }
        return TRANSLATIONS[language]?true:registerPreparedLanguage(prepared);
      }
    });
    if(installed===false||!TRANSLATIONS[language]||!window.MedControlProtectedUiCatalogs?.[language])
      throw Error('Selected language catalog activation failed: '+language);
    return true;
  }
  window.medcontrolPrepareProtectedLocale=stagePublicLocale;
  let validatedActiveLanguage=null;
  async function ensureSelectedPublicLocale(){
    if(!window.medcontrolProtectedInterface||typeof getState!=='function')return false;
    const session=window.MedControlModular3ProtectedSession;
    const settings=session.read()?.settings;
    if(!window.MedControlEntryLanguages.confirmed(settings))throw Error('Unconfirmed entry language');
    if(validatedActiveLanguage===settings.interfaceLanguage)return true;
    validatedActiveLanguage=null;
    await window.MedControlEntryLanguages.restore(session,{stage:prepared=>stagePublicLocale(prepared.code)});
    validatedActiveLanguage=settings.interfaceLanguage;
    return true;
  }
  function applyProtectedLocaleDirection(language){
    const entry=window.MedControlEntryLanguages.registry.find(item=>item.code===language);
    if(!entry)throw Error('Unsupported interface language');
    document.documentElement.lang=language;
    document.documentElement.dir=entry.direction;
  }
  async function closeProtectedLocaleFailure(error,options={}){
    const session=window.MedControlModular3ProtectedSession;
    const expected=options.expectedEntryEpoch??error?.expectedEntryEpoch;
    const stale=expected!==undefined&&session.entryEpoch?.()!==expected;
    if(stale&&session.isEntryAuthorized?.()===true)return;
    validatedActiveLanguage=null;
    window.medcontrolProtectedLocaleRefreshError=String(error?.message||error);
    const app=document.getElementById('app');
    if(app)app.textContent=window.medcontrolProtectedLocaleFailureLabel||'MedControl';
    if(!stale)await session.lock();
  }
  async function installProtectedLocaleController(){
    await loadScript('js/modular3-protected-locale-controller.js');
    window.MedControlProtectedLocaleController.install({
      session:window.MedControlModular3ProtectedSession,
      policy:window.MedControlEntryLanguages,stage:stagePublicLocale,
      render:async()=>{
        const current=window.location.pathname.split('/').pop().replace(/\.html$/,'');
        const result=await window.medcontrolNavigateTo(['input','action','dashboard','archive'].includes(current)?current:'input',{history:false});
        await refreshStaticOfflineCache();
        return result;
      },
      failClosed:closeProtectedLocaleFailure
    });
  }
  function populateProtectedLanguageSelector(){
    // Modular-3 enhancement only: never modify the immutable Modular-2 renderer.
    if(!window.medcontrolProtectedInterface || typeof SUPPORTED_LANGUAGES==='undefined')return;
    const selector=document.querySelector('.topbar select[onchange*="changeInterfaceLanguage"]');
    if(!selector)return;
    const selected=getState()?.settings?.interfaceLanguage;
    const known=new Set(Array.from(selector.options,option=>option.value));
    for(const {code,name:label} of window.MedControlEntryLanguages.registry){
      if(!known.has(code)){
        selector.add(new Option(label,code));
        known.add(code);
      }
    }
    if(selected&&known.has(selected))selector.value=selected;
  }
  // Modular-3 presentation adapter for literal legacy labels. Never changes
  // the immutable Modular-2 renderer, saved state, or user-entered records.
  const protectedEnglishLabels = Object.freeze({
    'Архив':'Archive','Выйти':'Sign out',
    'Цикл завершён':'Cycle completed',
    'Все курсы применения препаратов завершены или отменены. Данные сохранены и доступны в Архиве.':
      'All medication courses are completed or cancelled. Records are preserved in Archive.',
    'Сначала проверьте Архив. После проверки можно начать новый цикл.':
      'Review Archive before starting a new cycle.',
    'Сначала проверьте Архив.':'First check the Archive.',
    'После проверки можно начать новый цикл.':'After reviewing it, you can start a new cycle.',
    'Начать заново':'Start new cycle',
    'Производитель':'Manufacturer','Название производителя':'Manufacturer name',
    'Данные производителя':'Manufacturer information',
    'Количественное содержание':'Medication content (as stated by manufacturer)',
    'Единица содержания':'Content unit',
    'Другая единица содержания':'Other content unit',
    'Доза':'Dose','Количество приёма':'Quantity per intake',
    'Единица приёма':'Intake unit','Другая единица приёма':'Other intake unit',
    'Выберите':'Select',
    'Другое':'Other','таблетка':'tablet','капсула':'capsule',
    'капля':'drop','чайная ложка':'teaspoon','столовая ложка':'tablespoon',
    'доза':'dose','впрыск':'puff','ампула':'ampoule','флакон':'vial',
    'пакет':'packet','саше':'sachet','суппозиторий':'suppository',
    'пластырь':'patch','инъекция':'injection','единица':'unit',
    'мкг':'mcg','мг':'mg','г':'g','кг':'kg','мл':'ml','л':'l',
    'мг/мл':'mg/ml','мкг/мл':'mcg/ml','мг/г':'mg/g','МЕ':'IU','ед.':'units',
    'Препараты':'Medications','Параметры расписания':'Schedule parameters',
    'Удалённые и заменённые времена':'Removed and replaced times',
    'Нет удалённых или заменённых времён.':'No removed or replaced times.',
    'Управление данными':'Data management',
    'Все препараты отменены. При необходимости можно полностью очистить данные MedControl и начать заново.':
      'All medications are cancelled. If necessary, MedControl data may be reset to start again.',
    'Полный сброс доступен только когда все препараты отменены.':
      'Full reset is available only after all medications are cancelled.',
    'Сделать пассивным':'Set passive','Активировать':'Activate','Отменить':'Cancel',
    'История приёмов':'Intake history','Принято':'Taken','Не принято':'Not taken',
    'Период':'Period','Вчера':'Yesterday','7 дней':'7 days',
    '30 дней':'30 days','Весь период':'Entire period','Свернуть':'Collapse',
    'Изменение временного назначения':'Change of scheduled time',
    'Сохранить':'Save','Закрыть':'Close',
    'Ежедневно':'Every day','Нет данных':'No data',
    'Например: 500':'Example: 500','Например: 1':'Example: 1'
  });
  const protectedOriginalText=new WeakMap();
  const protectedOriginalPlaceholders=new WeakMap();
  const protectedOriginalAriaLabels=new WeakMap();
  const protectedOriginalTitles=new WeakMap();
  function localizeProtectedLegacyUi(){
    if(!window.medcontrolProtectedInterface||!window.MedControlModular3ProtectedSession?.isEntryAuthorized())return;
    const protectedState=getState();
    const language=protectedState?.settings?.interfaceLanguage;
    if(!language)throw Error('Confirmed interface language missing');
    applyProtectedLocaleDirection(language);
    window.MedControlProtectedLocaleController?.applyLayout(document);
    // Use the selected public catalog for the same legacy keys in every section.
    // Only UI labels are eligible: never rewrite patient text or medical table cells.
    const labels=Object.create(null);
    const selectedLabels=window.MedControlProtectedRuntimeLabels?.[language]||TRANSLATIONS[language];
    if(typeof TRANSLATIONS!=='undefined'&&TRANSLATIONS.ru&&TRANSLATIONS[language]){
      for(const [key,russian] of Object.entries(TRANSLATIONS.ru)){
        const translated=selectedLabels[key];
        if(typeof russian==='string'&&typeof translated==='string'&&russian!==translated)
          labels[russian]=translated;
      }
    }
    // Full public catalog covers static UI copy beyond the legacy key subset.
    // Apply only to the explicitly selected UI nodes below, never patient data.
    const catalogLabels=window.MedControlProtectedUiCatalogs?.[language];
    if(catalogLabels){
      // A catalog entry identical to Russian is not evidence of localization.
      // Do not let it erase a distinct translation already resolved by key.
      for(const [russian,translated] of Object.entries(catalogLabels)){
        // An unchanged Russian string must not mask a missing translation or
        // block a later, explicitly translated fallback.
        if(translated!==russian)labels[russian]=translated;
      }
    }
    if(language==='en'){
      // Catalog-backed labels take precedence over the older English-only map.
      for(const [russian,english] of Object.entries(protectedEnglishLabels)){
        if(!Object.prototype.hasOwnProperty.call(labels,russian))labels[russian]=english;
      }
    }
    // Translate authored UI nodes only; ordinary medical cells and form values are excluded.
    const nodes=new Set(document.querySelectorAll(
      '.topbar a,.topbar button,.topbar .meta .pill,.wrap h1,.wrap h2,.wrap h3,.wrap h4,'+
      '.wrap label,.wrap legend,.wrap caption,.wrap button,.wrap th,.wrap option,.wrap summary,'+
      '.wrap .muted,.wrap .help p,.wrap .help li,.wrap .card > p,'+
      '.wrap .card > ul > li,.wrap .card > ol > li,'+
      '.wrap .card > div > p,.wrap .card > section > p,'+
      '.wrap fieldset > p,.wrap fieldset > div > p,'+
      '.wrap #medControlCycleReady strong,.wrap td > .status,'+
      '.wrap td[data-dashboard-timing],.wrap td[data-dashboard-timing] > strong,'+
      '.wrap .card > table > tbody > tr:only-child > td[colspan]:only-child'
    ));
    // These are renderer-owned presentation cells, identified by the bound
    // medication. Names, details, numeric values and custom units stay excluded.
    const controlledCells=new Set();
    const contentUnits=new Set(['mcg','mg','g','kg','ml','l','%','mg/ml','mcg/ml','mg/g','IU','unit']);
    const intakeUnits=new Set(['tablet','capsule','ml','drop','teaspoon','tablespoon','dose','puff','ampoule','vial','packet','sachet','suppository','patch','injection','unit']);
    for(const button of document.querySelectorAll('.wrap td button[onclick]')){
      const match=/^(?:openEditMedication|toggleMedicationMode|showRowHistory|repeatCompletedCourse|archiveCompletedCourse)\('([^']+)'\)$/.exec(button.getAttribute('onclick')||'');
      const med=match&&(protectedState.medications||[]).find(item=>item.id===match[1]);
      const row=button.closest('tr');
      // The renderer may split intake times into additional columns.
      if(!med||!row||row.cells.length<15||row.cells[1].textContent!==med.name)continue;
      const add=index=>{controlledCells.add(row.cells[index]);nodes.add(row.cells[index]);};
      if(contentUnits.has(med.contentUnit))add(4);
      if(intakeUnits.has(med.intakeUnit))add(6);
      if((med.scheduleType||'daily')==='daily')add(9);
    }
    // Diagnostic counts for static UI text only; no patient values or storage.
    let inspected=0,translatedCount=0,unmappedRussian=0;
    const recordCoverage=(original,translation)=>{
      if(typeof original!=='string'||!/[А-Яа-яЁё]/.test(original))return;
      inspected++;
      if(typeof translation==='string'&&translation!==original)translatedCount++;
      else if(language!=='ru')unmappedRussian++;
    };
    for(const element of nodes){
      if(element.closest('#medcontrolFirstLanguageDialog'))continue;
      for(const child of element.childNodes){
        if(child.nodeType!==Node.TEXT_NODE)continue;
        const previous=protectedOriginalText.get(child);
        const original=previous&&previous.localized===child.nodeValue?previous.original:child.nodeValue;
        const value=original.trim();
        // A sole spanning cell is eligible only for the authored empty-row
        // placeholder. Never translate label-like names in ordinary data cells.
        if(element.tagName==='TD'&&!controlledCells.has(element)&&
          !element.hasAttribute('data-dashboard-timing')&&(element.childElementCount!==0||
          !['Нет записей','Нет записей.'].includes(value)))continue;
        const required=value.endsWith('*');
        const lookup=required?value.slice(0,-1).trim():value;
        let translation=labels[lookup];
        // Countdown output has a strict numeric shape. Preserve every digit;
        // substitute only the already published UI template's unit labels.
        if(element.hasAttribute('data-dashboard-timing')){
          const duration=/^(\d+) дн\. (\d+) ч\. (\d+) мин\. (\d+) сек\.$/.exec(value);
          const template=labels['⟦0⟧ дн. ⟦1⟧ ч. ⟦2⟧ мин. ⟦3⟧ сек.'];
          if(duration&&template)translation=template.replace(/⟦([0-3])⟧/g,(_,index)=>duration[Number(index)+1]);
        }
        recordCoverage(lookup,translation);
        const updated=translation?original.replace(value,translation+(required?' *':'')):original;
        if(updated!==child.nodeValue)child.nodeValue=updated;
        if(updated!==original)protectedOriginalText.set(child,{original,localized:updated});
        else protectedOriginalText.delete(child);
      }
    }
    for(const input of document.querySelectorAll('.wrap input[placeholder],.wrap textarea[placeholder]')){
      const previous=protectedOriginalPlaceholders.get(input);
      const original=previous&&previous.localized===input.placeholder?previous.original:input.placeholder;
      recordCoverage(original,labels[original]);
      const updated=labels[original]||original;
      if(updated!==input.placeholder)input.placeholder=updated;
      if(updated!==original)protectedOriginalPlaceholders.set(input,{original,localized:updated});
      else protectedOriginalPlaceholders.delete(input);
    }
    // Accessible control names must switch languages too, without touching
    // medication values or other user-entered text.
    for(const element of document.querySelectorAll('.topbar [aria-label],.wrap [aria-label]')){
      if(element.closest('#medcontrolFirstLanguageDialog'))continue;
      const previous=protectedOriginalAriaLabels.get(element);
      const current=element.getAttribute('aria-label');
      const original=previous&&previous.localized===current?previous.original:current;
      recordCoverage(original,labels[original]);
      const updated=labels[original]||original;
      if(updated!==current)element.setAttribute('aria-label',updated);
      if(updated!==original)protectedOriginalAriaLabels.set(element,{original,localized:updated});
      else protectedOriginalAriaLabels.delete(element);
    }
    // Native title tooltips are UI copy as well; preserve their Russian source
    // across language switches, without modifying entered medication data.
    for(const element of document.querySelectorAll('.topbar [title],.wrap [title]')){
      if(element.closest('#medcontrolFirstLanguageDialog'))continue;
      const current=element.getAttribute('title');
      const previous=protectedOriginalTitles.get(element);
      const original=previous&&previous.localized===current?previous.original:current;
      recordCoverage(original,labels[original]);
      const updated=labels[original]||original;
      if(updated!==current)element.setAttribute('title',updated);
      if(updated!==original)protectedOriginalTitles.set(element,{original,localized:updated});
      else protectedOriginalTitles.delete(element);
    }
    // Observable, privacy-safe coverage for the currently rendered section.
    // This is not a claim that the entire 639-message catalog is semantically correct.
    const coveragePage=window.location.pathname.split('/').pop().replace(/\.html$/,'');
    const coverageSnapshot=Object.freeze({
      language, page:coveragePage, inspected, translated:translatedCount, unmappedRussian,
      // The snapshot is a partial UI audit, not proof of full catalog coverage.
      catalogInstalled:language==='ru' ||
        Boolean(window.MedControlProtectedUiCatalogs?.[language]),
      // A single rendered section cannot certify all four sections.
      // This flag only describes the current observed section.
      sectionHasNoUnmappedRussian:language!=='ru' && inspected>0 &&
        unmappedRussian===0 && (language==='en' ||
        Boolean(window.MedControlProtectedUiCatalogs?.[language])),
      complete:false
    });
    window.medcontrolProtectedLocaleCoverage=coverageSnapshot;
    // Preserve only aggregate counts by language and section. No text, patient
    // values, medical records or persistent storage enter this diagnostic.
    if(['input','action','dashboard','archive'].includes(coveragePage)){
      const prior=window.medcontrolProtectedLocaleCoverageByPage||{};
      const languagePages=prior[language]||{};
      window.medcontrolProtectedLocaleCoverageByPage=Object.freeze({
        ...prior,
        [language]:Object.freeze({...languagePages,[coveragePage]:coverageSnapshot})
      });
    }
    document.documentElement.lang=language;
    // Keep the browser title in the selected language after protected renders.
    const currentPage=window.location.pathname.split('/').pop().replace(/\.html$/,'');
    const titleKey={input:'title_input',action:'title_action',dashboard:'title_dashboard',archive:'title_archive'}[currentPage];
    const localizedTitle=titleKey&&typeof TRANSLATIONS!=='undefined'&&selectedLabels?.[titleKey];
    // Archive has no title_archive key in the legacy translation schema.
    // Its visible navigation label is the translated fallback for every language.
    const archiveLabel=currentPage==='archive'&&typeof TRANSLATIONS!=='undefined'
      ? selectedLabels?.nav_archive : null;
    const completeArchiveTitle=currentPage==='archive'?catalogLabels?.['MedControl — Архив']:null;
    const resolvedTitle=typeof completeArchiveTitle==='string'&&completeArchiveTitle.trim()?completeArchiveTitle
      : typeof localizedTitle==='string'&&localizedTitle.trim()
      ? localizedTitle
      : typeof archiveLabel==='string'&&archiveLabel.trim()
        ? 'MedControl — '+archiveLabel
        : currentPage==='archive'
          ? 'MedControl — '+(labels['Архив']||'Архив') : '';
    if(resolvedTitle&&document.title!==resolvedTitle)document.title=resolvedTitle;
  }
  function watchProtectedLegacyUi(){
    if(window.medcontrolProtectedLegacyUiObserver)return;
    let scheduled=false;
    const observeOptions={
      subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:['placeholder','aria-label','title']
    };
    const observer=new MutationObserver(()=>{
      if(scheduled)return;
      scheduled=true;
      queueMicrotask(async()=>{
        observer.disconnect();
        try{
          // Language can change after initial boot. Install the newly selected
          // 639-key catalog before translating the newly rendered section.
          // This changes presentation assets only, never encrypted records.
          await ensureSelectedPublicLocale();
          localizeProtectedLegacyUi();
        }catch(error){
          console.error('Protected locale refresh failed',error);
          await closeProtectedLocaleFailure(error);
        }finally{
          observer.observe(document.documentElement,observeOptions);
          scheduled=false;
        }
      });
    });
    // Translation itself changes text and attributes. Disconnect during our
    // own writes to prevent observer feedback and repeated full-page scans.
    observer.observe(document.documentElement,observeOptions);
    window.medcontrolProtectedLegacyUiObserver=observer;
    // Initial localization also mutates the observed DOM. Discard those
    // records so startup does not schedule a redundant full-page pass.
    observer.disconnect();
    try{
      localizeProtectedLegacyUi();
    }finally{
      observer.observe(document.documentElement,observeOptions);
    }
  }
  async function renderPage(targetPage){
    if(targetPage==='archive'){
      if(window.medcontrolProtectedInterface&&window.reconcileMedControlCompletedCourses)await window.reconcileMedControlCompletedCourses(getState());
      if(typeof window.renderArchivePage!=='function')throw new Error('renderArchivePage() не загружен');
      window.renderArchivePage();
      if(typeof fixPreviewNavigation==='function')fixPreviewNavigation();
      if(window.patchMedControlResetUi)window.patchMedControlResetUi();
      populateProtectedLanguageSelector();
      localizeProtectedLegacyUi();
      if(window.medcontrolProtectedInterface&&getState()?.settings?.interfaceLanguage==='en')document.title='MedControl — Archive';
      window.MedControlActionHelp?.render();
      return;
    }
    if(typeof mount!=='function')throw new Error('mount() не загружен');
    (await mount(targetPage));
    populateProtectedLanguageSelector();
    localizeProtectedLegacyUi();
    window.MedControlActionHelp?.render();
  }
  function offerFirstRunLanguage() {
    if (!window.medcontrolProtectedInterface || typeof getState !== 'function' ||
        typeof MEDCONTROL_CANONICAL_LANGUAGES === 'undefined') return;
    const state = getState();
    // Legacy vaults may contain languageChoiceConfirmed=true without proof of an
    // explicit choice. Require the versioned confirmation marker once; never
    // rewrite encrypted records merely to display the prompt.
    if (state?.settings?.languageChoiceConfirmed && state?.settings?.languageConfirmationVersion === 1) return;
    if (document.getElementById('medcontrolFirstLanguageDialog')) return;
    // Detect the browser's ordered language preferences independently of the
    // rehearsal-only protected workspace. Do not infer a confirmed choice from
    // the language inherited from an existing vault.
    const supported = MEDCONTROL_CANONICAL_LANGUAGES.filter(item => item.id <= 96);
    const preferences = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages : [navigator.language];
    const entry = preferences.map(raw => String(raw || '').toLowerCase().split('-')[0])
      .map(code => supported.find(item => item.code === code)).find(Boolean)
      || supported.find(item => item.code === 'en');
    // The language-confirmation dialog must not mix Russian and English.
    // Before a choice is confirmed, use the browser's Russian UI or English UI.
    const promptRu = entry?.code === 'ru';
    const promptText = (ru, en) => promptRu ? ru : en;
    const dialog = document.createElement('section');
    dialog.id = 'medcontrolFirstLanguageDialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', promptText('Подтвердите язык', 'Confirm language'));
    dialog.style.cssText = 'position:fixed;inset:5vh 5vw auto;max-width:620px;max-height:85vh;overflow:auto;margin:auto;z-index:2147483646;padding:24px;background:white;color:#111;border:2px solid #555;border-radius:14px;box-shadow:0 0 0 100vmax rgba(0,0,0,.55);font:16px Arial,sans-serif';
    const title = document.createElement('h2');
    title.textContent = promptText('Подтвердите язык', 'Confirm language');
    dialog.appendChild(title);
    const proposed = document.createElement('p');
    proposed.textContent = promptText('Язык устройства: ', 'Device language: ') + (entry?.name || 'English');
    dialog.appendChild(proposed);
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = promptText('Поиск языка', 'Search language');
    search.setAttribute('aria-label', promptText('Поиск языка', 'Search language'));
    search.style.cssText = 'box-sizing:border-box;width:100%;padding:10px;margin:8px 0';
    dialog.appendChild(search);
    const results = document.createElement('div');
    results.style.cssText = 'max-height:40vh;overflow:auto';
    dialog.appendChild(results);
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    dialog.appendChild(message);
    const draw = () => {
      const query = normalizeMedControlLanguageQuery(search.value);
      results.replaceChildren();
      const matches = MEDCONTROL_CANONICAL_LANGUAGES.filter(item => item.id <= 96 &&
        (!query || medControlLanguageSearchAliases(item).some(alias => alias.includes(query))));
      for (const item of matches) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '№' + item.id + ' · ' + item.name;
        button.style.cssText = 'display:block;margin:4px 0;padding:8px;max-width:100%;cursor:pointer';
        button.onclick = async () => {
          message.textContent = promptText('Сохранение…', 'Saving…');
          try {
            const ok = await window.changeInterfaceLanguage(item.code);
            if (!ok) message.textContent = promptText('Не удалось сохранить язык', 'Could not save language');
          } catch (_) { message.textContent = promptText('Не удалось сохранить язык', 'Could not save language'); }
        };
        results.appendChild(button);
      }
      if (!matches.length) results.textContent = promptText('Язык не найден', 'No matching language');
    };
    search.oninput = draw;
    draw();
    const suggested = results.querySelector('button');
    if (entry && suggested) {
      search.value = entry.name;
      draw();
    }
    document.body.appendChild(dialog);
    search.focus();
  }
  function currentDeploymentId(){
    return document.querySelector('script[data-deployment-id]')?.dataset?.deploymentId||'';
  }
  async function latestDeploymentId(targetPage){
    try{
      const response=await fetch('/'+targetPage+'.html?deployment_check='+Date.now(),{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)return '';
      const html=await response.text();
      return html.match(/data-deployment-id=["']([^"']+)["']/)?.[1]||'';
    }catch(_){return '';}
  }
  window.medcontrolNavigateTo=async function(targetPage,options={}){
    if(!scriptsByPage[targetPage])return false;
    if(window.medcontrolProtectedInterface&&!window.MedControlModular3ProtectedSession?.isEntryAuthorized())return false;
    // Input uses layered render wrappers; a fresh page guarantees they initialize in order.
    if(!window.medcontrolProtectedInterface && targetPage==='input' && window.location.pathname!=='/input.html'){
      window.location.assign('/input.html');
      return true;
    }
    if(window.medcontrolProtectedInterface){
      try{await window.medControlInputDraft?.flush();}
      catch(error){window.alert('Не удалось сохранить черновик. Форма остаётся открытой. '+error.message);return false;}
    }
    const target='/'+targetPage+'.html';
    const activeDeployment=currentDeploymentId();
    const latestDeployment=window.medcontrolProtectedInterface?'':await latestDeploymentId(targetPage);
    if(activeDeployment&&latestDeployment&&activeDeployment!==latestDeployment){
      window.location.assign(target);
      return true;
    }
    window.medcontrolShellNavigationLoading=true;
    try{await ensurePageScripts(targetPage);}finally{window.medcontrolShellNavigationLoading=false;}
    (await renderPage(targetPage));
    if(window.medcontrolProtectedInterface&&getState()?.settings?.interfaceLanguage==='en'&&targetPage==='archive')document.title='MedControl — Archive';
    if(options.history!==false){
      if(window.location.pathname!==target)window.history.pushState({medcontrolPage:targetPage},'',target);
    }
    // Navigation changes the URL after rendering. Apply the selected locale
    // once more against the destination route, including its browser title.
    if(window.medcontrolProtectedInterface)localizeProtectedLegacyUi();
    prefetchOtherPageScripts(targetPage);
    return true;
  };
  async function startPage(list){
    const loader=await ensureModular3Loader();
    await loader.ensureScripts(list);
    await ensureSelectedPublicLocale();
    if(page==='archive'){
      if(typeof fixPreviewNavigation==='function')fixPreviewNavigation();
      if(window.patchMedControlResetUi)window.patchMedControlResetUi();
      return;
    }
    if(typeof mount!=='function')throw new Error('mount() не загружен');
    (await mount(page));
  }
  async function registerStaticOfflineCache(){
    if(typeof navigator==='undefined'||!('serviceWorker' in navigator)||!window.isSecureContext)return false;
    try{
      const registration=await navigator.serviceWorker.register('/modular3-static-cache-sw.js',{scope:'/'});
      // Wait for installation and activation before requesting a complete offline shell.
      const ready=await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline worker activation timed out')),15000))
      ]);
      const worker=ready.active;
      if(!worker)return false;
      // Cache the active public language and its loader modules for an offline restart.
      // Cache only the selected catalog, never medical records or all catalogs.
      const selectedLanguage=window.medcontrolProtectedInterface&&typeof getState==='function'
        ? getState()?.settings?.interfaceLanguage : null;
      const localeAssets=selectedLanguage&&selectedLanguage!=='ru'&&
        typeof SUPPORTED_LANGUAGES!=='undefined'&&SUPPORTED_LANGUAGES.some(([code])=>code===selectedLanguage)
        ? ['/locales/source-ru.json','/locales/catalogs/'+selectedLanguage+'.json',
           '/js/modular3-locale-bootstrap.js','/js/modular3-public-catalog-loader.js',
           '/js/modular3-legacy-locale-adapter.js','/js/modular3-locale-preparation.js',
           '/js/modular3-locale-activation.js'] : [];
      const paths=[...new Set(['/core.js','/js/modular3-action-help.js',...Object.values(scriptsByPage).flat().map(src=>'/'+src.split('?')[0]),...protectedModules.map(src=>'/'+src),...localeAssets])];
      const channel=new MessageChannel();
      return await new Promise(resolve=>{
        const timer=setTimeout(()=>resolve(false),30000);
        channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data?.ok===true);};
        worker.postMessage({type:'MEDCONTROL_CACHE_SHELL',paths},[channel.port2]);
      });
    }catch(error){console.warn('Static offline cache unavailable.',error);return false;}
  }
  let offlineRefreshGeneration=0;
  async function refreshStaticOfflineCache(){
    const ticket=++offlineRefreshGeneration;
    const session=window.MedControlModular3ProtectedSession;
    if(!window.medcontrolProtectedInterface||!session?.isEntryAuthorized())return false;
    const code=session.read().settings.interfaceLanguage;
    window.medcontrolOfflineShellReady=false;
    const ready=await registerStaticOfflineCache();
    const current=ticket===offlineRefreshGeneration&&session.isEntryAuthorized()&&session.read().settings.interfaceLanguage===code;
    if(current)window.medcontrolOfflineShellReady=ready;
    return current&&ready;
  }
  window.medcontrolRefreshOfflineShell=refreshStaticOfflineCache;
  window.addEventListener?.('online',()=>{if(window.medcontrolProtectedInterface)refreshStaticOfflineCache().catch(()=>{});});
  async function unlockLocalWorkspace(){
    document.getElementById('app').innerHTML='<form id="localLogin" style="max-width:420px;margin:60px auto;font-family:Arial"><h1>MedControl</h1><label for="password">Локальный пароль</label><input id="password" type="password" autocomplete="current-password" required><button id="unlock" type="submit">Войти</button><p id="loginMessage" role="status"></p><a href="/modular3-protected.html">Восстановить доступ</a></form>';
    await new Promise(resolve=>{
      const form=document.getElementById('localLogin');
      form.onsubmit=async event=>{
        event.preventDefault();
        const button=document.getElementById('unlock');button.disabled=true;
        const field=document.getElementById('password');
        try{
          const ok=await window.MedControlModular3ProtectedSession.unlock(field.value);
          field.value='';
          if(ok){form.remove();resolve();return;}
          document.getElementById('loginMessage').textContent='Неверный пароль.';
        }catch(error){document.getElementById('loginMessage').textContent='Не удалось открыть хранилище: '+error.message;}
        finally{button.disabled=false;}
      };
    });
  }
  function readStoredSession(){
    try{
      const raw=localStorage.getItem(SUPABASE_STORAGE_KEY);
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      return parsed?.currentSession||parsed?.session||parsed;
    }catch(_){return null;}
  }
  function isStoredSessionFresh(session){
    if(!session?.access_token||!session?.refresh_token||!session?.user?.id)return false;
    if(!session.expires_at)return true;
    return Number(session.expires_at)*1000>Date.now()+60000;
  }
  async function createVerifiedSupabase(){
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
    if(sessionError)throw sessionError;
    if(!sessionData?.session)return {supabase,session:null};
    return {supabase,session:sessionData.session};
  }
  function attachVerifiedSupabase(result){
    if(!result?.session){goToLogin('no_session');return false;}
    window.medcontrolSupabase=result.supabase;
    window.medcontrolSupabaseUser=result.session.user;
    return true;
  }
  async function restoreCloudBeforeOpeningPage(){
    // Load storage and snapshot helpers without mounting a medical page.
    const loader=await ensureModular3Loader();
    await loader.ensureScripts(common);
    const cloud=window.medcontrolCloudSnapshot;
    if(!cloud)throw new Error('Cloud recovery module unavailable.');
    const key='affixo_medcontrol_standard_v3';
    let raw=localStorage.getItem(key);
    if(raw){
      let local;
      try{local=JSON.parse(raw);}catch(_){throw new Error('Local state is unreadable. Cloud recovery stopped to preserve it.');}
      if(!cloud.validState(local))throw new Error('Local state is invalid. Cloud recovery stopped to preserve it.');
      if(cloud.meaningfulState(local))return;
    }
    const latest=await cloud.latest();
    if(!latest.ok)throw new Error('Cloud recovery read failed: '+latest.reason);
    if(!latest.snapshot)return;
    if(!cloud.meaningfulState(latest.snapshot.state))
      throw new Error('Latest cloud snapshot is empty. Recovery stopped without overwriting local data.');
    const restored=await cloud.restoreLatest({overwriteExisting:!!raw});
    if(!restored.ok)throw new Error('Cloud recovery failed: '+restored.reason);
  }
  try{
    const list=pageScripts();
    preloadPageScripts(list);
    if(localStorage.getItem('medcontrol_modular3_local_credential_v1')!==null ||
       localStorage.getItem('medcontrol_modular3_protected_state_v1')!==null){
      const loader=await ensureModular3Loader();
      if(window.MedControlModular3ProtectedSession?.isUnlocked()&&window.MedControlModular3ProtectedPages)protectedModules.forEach(src=>loadedScriptPaths.add(scriptKey(src)));
      await loader.ensureScripts(protectedModules);
      // A direct medical-page visit must use the canonical password -> language -> Enter flow.
      // Redirect before unlocking: navigating after unlock would discard the in-memory key
      // and force a second password prompt. No encrypted state is modified here.
      if(!window.MedControlModular3ProtectedSession.isEntryAuthorized()){
        window.location.replace('/modular3-protected.html');
        return;
      }
      const entrySettings=window.MedControlModular3ProtectedSession.read()?.settings||{};
      if(!window.MedControlEntryLanguages.confirmed(entrySettings)){
        window.location.replace('/modular3-protected.html');
        return;
      }
      window.medcontrolProtectedInterface=true;
      document.head.querySelectorAll('style').forEach(style=>{style.textContent=style.textContent.replaceAll('VERSION 2 · modular-2.000','VERSION 3 · modular-3.000');});
      // Load the complete Input wrappers first so completion/archive rules are shared.
      await loader.ensureScripts(scriptsByPage.input);
      await installProtectedLocaleController();
      await ensurePageScripts(page);
      await renderPage(page);
      watchProtectedLegacyUi();
      // Canonical entry has already confirmed the saved language.
      await refreshStaticOfflineCache();
      return;
    }
    // No Modular-3 fallback to a different authorization system.
    window.location.replace('/modular3-protected.html');
    return;
  }catch(error){
    console.error('MedControl Auth Guard failed.',error);
    if(window.medcontrolProtectedInterface){
      const source='Не удалось запустить MedControl. Локальные данные не удалялись.';
      let language;
      try{language=window.MedControlModular3ProtectedSession.read()?.settings?.interfaceLanguage;}catch(_){}
      window.medcontrolProtectedLocaleFailureLabel=language==='ru'?source:
        window.MedControlProtectedUiCatalogs?.[language]?.[source]||'MedControl';
      await closeProtectedLocaleFailure(error);
      return;
    }
    showStartupError('Не удалось запустить MedControl. Локальные данные не удалялись.\n\n'+(error&&error.message?error.message:error));
  }
})();
