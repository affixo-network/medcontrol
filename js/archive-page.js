(function(){
  const state=getState();
  const esc=v=>escapeHtml(String(v==null?'':v));
  const meds=(state.medications||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const now=new Date();
  const tz=state.settings.timezone;

  function localDate(iso){
    if(!iso)return '—';
    try{return new Intl.DateTimeFormat('ru-RU',{timeZone:tz,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));}catch(e){return '—';}
  }
  function localTime(iso){
    if(!iso)return '—';
    try{return new Intl.DateTimeFormat('ru-RU',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));}catch(e){return '—';}
  }
  function medicationEnd(m){
    if(m.scheduleType==='explicit_dates' && (m.explicitDates||[]).length) return (m.explicitDates||[]).slice().sort().pop();
    return m.endDate||'';
  }
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const completed=meds.filter(m=>!m.cancelled && medicationEnd(m) && medicationEnd(m)<today);
  const cancelled=meds.filter(m=>!!m.cancelled);

  function todayOnlySlots(){
    const out=[]; const seen=new Set();
    meds.forEach(m=>{
      (m.rowHistory||[]).forEach(h=>{
        const scope=String(h.scope||h.changeScope||h.temporalScope||'').toLowerCase();
        const isToday=scope.includes('today')||scope.includes('сегодня')||h.scopeTodayTemporal||h.todayOnly;
        if(!isToday)return;
        const date=h.scopeDate||h.date||h.localDate||(h.scopeTodayTemporal&&h.scopeTodayTemporal.date)||'';
        let times=[];
        if(Array.isArray(h.changedTimeValues))times=times.concat(h.changedTimeValues);
        if(Array.isArray(h.removedTimeValues))times=times.concat(h.removedTimeValues);
        if(h.scopeTodayTemporal&&Array.isArray(h.scopeTodayTemporal.times))times=times.concat(h.scopeTodayTemporal.times);
        if(Array.isArray(h.times))times=times.concat(h.times);
        [...new Set(times.filter(Boolean))].forEach(time=>{
          if(!date || date>=today)return;
          const key=m.id+'|'+date+'|'+time; if(seen.has(key))return; seen.add(key);
          out.push({m,date,time});
        });
      });
    });
    return out.sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  }
  const todayOnly=todayOnlySlots();

  function medTable(items,kind){
    if(!items.length)return '<p class="muted">Нет записей.</p>';
    return `<table><thead><tr><th>№</th><th>Препарат</th><th>Расписание</th><th>${kind==='cancelled'?'Статус':'Дата завершения'}</th></tr></thead><tbody>${items.map(m=>`<tr><td>${esc(m.order||'—')}</td><td>${esc(m.name||'—')}</td><td>${esc((m.times||[]).join(', ')||'—')}</td><td>${kind==='cancelled'?'Отменён':esc(medicationEnd(m)||'—')}</td></tr>`).join('')}</tbody></table>`;
  }
  function todayTable(){
    if(!todayOnly.length)return '<p class="muted">Нет завершённых разовых назначений.</p>';
    return `<table><thead><tr><th>№</th><th>Препарат</th><th>Дата</th><th>Расчётное время</th></tr></thead><tbody>${todayOnly.map(x=>`<tr><td>${esc(x.m.order||'—')}</td><td>${esc(x.m.name||'—')}</td><td>${esc(x.date)}</td><td>${esc(x.time)}</td></tr>`).join('')}</tbody></table>`;
  }
  function shell(body){return `<div class="wrap"><section class="topbar"><div class="nav"><a href="input.html">Ввод</a><a href="action.html">Приём препаратов</a><a href="dashboard.html">Табло</a><a class="active" href="archive.html">Архив</a></div><div class="meta"><span class="pill">Текущая дата: <strong id="topCurrentDate"></strong></span><span class="pill">Текущее время: <strong id="topCurrentTime"></strong></span><span class="pill">Часовой пояс: <strong class="mono">${esc(tz)}</strong></span></div></section>${body}</div>`;}
  document.head.insertAdjacentHTML('beforeend',`<style>:root{--fg:#111827;--muted:#6b7280;--bd:#e5e7eb;--bg:#f8fafc;--card:#fff}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--fg);line-height:1.45}.wrap{max-width:1380px;margin:0 auto;padding:20px 16px 48px}.topbar,.card{background:var(--card);border:1px solid var(--bd);border-radius:16px}.topbar{padding:14px;margin-bottom:16px}.card{padding:18px;margin-bottom:16px}.nav,.meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.nav a{display:inline-flex;text-decoration:none;padding:10px 14px;border-radius:12px;border:1px solid var(--bd);background:#fff;color:var(--fg)}.nav .active{border-color:#111827;background:#111827;color:#fff}.meta{margin-top:12px}.pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid var(--bd);background:#fff;font-size:12px}.mono{font-family:ui-monospace,Consolas,monospace}.muted{color:var(--muted)}h1,h2{margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid var(--bd);text-align:left;vertical-align:top}th{font-size:13px;background:#fafafa}</style>`);
  document.body.innerHTML=shell(`<section class="card"><h1>MedControl — Архив</h1><p class="muted">Архивные представления читают существующие данные. Ничего из Ввода и истории не удалено.</p></section><section class="card"><h2>Завершённые курсы</h2>${medTable(completed,'completed')}</section><section class="card"><h2>Отменённые препараты</h2>${medTable(cancelled,'cancelled')}</section><section class="card"><h2>Только сегодня — завершённые приёмы</h2>${todayTable()}</section>`);
  scheduleClock();
})();