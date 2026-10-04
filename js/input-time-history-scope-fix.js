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
  function cloneRule(source){
    const type=source?.scheduleType||'daily';
    const explicit=[...(source?.explicitDates||[])].sort();
    const start=type==='explicit_dates'&&explicit.length?explicit[0]:(source?.startDate||'');
    const end=type==='explicit_dates'&&explicit.length?explicit[explicit.length-1]:(source?.endDate||'');
    return {
      scheduleType:type,
      weekdays:[...(source?.weekdays||[])],
      explicitDates:explicit,
      startDate:start,
      endDate:end
    };
  }
  function applyRuleChanges(rule,changes){
    if(!changes)return rule;
    const next=cloneRule(rule);
    if(Object.prototype.hasOwnProperty.call(changes,'scheduleType'))next.scheduleType=changes.scheduleType||'daily';
    if(Object.prototype.hasOwnProperty.call(changes,'weekdays'))next.weekdays=[...(changes.weekdays||[])];
    if(Object.prototype.hasOwnProperty.call(changes,'explicitDates'))next.explicitDates=[...(changes.explicitDates||[])];
    if(Object.prototype.hasOwnProperty.call(changes,'startDate'))next.startDate=changes.startDate||'';
    if(Object.prototype.hasOwnProperty.call(changes,'endDate'))next.endDate=changes.endDate||'';
    return next;
  }
  function ruleChanged(changes){
    return Boolean(changes&&['scheduleType','weekdays','explicitDates'].some(k=>Object.prototype.hasOwnProperty.call(changes,k)));
  }
  function datesChanged(changes){
    return Boolean(changes&&['startDate','endDate'].some(k=>Object.prototype.hasOwnProperty.call(changes,k)));
  }
  function indexOfTime(slots,time){return slots.findIndex(v=>v===time);}
  function replaceTime(slots,oldTime,newTime){
    const i=indexOfTime(slots,oldTime);
    if(i>=0)slots[i]=newTime||null;
    else if(newTime)slots.push(newTime);
  }
  function deleteTime(slots,time){
    const i=indexOfTime(slots,time);
    if(i>=0)slots[i]=null;
  }
  function addTime(slots,time){
    if(time&&!slots.includes(time))slots.push(time);
  }
  function reconcileTimes(slots,target){
    const desired=[...new Set((target||[]).filter(Boolean))];
    const active=slots.filter(Boolean);
    const removed=active.filter(t=>!desired.includes(t));
    const added=desired.filter(t=>!active.includes(t));
    const pairs=Math.min(removed.length,added.length);
    for(let i=0;i<pairs;i++)replaceTime(slots,removed[i],added[i]);
    for(let i=pairs;i<removed.length;i++)deleteTime(slots,removed[i]);
    for(let i=pairs;i<added.length;i++)addTime(slots,added[i]);
  }
  function applyTimeChange(slots,change){
    if(!change)return;
    const oldTime=change.oldTime||change.time||'';
    const newTime=change.newTime||change.time||'';
    if(change.deleted){deleteTime(slots,oldTime);return;}
    if(change.oldTime&&change.newTime&&change.oldTime!==change.newTime){replaceTime(slots,change.oldTime,change.newTime);}
    else if(change.action==='time_added'||(!change.oldTime&&change.newTime)){addTime(slots,newTime);}
    (change.addedTimes||[]).forEach(t=>addTime(slots,t));
  }
  function eventLabel(entry,change,changes,beforeTimes,afterTimes){
    if(entry.action==='created')return 'Создано';
    if(entry.action==='cancelled')return 'Отменено';
    const events=[];
    const n=Math.max((beforeTimes||[]).length,(afterTimes||[]).length);
    for(let i=0;i<n;i++){
      const before=(beforeTimes||[])[i]??null,after=(afterTimes||[])[i]??null;
      if(before===after)continue;
      if(before==null&&after!=null)events.push(`Время ${i+1} добавлено`);
      else if(before!=null&&after==null)events.push(`Время ${i+1} удалено`);
      else events.push(`Время ${i+1} заменено`);
    }
    if(change&&typeof change.active==='boolean'&&!change.deleted&&!(change.oldTime&&change.newTime&&change.oldTime!==change.newTime)){
      const t=change.time||change.oldTime||change.newTime||'';
      const slot=Math.max(0,(beforeTimes||[]).findIndex(v=>v===t));
      events.push(`Время ${slot+1} ${change.active?'активировано':'деактивировано'}`);
    }
    if(ruleChanged(changes)){
      if(Object.prototype.hasOwnProperty.call(changes||{},'scheduleType'))events.push('Расписание заменено');
      if(Object.prototype.hasOwnProperty.call(changes||{},'weekdays')||Object.prototype.hasOwnProperty.call(changes||{},'explicitDates'))events.push('Параметры расписания заменены');
    }
    if(Object.prototype.hasOwnProperty.call(changes||{},'startDate'))events.push(changes.startDate?'Дата начала заменена':'Дата начала удалена');
    if(Object.prototype.hasOwnProperty.call(changes||{},'endDate'))events.push(changes.endDate?'Дата окончания заменена':'Дата окончания удалена');
    if(Object.prototype.hasOwnProperty.call(changes||{},'active'))events.push(changes.active?'Препарат активирован':'Препарат деактивирован');
    return events.join('; ')||'Изменено';
  }
  function statusLabel(entry,change){
    if(entry.action==='cancelled')return 'Отменено';
    if(change?.deleted)return 'Удалено';
    if(typeof change?.active==='boolean')return change.active?'Активно':'Пассивно';
    if(typeof entry?.changes?.active==='boolean')return entry.changes.active?'Активно':'Пассивно';
    return '';
  }
  function buildRows(m){
    const c=created(m),snap=c?.snapshot||m;
    let rule=cloneRule(snap);
    const slots=[...(snap.times||[])];
    const rows=[];
    if(c){
      rows.push({
        at:c.at,event:'Создано',schedule:scheduleName(rule),params:scheduleParams(rule),
        times:[...slots],start:rule.startDate?formatDate(rule.startDate):'—',
        end:rule.endDate?formatDate(rule.endDate):'—',status:snap.active===false?'Пассивно':'Активно'
      });
    }

    const entries=(m.rowHistory||[]).filter(e=>e&&e!==c&&e.action!=='created').sort((a,b)=>new Date(a.at)-new Date(b.at));
    entries.forEach(entry=>{
      const changes=entry.changes||{};
      const tc=changes.timeStatus;
      const hasTimes=Object.prototype.hasOwnProperty.call(changes,'times');
      const temporal=Boolean(tc||hasTimes||ruleChanged(changes)||datesChanged(changes)||Object.prototype.hasOwnProperty.call(changes,'active')||entry.action==='cancelled');
      if(!temporal)return;

      const beforeTimes=[...slots];
      if(tc)applyTimeChange(slots,tc);
      if(hasTimes)reconcileTimes(slots,changes.times);
      const afterTimes=[...slots];
      const showRule=ruleChanged(changes);
      const showDates=datesChanged(changes);
      rule=applyRuleChanges(rule,changes);

      rows.push({
        at:entry.at,
        event:eventLabel(entry,tc,changes,beforeTimes,afterTimes),
        schedule:showRule?scheduleName(rule):'',
        params:showRule?scheduleParams(rule):'',
        times:[...slots],
        start:showDates?(rule.startDate?formatDate(rule.startDate):'—'):'',
        end:showDates?(rule.endDate?formatDate(rule.endDate):'—'):'',
        status:statusLabel(entry,tc)
      });
    });

    return rows;
  }
  function render(m,p){
    const all=buildRows(m),rr=all.filter(r=>within(r.at,p));
    if(!rr.length)return '<p class="muted">В выбранном периоде изменений времени нет.</p>';
    const maxTimes=Math.max(1,...all.map(r=>r.times.length));
    const timeHeaders=Array.from({length:maxTimes},(_,i)=>`<th>Время ${i+1}</th>`).join('');
    const body=rr.map(r=>{
      const cells=Array.from({length:maxTimes},(_,i)=>`<td>${r.times[i]===null?'Удалено':esc(r.times[i]||'—')}</td>`).join('');
      return `<tr><td>${esc(formatDateTime(r.at))}</td><td>${esc(r.event)}</td><td>${esc(r.schedule)}</td><td>${esc(r.params)}</td>${cells}<td>${esc(r.start)}</td><td>${esc(r.end)}</td><td>${esc(r.status)}</td></tr>`;
    }).join('');
    return `<table><thead><tr><th>Дата/время записи</th><th>Событие</th><th>Расписание</th><th>Параметры расписания</th>${timeHeaders}<th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  window.refreshInputTimeHistory=function(){
    const c=window.__timeHistory,m=(getState().medications||[]).find(x=>x.id===c?.id),host=document.getElementById('rowHistoryContent');
    if(!c||!m||!host)return;
    const p=document.getElementById('timeHistoryPeriod')?.value||c.period||'all';
    c.period=p;
    host.innerHTML=selector(p)+render(m,p);
  };
})();