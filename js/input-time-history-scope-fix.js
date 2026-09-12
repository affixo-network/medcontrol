(function(){
  const APPLY={today:'Только сегодня',future:'Только на последующие дни расписания',today_future:'Сегодня и на последующие дни расписания'};
  const WEEK={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
  const PERIODS={today:'Сегодня','7':'7 дней','30':'30 дней',all:'Весь период'};
  function esc(v){return escapeHtml(v===undefined||v===null||v===''?'—':String(v));}
  function ld(iso){try{return localDateFromISO(iso);}catch(_){return '';}}
  function scheduleName(s){return s?.scheduleType==='weekdays'?'Дни недели':s?.scheduleType==='explicit_dates'?'Даты':'Каждый день';}
  function scheduleParams(s){if(s?.scheduleType==='weekdays')return (s.weekdays||[]).map(x=>WEEK[x]||x).join(', ');if(s?.scheduleType==='explicit_dates')return (s.explicitDates||[]).map(formatDate).join(', ');return '';}
  function created(m){return (m.rowHistory||[]).find(e=>e?.action==='created');}
  function cutoff(p){if(p==='all')return null;const d=new Date();d.setHours(0,0,0,0);if(p==='7')d.setDate(d.getDate()-6);if(p==='30')d.setDate(d.getDate()-29);return d.getTime();}
  function within(at,p){const c=cutoff(p);return c===null||new Date(at).getTime()>=c;}
  function selector(p){return `<div class="inline" style="margin-bottom:12px"><label>Период</label><select id="timeHistoryPeriod" onchange="refreshInputTimeHistory()">${Object.entries(PERIODS).map(([v,l])=>`<option value="${v}" ${v===p?'selected':''}>${l}</option>`).join('')}</select></div>`;}
  function rows(m,t){
    const out=[],c=created(m),snap=c?.snapshot||m,seen=new Set();
    if(c&&(snap.times||[]).includes(t))out.push({at:c.at,event:'Создано',scope:'',schedule:scheduleName(snap),params:scheduleParams(snap),start:snap.startDate?formatDate(snap.startDate):'—',end:snap.endDate?formatDate(snap.endDate):'—',status:'Активно'});
    (m.timeStatusHistory||[]).forEach(x=>{
      if(x?.time!==t&&x?.oldTime!==t&&x?.newTime!==t)return;
      const newTime=x.newTime||x.time||t,key=[x.at,x.oldTime||'',newTime,x.active,x.scope||'',x.deleted?'deleted':''].join('|');
      if(seen.has(key))return;seen.add(key);
      const fields={at:x.at,event:'Изменено',scope:x.scope&&x.scope!=='daily'?(APPLY[x.scope]||''):'',schedule:'',params:'',start:'',end:'',status:''};
      if(x.deleted){fields.event=`Время ${x.oldTime||x.time||t} удалено`;fields.params=`Удалено время ${x.oldTime||x.time||t}`;fields.status='Удалено';}
      else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){fields.params=`Время изменено: ${x.oldTime} → ${x.newTime}`;fields.status=typeof x.active==='boolean'?(x.active?'Активно':'Пассивно'):'';}
      else if(typeof x.active==='boolean'){fields.status=x.active?'Активно':'Пассивно';}
      const date=x.date||ld(x.at);if(x.scope==='today'){fields.start=formatDate(date);fields.end=formatDate(date);}out.push(fields);
    });
    (m.rowHistory||[]).forEach(e=>{
      const x=e?.changes?.timeStatus;if(!x||(![x.time,x.oldTime,x.newTime].includes(t)))return;
      const newTime=x.newTime||x.time||t,key=[e.at,x.oldTime||'',newTime,x.active,x.scope||'',x.deleted?'deleted':''].join('|');
      if(seen.has(key))return;seen.add(key);
      out.push({at:e.at,event:x.deleted?`Время ${x.oldTime||x.time||t} удалено`:'Изменено',scope:x.scope&&x.scope!=='daily'?(APPLY[x.scope]||''):'',schedule:'',params:x.deleted?`Удалено время ${x.oldTime||x.time||t}`:(x.oldTime&&x.newTime&&x.oldTime!==x.newTime?`Время изменено: ${x.oldTime} → ${x.newTime}`:''),start:x.scope==='today'?formatDate(x.date||ld(e.at)):'',end:x.scope==='today'?formatDate(x.date||ld(e.at)):'',status:x.deleted?'Удалено':(typeof x.active==='boolean'?(x.active?'Активно':'Пассивно'):'')});
    });
    return out.sort((a,b)=>new Date(a.at)-new Date(b.at));
  }
  function render(m,t,p){const rr=rows(m,t).filter(r=>within(r.at,p));if(!rr.length)return '<p class="muted">В выбранном периоде изменений этого времени нет.</p>';return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Область изменения</th><th>Расписание</th><th>Параметры расписания</th><th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${rr.map(r=>`<tr><td>${esc(formatDateTime(r.at))}</td><td>${esc(r.event)}</td><td>${esc(r.scope)}</td><td>${esc(r.schedule)}</td><td>${esc(r.params)}</td><td>${esc(r.start)}</td><td>${esc(r.end)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>`;}
  window.refreshInputTimeHistory=function(){const c=window.__timeHistory,m=(getState().medications||[]).find(x=>x.id===c?.id),host=document.getElementById('rowHistoryContent');if(!c||!m||!host)return;const p=document.getElementById('timeHistoryPeriod')?.value||c.period||'all';c.period=p;host.innerHTML=selector(p)+render(m,c.time,p);};
})();