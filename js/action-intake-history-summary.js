(function(){
  const esc=value=>escapeHtml(String(value==null?'':value));
  const dateFromParts=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  window.__actionIntakeFilter=window.__actionIntakeFilter||null;
  window.__actionIntakePeriod=window.__actionIntakePeriod||'yesterday';

  window.setActionIntakeFilter=function(filter){
    window.__actionIntakeFilter=filter==='missed'?'missed':'taken';
    window.renderActionIntakeHistoryBlock?.();
  };

  window.setActionIntakePeriod=function(period){
    window.__actionIntakePeriod=['yesterday','7','30','all'].includes(period)?period:'30';
    window.renderActionIntakeHistoryBlock?.();
  };

  window.collapseActionIntakeHistory=function(){
    window.__actionIntakeFilter=null;
    window.renderActionIntakeHistoryBlock?.();
  };

  window.renderActionIntakeHistoryBlock=function(){
    const host=document.getElementById('actionIntakeHistoryContent');
    if(!host)return;
    const takenButton=document.getElementById('actionTakenFilter');
    const missedButton=document.getElementById('actionMissedFilter');
    const collapseButton=document.getElementById('actionCollapseFilter');
    const filter=window.__actionIntakeFilter;

    if(takenButton)takenButton.classList.toggle('active',filter==='taken');
    if(missedButton)missedButton.classList.toggle('active',filter==='missed');
    if(collapseButton)collapseButton.style.display=filter?'inline-flex':'none';
    if(!filter){host.innerHTML='';return;}

    if(typeof window.medControlArchiveCourseSlots!=='function'){
      host.innerHTML='<p class="muted">Подготавливается история приёмов…</p>';
      return;
    }

    const meds=(getState().medications||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
    const rows=[];
    const today=currentLocalDate();
    const period=window.__actionIntakePeriod||'30';
    const yesterdayDate=(()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);return dateFromParts(d);})();
    const cutoffDate=(days=>{
      if(period==='all'||period==='yesterday')return null;
      const d=new Date(today+'T12:00:00');
      d.setDate(d.getDate()-(days-1));
      return dateFromParts(d);
    })(period==='7'?7:30);

    meds.forEach(m=>{
      const slots=window.medControlArchiveCourseSlots(m)||[];
      slots.forEach(slot=>{
        if(filter==='taken'){
          if(slot.result!=='Принято')return;
        }else{
          if(slot.result!=='Не выполнен'||slot.date>=today)return;
        }
        if(period==='yesterday'&&slot.date!==yesterdayDate)return;
        if(cutoffDate&&slot.date<cutoffDate)return;
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
})();