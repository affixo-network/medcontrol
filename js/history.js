function rowHistoryActionLabel(action) {
  const labels={created:'Создано',edited:'Изменено',cancelled:'Отменено',activated:'Препарат активирован',deactivated:'Препарат деактивирован',active:'Препарат активирован',passive:'Препарат деактивирован'};
  return labels[action]||action||'—';
}

function rowHistoryHtml(entries, options={}) {
  if(!entries||!entries.length)return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  const sorted=[...entries].filter(Boolean).sort((a,b)=>new Date(a.at||0)-new Date(b.at||0));
  const created=sorted.find(e=>e.action==='created')||null;
  const week={Mon:'Пн',Tue:'Вт',Wed:'Ср',Thu:'Чт',Fri:'Пт',Sat:'Сб',Sun:'Вс'};
  const esc=v=>escapeHtml(v===undefined||v===null||v===''?'':String(v));
  const scheduleName=s=>s?.scheduleType==='weekdays'?'Дни недели':s?.scheduleType==='explicit_dates'?'Даты':'Каждый день';
  const scheduleParams=s=>s?.scheduleType==='weekdays'?(s.weekdays||[]).map(x=>week[x]||x).join(', ')||'—':s?.scheduleType==='explicit_dates'?(s.explicitDates||[]).map(formatDate).join(', ')||'—':'Ежедневно';
  const state=s=>{
    const type=s?.scheduleType||((s?.explicitDates||[]).length?'explicit_dates':(s?.weekdays||[]).length?'weekdays':'daily');
    const explicit=[...(s?.explicitDates||[])].filter(Boolean).sort();
    const p=typeof window.medicationPeriodDates==='function'?window.medicationPeriodDates({...s,scheduleType:type,explicitDates:explicit}):null;
    return {
      manufacturer:s?.manufacturer||'',contentValue:s?.contentValue||'',contentUnit:s?.contentUnit||'',contentUnitOther:s?.contentUnitOther||'',
      intakeQuantity:s?.intakeQuantity||'',intakeUnit:s?.intakeUnit||'',intakeUnitOther:s?.intakeUnitOther||'',details:s?.details||'',
      scheduleType:type,weekdays:[...(s?.weekdays||[])],explicitDates:explicit,times:[...(s?.times||[])],
      startDate:p?.startDate||s?.startDate||'',endDate:p?.endDate||s?.endDate||'',active:s?.active!==false
    };
  };
  const empty=v=>v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length);
  const kind=(a,b)=>JSON.stringify(a)===JSON.stringify(b)?'':empty(a)&&!empty(b)?'added':!empty(a)&&empty(b)?'deleted':'replaced';
  const form=(label,k,g='n')=>{const f={added:{m:'добавлен',f:'добавлена',n:'добавлено',p:'добавлены'},deleted:{m:'удалён',f:'удалена',n:'удалено',p:'удалены'},replaced:{m:'заменён',f:'заменена',n:'заменено',p:'заменены'}};return k?`${label} ${f[k][g]}`:'';};
  const blank=()=>({manufacturer:0,contentValue:0,contentUnit:0,intakeQuantity:0,intakeUnit:0,details:0,schedule:0,params:0,times:0,timeMask:[],startDate:0,endDate:0,status:0});
  const initial=state(created?.snapshot||sorted.find(e=>e.snapshot)?.snapshot||{});
  let current=initial;
  const rows=[];
  if(created){
    const createdState=state(initial);
    rows.push({at:created.at,event:'Создано',s:createdState,show:{manufacturer:1,contentValue:1,contentUnit:1,intakeQuantity:1,intakeUnit:1,details:1,schedule:1,params:1,times:1,timeMask:'all',startDate:1,endDate:1,status:1},beforeTimes:[],afterTimes:[...(createdState.times||[])],changedTimes:[...(createdState.times||[])],kind:'created'});
  }
  sorted.filter(e=>e!==created).forEach(e=>{
    const show=blank(),before=state(current),beforeTimes=[...(before.times||[])],c=e.changes||{};
    if(e.action==='cancelled'){current={...current,active:false};show.status=1;const afterState=state(current);rows.push({at:e.at,event:'Отменено',s:afterState,show,beforeTimes:[...beforeTimes],afterTimes:[...(afterState.times||[])],changedTimes:[],kind:'status'});return;}
    if(e.action==='course_completed'){current={...current,active:false};show.status=1;const afterState=state(current);rows.push({at:e.at,event:'Курс завершён',s:afterState,show,beforeTimes:[...beforeTimes],afterTimes:[...(afterState.times||[])],changedTimes:[],kind:'status'});return;}
    if(e.action!=='edited'&&e.action!=='activated'&&e.action!=='deactivated'&&e.action!=='active'&&e.action!=='passive')return;

    show.manufacturer='manufacturer'in c;show.contentValue='contentValue'in c;show.contentUnit='contentUnit'in c||'contentUnitOther'in c;
    show.intakeQuantity='intakeQuantity'in c;show.intakeUnit='intakeUnit'in c||'intakeUnitOther'in c;show.details='details'in c;
    show.schedule='scheduleType'in c;show.params='weekdays'in c||'explicitDates'in c;show.times='times'in c||Boolean(c.timeStatus);
    show.startDate='startDate'in c;show.endDate='endDate'in c;show.status='active'in c||['activated','deactivated','active','passive'].includes(e.action);

    Object.keys(c).forEach(k=>{if(k==='timeStatus'||k==='times')return;current[k]=Array.isArray(c[k])?[...c[k]]:c[k];});
    if(Object.prototype.hasOwnProperty.call(c,'times')){
      const desired=[...new Set((c.times||[]).filter(Boolean))].sort(),slots=[...(current.times||[])],active=slots.filter(Boolean);
      const removed=active.filter(t=>!desired.includes(t)),added=desired.filter(t=>!active.includes(t)),pairs=Math.min(removed.length,added.length);
      for(let i=0;i<pairs;i++){const p=slots.indexOf(removed[i]);if(p>=0)slots[p]=added[i];}
      for(let i=pairs;i<removed.length;i++){const p=slots.indexOf(removed[i]);if(p>=0)slots[p]=null;}
      for(let i=pairs;i<added.length;i++)slots.push(added[i]);
      current.times=slots;
    }
    if(c.timeStatus){
      const x=c.timeStatus,t=[...(current.times||[])],old=x.oldTime||x.time||'';
      if(x.deleted){const p=t.indexOf(old);if(p>=0)t[p]=null;}
      else if(x.oldTime&&x.newTime&&x.oldTime!==x.newTime){const p=t.indexOf(x.oldTime);if(p>=0)t[p]=x.newTime;}
      current.times=t;
    }
    if(['activated','active'].includes(e.action))current.active=true;
    if(['deactivated','passive'].includes(e.action))current.active=false;
    const payload=String(e.payload||'');
    if(payload.includes('«Активно»')){current.active=true;show.status=1;}
    if(payload.includes('«Пассивно»')){current.active=false;show.status=1;}

    const after=state(current),events=[],changedTimes=[];
    if(show.times){
      const n=Math.max(beforeTimes.length,after.times.length);
      show.timeMask=Array.from({length:n},(_,i)=>beforeTimes[i]!==after.times[i]);
      for(let i=0;i<n;i++){
        const beforeTime=beforeTimes[i]??null,afterTime=after.times[i]??null,k=kind(beforeTime,afterTime);
        if(k){
          events.push(form(`Время ${i+1}`,k,'n'));
          if(beforeTime)changedTimes.push(beforeTime);
          if(afterTime)changedTimes.push(afterTime);
        }
      }
    }
    if(show.schedule&&!show.params)show.params=1;
    [['manufacturer','Производитель','m'],['contentValue','Количественное содержание','n'],['intakeQuantity','Количество приёма','n'],['details','Детали','p'],['scheduleType','Расписание','n'],['startDate','Дата начала','f'],['endDate','Дата окончания','f']].forEach(([k,l,g])=>{if(k in c)events.push(form(l,kind(before[k],after[k]),g));});
    if('contentUnit'in c||'contentUnitOther'in c)events.push(form('Единица содержания',kind(medicationContentUnitLabel(before.contentUnit,before.contentUnitOther||''),medicationContentUnitLabel(after.contentUnit,after.contentUnitOther||'')),'f'));
    if('intakeUnit'in c||'intakeUnitOther'in c)events.push(form('Единица приёма',kind(medicationIntakeUnitLabel(before.intakeUnit,before.intakeUnitOther||''),medicationIntakeUnitLabel(after.intakeUnit,after.intakeUnitOther||'')),'f'));
    if('weekdays'in c||'explicitDates'in c||'scheduleType'in c)events.push(form('Параметры расписания',kind(scheduleParams(before),scheduleParams(after)),'p'));
    if(show.status){
      if(before.active!==after.active)events.push(after.active?'Препарат активирован':'Препарат деактивирован');
      else if(['activated','active'].includes(e.action))events.push('Препарат активирован');
      else if(['deactivated','passive'].includes(e.action))events.push('Препарат деактивирован');
    }
    const rowKind=show.times?'time':(show.schedule||show.params||show.startDate||show.endDate?'schedule':(show.status?'status':'other'));
    rows.push({at:e.at,event:events.filter(Boolean).join('; ')||rowHistoryActionLabel(e.action),s:after,show,beforeTimes:[...beforeTimes],afterTimes:[...(after.times||[])],changedTimes:[...new Set(changedTimes)],kind:rowKind});
  });

  const targetTime=String(options?.targetTime||'').trim();
  const timeEventsOnly=Boolean(options?.timeEventsOnly);
  const visibleRows=targetTime?rows.filter(r=>{
    if(r.kind==='created')return r.afterTimes.includes(targetTime);
    if(r.changedTimes.includes(targetTime))return true;
    if(!timeEventsOnly&&(r.kind==='schedule'||r.kind==='status'))return r.beforeTimes.includes(targetTime)||r.afterTimes.includes(targetTime);
    return false;
  }):rows;

  if(!visibleRows.length)return `<p class="muted">${escapeHtml(tr('no_history'))}</p>`;
  const maxTimes=Math.max(1,...visibleRows.map(r=>r.s.times.length)),headers=Array.from({length:maxTimes},(_,i)=>`<th>Время ${i+1}</th>`).join('');
  const cv=(flag,v)=>flag?esc(v):'';
  return `<table><thead><tr><th>Дата/время</th><th>Событие</th><th>Производитель</th><th>Количественное содержание</th><th>Единица содержания</th><th>Количество приёма</th><th>Единица приёма</th><th>Детали</th><th>Расписание</th><th>Параметры расписания</th>${headers}<th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>${visibleRows.map(r=>{const tc=Array.from({length:maxTimes},(_,i)=>`<td>${r.show.times&&(r.show.timeMask==='all'||r.show.timeMask?.[i])?(r.show.timeMask==='all'?esc(r.s.times[i]||'—'):(r.s.times[i]?esc(r.s.times[i]):'Удалено')):''}</td>`).join('');return `<tr><td>${esc(formatDateTime(r.at))}</td><td>${esc(r.event)}</td><td>${cv(r.show.manufacturer,r.s.manufacturer)}</td><td>${cv(r.show.contentValue,r.s.contentValue)}</td><td>${cv(r.show.contentUnit,medicationContentUnitLabel(r.s.contentUnit,r.s.contentUnitOther||''))}</td><td>${cv(r.show.intakeQuantity,r.s.intakeQuantity)}</td><td>${cv(r.show.intakeUnit,medicationIntakeUnitLabel(r.s.intakeUnit,r.s.intakeUnitOther||''))}</td><td>${cv(r.show.details,r.s.details)}</td><td>${cv(r.show.schedule,scheduleName(r.s))}</td><td>${cv(r.show.params,scheduleParams(r.s))}</td>${tc}<td>${r.show.startDate?esc(formatDate(r.s.startDate)):''}</td><td>${r.show.endDate?esc(formatDate(r.s.endDate)):''}</td><td>${r.show.status?(r.s.active?'Активно':'Пассивно'):''}</td></tr>`;}).join('')}</tbody></table>`;
}
