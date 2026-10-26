(async function(){
  const currentScript=document.currentScript;
  const page=currentScript?.dataset?.page||'';
  const SUPABASE_URL='https://lewdbjjaohqxbirzhrbm.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ';
  const SUPABASE_STORAGE_KEY='sb-lewdbjjaohqxbirzhrbm-auth-token';
  const protectedModules=['js/modular3-encrypted-vault.js','js/modular3-offline-credential.js','js/modular3-protected-session.js','js/modular3-write-boundary.js','js/modular3-course-lifecycle-browser.js','js/modular3-protected-pages.js','js/modular3-final-intake.js'];
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
  async function ensureSelectedPublicLocale(){
    // Optional only: the built-in RU/EN UI remains available without network.
    if(!window.medcontrolProtectedInterface || typeof getState!=='function')return false;
    const language=getState()?.settings?.interfaceLanguage;
    if(!language || language==='ru' || language==='en' || TRANSLATIONS[language])return false;
    try{
      await loadScript('js/modular3-locale-bootstrap.js');
      return await window.MedControlLocaleBootstrap.install({
        language, fallback:TRANSLATIONS.en, fetcher:window.fetch.bind(window),
        loadScript, register:registerPreparedLanguage
      });
    }catch(_){return false;}
  }
  function populateProtectedLanguageSelector(){
    // Modular-3 enhancement only: never modify the immutable Modular-2 renderer.
    if(!window.medcontrolProtectedInterface || typeof SUPPORTED_LANGUAGES==='undefined')return;
    const selector=document.querySelector('.topbar select[onchange*="changeInterfaceLanguage"]');
    if(!selector)return;
    const selected=getState()?.settings?.interfaceLanguage;
    const known=new Set(Array.from(selector.options,option=>option.value));
    for(const [code,label] of SUPPORTED_LANGUAGES){
      if(!known.has(code)){
        selector.add(new Option(label,code));
        known.add(code);
      }
    }
    if(selected&&known.has(selected))selector.value=selected;
  }
  async function renderPage(targetPage){
    if(targetPage==='archive'){
      if(window.medcontrolProtectedInterface&&window.reconcileMedControlCompletedCourses)await window.reconcileMedControlCompletedCourses(getState());
      if(typeof window.renderArchivePage!=='function')throw new Error('renderArchivePage() не загружен');
      window.renderArchivePage();
      if(typeof fixPreviewNavigation==='function')fixPreviewNavigation();
      if(window.patchMedControlResetUi)window.patchMedControlResetUi();
      populateProtectedLanguageSelector();
      window.MedControlActionHelp?.render();
      return;
    }
    if(typeof mount!=='function')throw new Error('mount() не загружен');
    (await mount(targetPage));
    populateProtectedLanguageSelector();
    window.MedControlActionHelp?.render();
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
    if(options.history!==false){
      if(window.location.pathname!==target)window.history.pushState({medcontrolPage:targetPage},'',target);
    }
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
      // Do not prefetch all 94 catalogs or access medical records for caching.
      const selectedLanguage=window.medcontrolProtectedInterface&&typeof getState==='function'
        ? getState()?.settings?.interfaceLanguage : null;
      const localeAssets=selectedLanguage&&selectedLanguage!=='ru'&&selectedLanguage!=='en'&&
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
      if(!window.MedControlModular3ProtectedSession.isUnlocked())await unlockLocalWorkspace();
      window.medcontrolProtectedInterface=true;
      document.head.querySelectorAll('style').forEach(style=>{style.textContent=style.textContent.replaceAll('VERSION 2 · modular-2.000','VERSION 3 · modular-3.000');});
      // Load the complete Input wrappers first so completion/archive rules are shared.
      await loader.ensureScripts(scriptsByPage.input);
      await ensurePageScripts(page);
      await renderPage(page);
      window.medcontrolOfflineShellReady=await registerStaticOfflineCache();
      return;
    }
    const verified=await createVerifiedSupabase();
    if(!attachVerifiedSupabase(verified))return;
    await restoreCloudBeforeOpeningPage();
    await startPage(list);
    registerStaticOfflineCache();
    prefetchOtherPageScripts(page);
  }catch(error){console.error('MedControl Auth Guard failed.',error);showStartupError('Не удалось запустить MedControl. Локальные данные не удалялись.\n\n'+(error&&error.message?error.message:error));}
})();