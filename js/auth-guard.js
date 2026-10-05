(async function(){
  const currentScript=document.currentScript;
  const page=currentScript?.dataset?.page||'';
  const SUPABASE_URL='https://lewdbjjaohqxbirzhrbm.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ';
  const SUPABASE_STORAGE_KEY='sb-lewdbjjaohqxbirzhrbm-auth-token';
  const common=['js/translations.js','js/storage.js?v=force-majeure-20260918-2','js/cloud-snapshot.js?v=force-majeure-20260918-2'];
  const reset='js/archive-reset-policy.js?v=manual-reset-recovery-1';
  const loadedScriptPaths=new Set();
  const scriptsByPage={
    input:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js?v=force-majeure-20260918-3','js/temporal-change-hotfix.js','js/medication-edit-noop-guard.js','js/schedule-change-scope.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/intake-history-slot-scope.js','js/history.js?v=archive-time-events-only-5','js/render.js?v=428014d','js/clock.js','core.js','js/settings.js?v=force-majeure-20260918-2','js/navigation.js?v=force-majeure-20260918-2','js/medication-sequence-controller.js','js/intake-cancellation-policy.js','js/input-qa-fixes.js','js/edit-times-reliability.js','js/a1-integrity-fix.js','js/completed-archive-history-fallback.js','js/scope-history-repair.js','js/today-scope-resolver.js','js/input-temporal-scope-display.js','js/unified-history-ui.js?v=58cd006','js/time-status-controller.js?v=bf2bfd3','js/edit-dialog-compat.js?v=c75a1d3','js/input-architecture-fix.js?v=c0a1361','js/input-time-history-fix.js?v=e949059','js/input-time-editor-v2.js?v=adf40cb',reset,'js/input-time-editor-v3-fix.js?v=hour-minute-select-1','js/input-time-history-scope-fix.js?v=scope-column-1','js/input-draft-recovery.js?v=draft-recovery-1'],
    action:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js?v=force-majeure-20260918-3','js/history.js','js/render.js','js/next-intake-slot.js','js/medcontrol-status-engine.js','js/clock.js','core.js','js/settings.js','js/navigation.js?v=force-majeure-20260918-2','js/intake-cancellation-policy.js','js/correction-guard-engine.js','js/correction-reset-dashboard-history.js','js/correction-cancel-taken-policy.js','js/intake-history-title.js','js/correction-window-eod.js','js/intake-unit-display.js','js/intake-history-slot-scope.js?v=1f94159','js/a1-integrity-fix.js','js/time-status-controller.js?v=b5186b0','js/daily-timeline-final.js?v=0b2ad73','js/action-history-direct-bind.js?v=f1e12c9',reset],
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
    const seen=new Set();
    Object.entries(scriptsByPage).forEach(([name,list])=>{
      if(name===activePage)return;
      list.forEach(src=>{
        const key=scriptKey(src);
        if(loadedScriptPaths.has(key)||seen.has(key))return;
        seen.add(key);
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
      s.onload=()=>{loadedScriptPaths.add(key);resolve();};
      s.onerror=()=>reject(new Error('Не удалось загрузить '+src));
      document.head.appendChild(s);
    });
  }
  async function ensurePageScripts(targetPage){
    const list=scriptsByPage[targetPage];
    if(!list)throw new Error('Неизвестная страница MedControl: '+targetPage);
    for(const src of list)await loadScript(src);
  }
  function renderPage(targetPage){
    if(targetPage==='archive'){
      if(typeof window.renderArchivePage!=='function')throw new Error('renderArchivePage() не загружен');
      window.renderArchivePage();
      if(typeof fixPreviewNavigation==='function')fixPreviewNavigation();
      if(window.patchMedControlResetUi)window.patchMedControlResetUi();
      return;
    }
    if(typeof mount!=='function')throw new Error('mount() не загружен');
    mount(targetPage);
  }
  window.medcontrolNavigateTo=async function(targetPage,options={}){
    if(!scriptsByPage[targetPage])return false;
    window.medcontrolShellNavigationLoading=true;
    try{await ensurePageScripts(targetPage);}finally{window.medcontrolShellNavigationLoading=false;}
    renderPage(targetPage);
    if(options.history!==false){
      const target='/'+targetPage+'.html';
      if(window.location.pathname!==target)window.history.pushState({medcontrolPage:targetPage},'',target);
    }
    prefetchOtherPageScripts(targetPage);
    return true;
  };
  async function startPage(list){
    for(const src of list)await loadScript(src);
    if(page==='archive'){
      if(typeof fixPreviewNavigation==='function')fixPreviewNavigation();
      if(window.patchMedControlResetUi)window.patchMedControlResetUi();
      return;
    }
    if(typeof mount!=='function')throw new Error('mount() не загружен');
    mount(page);
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
    if(window.medcontrolCloudSnapshot?.queue)window.medcontrolCloudSnapshot.queue();
    return true;
  }
  try{
    const list=pageScripts();
    preloadPageScripts(list);
    const storedSession=readStoredSession();
    if(isStoredSessionFresh(storedSession)){
      window.medcontrolSupabaseUser=storedSession.user;
      const verification=createVerifiedSupabase()
        .then(result=>attachVerifiedSupabase(result))
        .catch(error=>{console.error('MedControl background auth verification failed.',error);goToLogin('session_check_failed');});
      await startPage(list);
      prefetchOtherPageScripts(page);
      void verification;
      return;
    }
    const verified=await createVerifiedSupabase();
    if(!attachVerifiedSupabase(verified))return;
    await startPage(list);
    prefetchOtherPageScripts(page);
  }catch(error){console.error('MedControl Auth Guard failed.',error);showStartupError('Не удалось запустить MedControl. Локальные данные не удалялись.\n\n'+(error&&error.message?error.message:error));}
})();