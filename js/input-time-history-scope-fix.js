(function(){
  const WEEK={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
  const PERIODS={today:'Сегодня','7':'7 дней','30':'30 дней',all:'Весь период'};
  function esc(v){return escapeHtml(v===undefined||v===null||v===''?'—':String(v));}
  function scheduleName(s){return s?.scheduleType==='weekdays'?'Дни недели':s?.scheduleType==='explicit_dates'?'Даты':'Каждый день';}
  function scheduleParams(s){
    if(s?.scheduleType==='weekdays')return (s.weekdays||[]).map(x=>WEEK[x]||x).join(', ')||'—';
    if(s?.scheduleType==='explicit_dates')return (s.explicitDates||[]).map(formatDate).join(', ')||'—';
    return 'Ежедневно';
  }
  function created(m){return (m.rowHistory||[]).find(e=>e?.action==='created');}
  function cutoff(p){if(p==='all')return null;const d=new Date();d.setHours(0,0,0,0);if(p==='7')d.setDate(d.getDate()-6);if(p==='30')d.setDate(d.getDate()-29);return d.getTime();}
  function within(at,p){const c=cutoff(p);return c===null||new Date(at).getTime()>=c;}
  function selector(p){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="timeHistoryPeriod" onchange="refreshInputTimeHistory()">${Object.entries(PERIODS).map(([v,l])=>`<option value="${v}" ${v===p?'selected':''}>${l}</option>`).join('')}</select></div>`;}
  function ruleSnapshot(m,x){return x?.scheduleSnapshot||m;}
  function datesFor(rule){return {start:rule?.startDate?formatDate(rule.startDate):'—',end:rule?.endDate?formatDate(rule.endDate):'—'};}
  function rows(m,t){
    const out=[],c=created(m),snap=c?.snapshot||m,seen=new Set();
    if(c&&(snap.times||[]).includes(t)){
      const d=datesFor(snap);
      out.push({at:c.at,event:'Создано',schedule:scheduleName(snap),params:scheduleParams(snap),time:t,start:d.start,end:d.end,status:snap.active===false?'Пассивно':'Активно'});
    }
    (m.timeStatusHistory||[]).forEach(x=>{
      if(x?.action==='time_created_active')return;
      if(x?.time!==t&&x?.oldTime!==t&&x?.newTime!==t)return;
      const newTime=x.newTime||x.time||t,key=[x.at,x.oldTime||'',newTime,x.active,x.deleted?'deleted':''].join('|');
      if(seen.has(key))return;seen.add(key);
      const rule=ruleSnapshot(m,x),d=datesFor(rule);
      let event='Изменено',status=typeof x.active==='boolean'?(x.active?'Активно':'Пассивно'):'—',time=newTime;
      if(x.deleted){event=`Время ${x.oldTime||x.time||t} удалено`;status='Удалено';time=x.oldTime||x.time||t;}
      else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){event=`Время изменено: ${x.oldTime} → ${x.newTime}`;}
      out.push({at:x.at,event,schedule:scheduleName(rule),params:scheduleParams(rule),time,start:d.start,end:d.end,status});
    });
    (m.rowHistory||[]).forEach(e=>{
      const x=e?.changes?.timeStatus;if(!x||(![x.time,x.oldTime,x.newTime].includes(t)))return;
      const newTime=x.newTime||x.time||t,key=[e.at,x.oldTime||'',newTime,x.active,x.deleted?'deleted':''].join('|');
      if(seen.has(key))return;seen.add(key);
      const rule=e.scheduleSnapshot||m,d=datesFor(rule);
      let event='Изменено',status=typeof x.active==='boolean'?(x.active?'Активно':'Пассивно'):'—',time=newTime;
      if(x.deleted){event=`Время ${x.oldTime||x.time||t} удалено`;status='Удалено';time=x.oldTime||x.time||t;}
      else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){event=`Время изменено: ${x.oldTime} → ${x.newTime}`;}
      out.push({at:e.at,event,schedule:scheduleName(rule),params:scheduleParams(rule),time,start:d.start,end:d.end,status});
    });
    return out.sort((a,b)=>new Date(a.at)-new Date(b.at));
  }
  function render(m,t,p){
    const rr=rows(m,t).filter(r=>within(r.at,p));
    if(!rr.length)return '<p class="muted">В выбранном периоде изменений этого времени нет.</p>';
    return `<table><thead><tr><th>Дата/время записи</th><th>Событие</th><th>Расписание</th><th>Параметры расписания</th><th>Время приёма</th><th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${rr.map(r=>`<tr><td>${esc(formatDateTime(r.at))}</td><td>${esc(r.event)}</td><td>${esc(r.schedule)}</td><td>${esc(r.params)}</td><td>${esc(r.time)}</td><td>${esc(r.start)}</td><td>${esc(r.end)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>`;
  }
  window.refreshInputTimeHistory=function(){const c=window.__timeHistory,m=(getState().medications||[]).find(x=>x.id===c?.id),host=document.getElementById('rowHistoryContent');if(!c||!m||!host)return;const p=document.getElementById('timeHistoryPeriod')?.value||c.period||'all';c.period=p;host.innerHTML=selector(p)+render(m,c.time,p);};
})();