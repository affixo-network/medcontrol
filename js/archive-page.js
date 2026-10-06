window.renderArchivePage=function(){
  const state=getState();
  const esc=v=>escapeHtml(String(v==null?'':v));
  const meds=(state.medications||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const now=new Date();
  const tz=state.settings.timezone;

  function medicationEnd(m){
    if(m.scheduleType==='explicit_dates' && (m.explicitDates||[]).length) return (m.explicitDates||[]).slice().sort().pop();
    return m.endDate||'';
  }
  const today=currentLocalDate();
  const completed=meds.filter(m=>!m.cancelled && medicationEnd(m) && medicationEnd(m)<today);
  const cancelled=meds.filter(m=>!!m.cancelled);

  function removedTimes(){
    const out=[];
    meds.forEach(m=>{
      const entries=[...(m.rowHistory||[])].filter(Boolean).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
      const created=entries.find(e=>e.action==='created');
      let times=[...((created?.snapshot?.times)||[])].filter(Boolean).sort();
      entries.forEach(h=>{
        if(h===created)return;
        const c=h.changes||{},at=h.at||'',date=at?localDateFromISO(at):'';
        if(c.timeStatus){
          const x=c.timeStatus,old=x.oldTime||x.time||'';
          if(x.deleted&&old){
            out.push({m,time:old,date,at,kind:'Удалено',newTime:''});
            const p=times.indexOf(old);if(p>=0)times.splice(p,1);
          }else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){
            out.push({m,time:x.oldTime,date,at,kind:'Заменено',newTime:x.newTime});
            const p=times.indexOf(x.oldTime);if(p>=0)times[p]=x.newTime;
          }
        }
        if(Object.prototype.hasOwnProperty.call(c,'times')){
          const next=[...new Set((c.times||[]).filter(Boolean))].sort();
          const removed=times.filter(t=>!next.includes(t)),added=next.filter(t=>!times.includes(t)),pairs=Math.min(removed.length,added.length);
          for(let i=0;i<pairs;i++)out.push({m,time:removed[i],date,at,kind:'Заменено',newTime:added[i]});
          for(let i=pairs;i<removed.length;i++)out.push({m,time:removed[i],date,at,kind:'Удалено',newTime:''});
          times=next;
        }
      });
      (m.timeStatusHistory||[]).forEach(h=>{
        const old=h?.oldTime||'';
        if(!old||(!h.deleted&&!(h.newTime&&h.newTime!==old)))return;
        const at=h.at||'',date=h.date||localDateFromISO(at)||'',kind=h.deleted?'Удалено':'Заменено',newTime=h.newTime||'';
        const dup=out.some(x=>x.m.id===m.id&&x.time===old&&x.at===at&&x.kind===kind&&x.newTime===newTime);
        if(!dup)out.push({m,time:old,date,at,kind,newTime});
      });
    });
    return out.sort((a,b)=>{const delta=new Date(a.at||0)-new Date(b.at||0);if(delta)return delta;const order=(a.m?.order||0)-(b.m?.order||0);if(order)return order;return String(a.time||'').localeCompare(String(b.time||''));});
  }
  const removed=removedTimes();

  function todayOnlySlots(){
    const out=[];
    const seen=new Set();
    meds.forEach(m=>{
      (m.rowHistory||[]).forEach(h=>{
        const scope=String(h.scheduleScope||h.scope||h.changeScope||h.temporalScope||'').toLowerCase();
        const isToday=scope==='today'||scope.includes('сегодня')||!!h.todayOnly;
        if(!isToday||!h.at)return;
        const date=localDateFromISO(h.at);
        if(!date||date>=today)return;
        const changed=Array.isArray(h.changedTimeValues)?h.changedTimeValues.filter(Boolean):[];
        const removedValues=Array.isArray(h.removedTimeValues)?h.removedTimeValues.filter(Boolean):[];
        let times=[...new Set([...changed,...removedValues])];
        if(!times.length && h.scopeTodayTemporal && Array.isArray(h.scopeTodayTemporal.times)){
          const future=new Set((h.scopeFutureTemporal&&Array.isArray(h.scopeFutureTemporal.times))?h.scopeFutureTemporal.times:[]);
          times=h.scopeTodayTemporal.times.filter(time=>time&&!future.has(time));
        }
        times.forEach(time=>{
          if(!/^\d{2}:\d{2}$/.test(time))return;
          const key=m.id+'|'+date+'|'+time;
          if(seen.has(key))return;
          seen.add(key);
          out.push({m,date,time,plannedAt:getScheduledDateTime(date,time)});
        });
      });
    });
    return out.sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  }
  const todayOnly=todayOnlySlots();

  function medTable(items,kind){
    if(!items.length)return '<p class="muted">Нет записей.</p>';
    return `<table><thead><tr><th>№</th><th>Препарат</th><th>Расписание</th><th>${kind==='cancelled'?'Статус':'Дата завершения'}</th><th>История</th></tr></thead><tbody>${items.map(m=>`<tr><td>${esc(m.order||'—')}</td><td>${esc(m.name||'—')}</td><td>${esc((m.times||[]).join(', ')||'—')}</td><td>${kind==='cancelled'?'Отменён':esc(formatDate(medicationEnd(m))||'—')}</td><td><button type="button" onclick="showArchiveMedicationHistory('${m.id}')">История</button></td></tr>`).join('')}</tbody></table>`;
  }
  function removedTimesTable(){
    if(!removed.length)return '<p class="muted">Нет удалённых или заменённых времён.</p>';
    return `<table><thead><tr><th>№</th><th>Препарат</th><th>Время</th><th>Состояние</th><th>Дата/время изменения</th><th>История</th></tr></thead><tbody>${removed.map(x=>`<tr><td>${esc(x.m.order||'—')}</td><td>${esc(x.m.name||'—')}</td><td>${esc(x.time)}</td><td>${esc(x.kind+(x.newTime?' → '+x.newTime:''))}</td><td>${x.at?esc(formatDateTime(x.at)):(x.date?esc(formatDate(x.date)):'—')}</td><td><button type="button" onclick="showArchiveRemovedTimeHistory('${x.m.id}','${x.time}')">История</button></td></tr>`).join('')}</tbody></table>`;
  }
  function todayTable(){
    if(!todayOnly.length)return '<p class="muted">Нет завершённых разовых назначений.</p>';
    return `<table><thead><tr><th>№</th><th>Препарат</th><th>Дата</th><th>Расчётное время</th><th>История</th></tr></thead><tbody>${todayOnly.map(x=>`<tr><td>${esc(x.m.order||'—')}</td><td>${esc(x.m.name||'—')}</td><td>${esc(formatDate(x.date))}</td><td>${esc(x.time)}</td><td><button type="button" onclick="showArchiveSlotHistory('${x.m.id}','${x.plannedAt}')">История</button></td></tr>`).join('')}</tbody></table>`;
  }
  function shell(body){return `<div class="wrap"><section class="topbar"><div class="nav"><a href="input.html">Ввод</a><a href="action.html">Приём препаратов</a><a href="dashboard.html">Табло</a><a class="active" href="archive.html">Архив</a></div><div class="meta"><span class="pill">Текущая дата: <strong id="topCurrentDate"></strong></span><span class="pill">Текущее время: <strong id="topCurrentTime"></strong></span><span class="pill">Часовой пояс: <strong class="mono">${esc(tz)}</strong></span></div></section>${body}</div>`;}
  function historyDialogHtml(){return `<dialog id="archiveHistoryDialog"><h2 id="archiveHistoryTitle">История</h2><div id="archiveHistoryContent"></div><div class="right" style="margin-top:14px"><button type="button" onclick="document.getElementById('archiveHistoryDialog').close()">Закрыть</button></div></dialog>`;}

  window.__archiveIntakeFilter=null;
  window.__archiveIntakePeriod='30';
  window.setArchiveIntakeFilter=function(filter){
    window.__archiveIntakeFilter=filter==='missed'?'missed':'taken';
    if(typeof window.renderArchiveIntakeHistoryBlock==='function')window.renderArchiveIntakeHistoryBlock();
  };
  window.setArchiveIntakePeriod=function(period){
    window.__archiveIntakePeriod=['yesterday','7','30','all'].includes(period)?period:'30';
    if(typeof window.renderArchiveIntakeHistoryBlock==='function')window.renderArchiveIntakeHistoryBlock();
  };
  window.collapseArchiveIntakeHistory=function(){
    window.__archiveIntakeFilter=null;
    if(typeof window.renderArchiveIntakeHistoryBlock==='function')window.renderArchiveIntakeHistoryBlock();
  };
  window.renderArchiveIntakeHistoryBlock=function(){
    const host=document.getElementById('archiveIntakeHistoryContent');
    if(!host)return;
    const takenButton=document.getElementById('archiveTakenFilter');
    const missedButton=document.getElementById('archiveMissedFilter');
    const collapseButton=document.getElementById('archiveCollapseFilter');
    const filter=window.__archiveIntakeFilter;
    if(takenButton)takenButton.classList.toggle('active',filter==='taken');
    if(missedButton)missedButton.classList.toggle('active',filter==='missed');
    if(collapseButton)collapseButton.style.display=filter?'inline-flex':'none';
    if(!filter){host.innerHTML='';return;}

    if(typeof window.medControlArchiveCourseSlots!=='function'){
      host.innerHTML='<p class="muted">Подготавливается история приёмов…</p>';
      return;
    }

    const rows=[];
    const today=currentLocalDate();
    const period=window.__archiveIntakePeriod||'30';
    const yesterdayDate=(()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);return dateFromParts(d);})();
    const cutoffDate=(days=>{if(period==='all'||period==='yesterday')return null;const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-(days-1));return dateFromParts(d);})(period==='7'?7:30);
    meds.forEach(m=>{
      const slots=window.medControlArchiveCourseSlots(m)||[];
      slots.forEach(slot=>{
        if(filter==='taken'){
          if(slot.result!=='Принято')return;
        }else{
          if(slot.result!=='Не выполнен'||slot.date>=today)return;
        }
        if(period==='yesterday'&&slot.date!==yesterdayDate)return;
        if(cutoffDate&&period!=='yesterday'&&slot.date<cutoffDate)return;
        rows.push({m,slot});
      });
    });
    rows.sort((a,b)=>(b.slot.plannedMs||0)-(a.slot.plannedMs||0));

    if(!rows.length){
      host.innerHTML=`<p class="muted">${filter==='taken'?'Принятых препаратов в истории нет.':'Непринятых препаратов в истории нет.'}</p>`;
      return;
    }

    if(filter==='taken'){
      host.innerHTML=`<table><thead><tr><th>№</th><th>Препарат</th><th>Дата</th><th>Расчётное время</th><th>Фактическое время</th></tr></thead><tbody>${rows.map(({m,slot})=>`<tr><td>${esc(m.order||'—')}</td><td>${esc(m.name||'—')}</td><td>${esc(formatDate(slot.date))}</td><td>${esc(slot.time)}</td><td>${slot.actualAt?esc(formatDateTime(slot.actualAt)):'—'}</td></tr>`).join('')}</tbody></table>`;
    }else{
      host.innerHTML=`<table><thead><tr><th>№</th><th>Препарат</th><th>Дата</th><th>Расчётное время</th></tr></thead><tbody>${rows.map(({m,slot})=>`<tr><td>${esc(m.order||'—')}</td><td>${esc(m.name||'—')}</td><td>${esc(formatDate(slot.date))}</td><td>${esc(slot.time)}</td></tr>`).join('')}</tbody></table>`;
    }
  };
  window.addEventListener('medcontrolArchiveCourseSlotsReady',()=>window.renderArchiveIntakeHistoryBlock?.());

  window.showArchiveMedicationHistory=function(id){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=document.getElementById('archiveHistoryDialog'),t=document.getElementById('archiveHistoryTitle'),c=document.getElementById('archiveHistoryContent');if(!d||!t||!c)return;
    t.textContent=`История препарата «${med.name}»`;
    c.innerHTML=rowHistoryHtml(med.rowHistory||[]);
    d.showModal();
  };
  window.showArchiveRemovedTimeHistory=function(id,time){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=document.getElementById('archiveHistoryDialog'),t=document.getElementById('archiveHistoryTitle'),host=document.getElementById('archiveHistoryContent');if(!d||!t||!host)return;
    t.textContent=`История времени ${time} препарата «${med.name}»`;

    const all=[...(med.rowHistory||[])].filter(Boolean).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
    const created=all.find(h=>h.action==='created')||null;
    let currentTimes=[...((created?.snapshot?.times)||[])].filter(Boolean).sort();
    const rows=[];
    if(created&&currentTimes.includes(time))rows.push(created);

    all.forEach(h=>{
      if(h===created)return;
      const c=h.changes||{};
      const before=[...currentTimes];
      const beforeHas=before.includes(time);

      if(Object.prototype.hasOwnProperty.call(c,'times')){
        currentTimes=[...new Set((c.times||[]).filter(Boolean))].sort();
      }
      const ts=c.timeStatus;
      if(ts){
        const old=ts.oldTime||ts.time||'';
        if(ts.deleted){
          const p=currentTimes.indexOf(old);if(p>=0)currentTimes.splice(p,1);
        }else if(ts.oldTime&&ts.newTime&&ts.oldTime!==ts.newTime){
          const p=currentTimes.indexOf(ts.oldTime);if(p>=0)currentTimes[p]=ts.newTime;
        }
      }

      const after=[...currentTimes];
      const afterHas=after.includes(time);
      const directTimeChange=beforeHas!==afterHas||
        Boolean(ts&&(ts.time===time||ts.oldTime===time||ts.newTime===time))||
        (Object.prototype.hasOwnProperty.call(c,'times')&&(
          before.filter(x=>!after.includes(x)).includes(time)||
          after.filter(x=>!before.includes(x)).includes(time)
        ));
      const ruleChange=['scheduleType','weekdays','explicitDates','startDate','endDate'].some(k=>Object.prototype.hasOwnProperty.call(c,k));
      const statusChange=Object.prototype.hasOwnProperty.call(c,'active')||
        /Статус препарата изменён|активирован|пассив/.test(String(h.payload||''))||
        ['activated','deactivated','active','passive'].includes(h.action);

      if(directTimeChange||(beforeHas||afterHas)&&(ruleChange||statusChange))rows.push(h);
    });

    const timeEvents=(med.timeStatusHistory||[]).filter(h=>h&&(h.time===time||h.oldTime===time||h.newTime===time)&&(h.deleted||(h.newTime&&h.oldTime&&h.newTime!==h.oldTime)));
    timeEvents.forEach(h=>{
      const already=rows.some(r=>{
        const ts=r?.changes?.timeStatus;
        return r.at===h.at&&ts&&(ts.time===time||ts.oldTime===time||ts.newTime===time);
      });
      if(already)return;
      rows.push({
        at:h.at||nowISO(),action:'edited',
        changes:{timeStatus:{time:h.time||h.oldTime||time,oldTime:h.oldTime||h.time||time,newTime:h.newTime||'',deleted:!!h.deleted,replaced:!!(h.newTime&&h.oldTime&&h.newTime!==h.oldTime),active:false}},
        payload:h.deleted?`Время ${h.oldTime||h.time||time} удалено.`:`Время ${h.oldTime||time} заменено на ${h.newTime}.`
      });
    });

    rows.sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
    const seen=new Set(),unique=rows.filter(h=>{const key=`${h.at||''}|${h.action||''}|${JSON.stringify(h.changes||h.snapshot||{})}`;if(seen.has(key))return false;seen.add(key);return true;});
    host.innerHTML=rowHistoryHtml(med.rowHistory||[],{targetTime:time,timeEventsOnly:true});
    d.showModal();
  };
  window.showArchiveSlotHistory=function(id,plannedAt){
    const med=(getState().medications||[]).find(x=>x.id===id);if(!med)return;
    const d=document.getElementById('archiveHistoryDialog'),t=document.getElementById('archiveHistoryTitle'),c=document.getElementById('archiveHistoryContent');if(!d||!t||!c)return;
    const time=(formatDateTime(plannedAt).split(', ')[1]||'—');
    t.textContent=`История приёма препарата «${med.name}» — расчётное время ${time}`;
    c.innerHTML=typeof window.intakeHistoryRows==='function'?window.intakeHistoryRows(id,'all',plannedAt):'<p class="muted">История приёма недоступна.</p>';
    d.showModal();
  };

  document.head.insertAdjacentHTML('beforeend',`<style>:root{--fg:#111827;--muted:#6b7280;--bd:#e5e7eb;--bg:#f8fafc;--card:#fff}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--fg);line-height:1.45}.wrap{max-width:1380px;margin:0 auto;padding:20px 16px 48px}.topbar,.card{background:var(--card);border:1px solid var(--bd);border-radius:16px}.topbar{padding:14px;margin-bottom:16px}.card{padding:18px;margin-bottom:16px}.nav,.meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.nav a{display:inline-flex;text-decoration:none;padding:10px 14px;border-radius:12px;border:1px solid var(--bd);background:#fff;color:var(--fg)}.nav .active{border-color:#111827;background:#111827;color:#fff}.meta{margin-top:12px}.pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid var(--bd);background:#fff;font-size:12px}.mono{font-family:ui-monospace,Consolas,monospace}.muted{color:var(--muted)}h1,h2{margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid var(--bd);text-align:left;vertical-align:top}th{font-size:13px;background:#fafafa}dialog{width:calc(100vw - 24px);max-width:none;border:1px solid var(--bd);border-radius:16px;padding:18px}.right{text-align:right}</style>`);
  document.body.innerHTML=shell(`<section class="card"><h1>MedControl — Архив</h1><p class="muted">Архивные представления читают существующие данные. Ничего из Ввода и истории не удалено.</p></section><section class="card"><h2>История приёмов</h2><div class="archive-intake-filters" style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center"><button id="archiveTakenFilter" type="button" onclick="setArchiveIntakeFilter('taken')">Принято</button><button id="archiveMissedFilter" type="button" onclick="setArchiveIntakeFilter('missed')">Не принято</button><label style="display:inline-flex;gap:8px;align-items:center">Период <select id="archiveIntakePeriod" onchange="setArchiveIntakePeriod(this.value)"><option value="yesterday">Вчера</option><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="all">Весь период</option></select></label><button id="archiveCollapseFilter" type="button" onclick="collapseArchiveIntakeHistory()" style="display:none">Свернуть</button></div><div id="archiveIntakeHistoryContent"></div></section><section class="card"><h2>Завершённые курсы</h2>${medTable(completed,'completed')}</section><section class="card"><h2>Отменённые препараты</h2>${medTable(cancelled,'cancelled')}</section><section class="card"><h2>Удалённые и заменённые времена</h2>${removedTimesTable()}</section>${historyDialogHtml()}`);
  if(typeof ensureLogoutNavigation==='function')ensureLogoutNavigation();
  if(typeof window.renderArchiveIntakeHistoryBlock==='function')window.renderArchiveIntakeHistoryBlock();
  scheduleClock();
};

if(!window.medcontrolShellNavigationLoading)window.renderArchivePage();