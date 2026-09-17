(async function(){
  const currentScript=document.currentScript;
  const page=currentScript?.dataset?.page||'';
  const SUPABASE_URL='https://lewdbjjaohqxbirzhrbm.supabase.co';
  const SUPABASE_ANON_KEY='sb_publishable_AKV7EBBgChuoMpGJlwxwig_OYo4bzKZ';

  const common=['js/translations.js','js/storage.js?v=v2-empty-start-2','js/cloud-snapshot.js?v=cloud-snapshot-1'];
  const scriptsByPage={
    input:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/temporal-change-hotfix.js','js/medication-edit-noop-guard.js','js/schedule-change-scope.js','js/schedule.js','js/intake.js','js/intake-history-slot-scope.js','js/history.js?v=scoped-time-history-1','js/render.js?v=428014d','js/clock.js','core.js','js/settings.js','js/navigation.js','js/medication-sequence-controller.js','js/intake-cancellation-policy.js','js/input-qa-fixes.js','js/edit-times-reliability.js','js/a1-integrity-fix.js','js/completed-archive-history-fallback.js','js/scope-history-repair.js','js/today-scope-resolver.js','js/input-temporal-scope-display.js','js/unified-history-ui.js?v=58cd006','js/time-status-controller.js?v=bf2bfd3','js/edit-dialog-compat.js?v=c75a1d3','js/input-architecture-fix.js?v=c0a1361','js/input-time-history-fix.js?v=e949059','js/input-time-editor-v2.js?v=adf40cb','js/archive-reset-policy.js?v=v2-reset-backup-1','js/input-time-editor-v3-fix.js?v=hour-minute-select-1','js/input-time-history-scope-fix.js?v=scope-column-1','js/input-draft-recovery.js?v=draft-recovery-1'],
    action:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js','js/history.js','js/render.js','js/next-intake-slot.js','js/medcontrol-status-engine.js','js/clock.js','core.js','js/settings.js','js/navigation.js','js/intake-cancellation-policy.js','js/correction-guard-engine.js','js/correction-reset-dashboard-history.js','js/correction-cancel-taken-policy.js','js/intake-history-title.js','js/correction-window-eod.js','js/intake-unit-display.js','js/intake-history-slot-scope.js?v=1f94159','js/a1-integrity-fix.js','js/time-status-controller.js?v=b5186b0','js/daily-timeline-final.js?v=0b2ad73','js/action-history-direct-bind.js?v=f1e12c9','js/archive-reset-policy.js?v=v2-reset-backup-1'],
    dashboard:[...common,'js/utils.js','js/temporal-change-guard.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js','js/history.js','js/render.js','js/clock.js','core.js','js/settings.js','js/navigation.js','js/medcontrol-status-engine.js','js/correction-guard-engine.js','js/correction-reset-dashboard-history.js','js/correction-cancel-taken-policy.js','js/dashboard-target-compat.js','js/intake-history-title.js','js/intake-unit-display.js','js/intake-history-slot-scope.js?v=09df5b0','js/a1-integrity-fix.js','js/time-status-controller.js?v=b5186b0','js/daily-timeline-final.js?v=0b2ad73','js/action-history-direct-bind.js','js/archive-reset-policy.js?v=v2-reset-backup-1'],
    archive:[...common,'js/utils.js','js/language.js','js/medications.js','js/schedule.js','js/intake.js','js/history.js?v=history-deleted-time-1','js/render.js','js/clock.js','js/navigation.js?v=archive-preview-nav-2','js/intake-history-slot-scope.js','js/time-status-controller.js?v=archive-course-history-1','js/archive-page.js?v=archive-deleted-time-history-3','js/archive-course-history.js?v=archive-course-history-1','js/archive-reset-policy.js?v=v2-reset-backup-1']
  };

  function showStartupError(message){
    const app=document.getElementById('app');
    if(app) app.innerHTML='<div style="font-family:Arial,sans-serif;padding:24px;white-space:pre-wrap"><h1>Ошибка запуска MedControl</h1><p>'+String(message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</p></div>';
  }
  function goToLogin(reason){
    const next=window.location.pathname;
    const q=new URLSearchParams({next});
    if(reason) q.set('reason',reason);
    window.location.replace('/auth-login.html?'+q.toString());
  }
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script'); s.src=src; s.async=false; s.onload=resolve;
      s.onerror=()=>reject(new Error('Не удалось загрузить '+src)); document.head.appendChild(s);
    });
  }
  async function startPage(){
    const list=scriptsByPage[page];
    if(!list) throw new Error('Неизвестная страница Auth Guard: '+page);
    for(const src of list) await loadScript(src);
    if(page==='archive'){
      if(typeof fixPreviewNavigation==='function') fixPreviewNavigation();
      if(window.patchMedControlResetUi) window.patchMedControlResetUi();
      return;
    }
    if(typeof mount!=='function') throw new Error('mount() не загружен');
    mount(page);
  }

  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
    if(sessionError){ showStartupError('Не удалось проверить сохранённую сессию Supabase. Локальные данные MedControl не изменены. Проверьте соединение и повторите загрузку страницы.'); return; }
    if(!sessionData?.session){ goToLogin('no_session'); return; }
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError){ showStartupError('Не удалось подтвердить пользователя Supabase. Сессия не удалена, локальные данные MedControl не изменены. Проверьте соединение и повторите загрузку страницы.'); return; }
    if(!userData?.user){ await supabase.auth.signOut().catch(()=>{}); goToLogin('invalid_session'); return; }

    window.medcontrolSupabase=supabase;
    window.medcontrolSupabaseUser=userData.user;
    await startPage();
  }catch(error){
    console.error('MedControl Auth Guard failed.',error);
    showStartupError('Не удалось запустить MedControl. Локальные данные не удалялись.\n\n'+(error&&error.message?error.message:error));
  }
})();