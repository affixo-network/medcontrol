(function(){
  function scopeFor(med){
    const app=med&&med.temporalApplication;
    const today=typeof currentLocalDate==='function'?currentLocalDate():'';
    if(!app||app.date!==today) return null;
    if(!['today','future','today_future'].includes(app.scope)) return null;
    return app;
  }

  function findRowForMedication(med){
    const rows=[...document.querySelectorAll('table tbody tr')];
    return rows.find(row=>{
      const cells=row.querySelectorAll('td');
      if(cells.length<11) return false;
      const order=Number((cells[0].textContent||'').trim());
      const name=(cells[1].textContent||'').replace(/\s+/g,' ').trim();
      return Number(med.order)===order && name.includes(String(med.name||'').replace(/\s+/g,' ').trim());
    })||null;
  }

  function renderScopeCell(med,row){
    const app=scopeFor(med);
    if(!app||!row) return;
    const cells=row.querySelectorAll('td');
    if(cells.length<11) return;
    const timeCell=cells[10];
    const todayTimes=Array.isArray(app.todayTemporal?.times)?app.todayTemporal.times:[];
    const baseTimes=Array.isArray(med.times)?med.times:[];

    if(app.scope==='today'){
      const todayText=todayTimes.join(', ')||'—';
      const futureText=baseTimes.join(', ')||'—';
      timeCell.innerHTML=`<strong>${escapeHtml(todayText)}</strong><br><span class="small muted">Только сегодня</span><br><span class="small">Последующие дни: ${escapeHtml(futureText)}</span>`;
      return;
    }

    if(app.scope==='future'){
      const todayText=todayTimes.join(', ')||'—';
      const futureText=baseTimes.join(', ')||'—';
      timeCell.innerHTML=`<strong>${escapeHtml(todayText)}</strong><br><span class="small muted">Сегодня</span><br><span class="small">Последующие дни: ${escapeHtml(futureText)}</span>`;
      return;
    }

    if(app.scope==='today_future'){
      const text=baseTimes.join(', ')||'—';
      timeCell.innerHTML=`<strong>${escapeHtml(text)}</strong><br><span class="small muted">Сегодня и последующие дни</span>`;
    }
  }

  function updateInputScopeDisplay(){
    const state=typeof getState==='function'?getState():null;
    if(!state||!Array.isArray(state.medications)) return;
    state.medications.forEach(med=>{
      if(!scopeFor(med)) return;
      renderScopeCell(med,findRowForMedication(med));
    });
  }

  let scheduled=false;
  function scheduleRefresh(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      updateInputScopeDisplay();
    });
  }

  const originalMount=window.mount;
  if(typeof originalMount==='function'){
    window.mount=function(page){
      const result=originalMount(page);
      if(page==='input'){
        setTimeout(updateInputScopeDisplay,0);
        setTimeout(updateInputScopeDisplay,100);
      }
      return result;
    };
  }

  const observer=new MutationObserver(()=>scheduleRefresh());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(updateInputScopeDisplay,0));
  window.addEventListener('focus',()=>setTimeout(updateInputScopeDisplay,0));
  window.updateInputScopeDisplay=updateInputScopeDisplay;
})();
