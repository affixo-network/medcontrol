(function(){
  function formatTodayScope(med){
    const app=med?.temporalApplication;
    const today=typeof currentLocalDate==='function'?currentLocalDate():'';
    if(!app||app.date!==today) return null;
    if(app.scope!=='today'&&app.scope!=='future') return null;

    const todayTemporal=app.todayTemporal||null;
    if(!todayTemporal) return null;

    const todayTimes=Array.isArray(todayTemporal.times)?todayTemporal.times:[];
    const regularTimes=Array.isArray(med.times)?med.times:[];

    return {
      scope:app.scope,
      todayTimes,
      regularTimes
    };
  }

  function updateInputScopeDisplay(){
    const state=typeof getState==='function'?getState():null;
    if(!state||!Array.isArray(state.medications)) return;

    const tables=[...document.querySelectorAll('table')];
    if(!tables.length) return;

    const activeTable=tables.find(table=>{
      const heading=table.closest('section')?.querySelector('h2')?.textContent||'';
      return heading.includes('Активные препараты');
    }) || tables[0];

    const rows=[...activeTable.querySelectorAll('tbody tr')];
    rows.forEach(row=>{
      const cells=row.querySelectorAll('td');
      if(cells.length<11) return;
      const order=Number((cells[0].textContent||'').trim());
      if(!Number.isFinite(order)) return;
      const med=state.medications.find(item=>Number(item.order)===order);
      if(!med) return;
      const scope=formatTodayScope(med);
      if(!scope) return;

      const timeCell=cells[10];
      if(scope.scope==='today'){
        const todayText=scope.todayTimes.join(', ')||'—';
        const regularText=scope.regularTimes.join(', ')||'—';
        timeCell.innerHTML=`<strong>${escapeHtml(todayText)}</strong><br><span class="small muted">Только сегодня</span><br><span class="small">Последующие дни: ${escapeHtml(regularText)}</span>`;
      }else if(scope.scope==='future'){
        const todayText=scope.todayTimes.join(', ')||'—';
        const regularText=scope.regularTimes.join(', ')||'—';
        timeCell.innerHTML=`<strong>${escapeHtml(todayText)}</strong><br><span class="small muted">Сегодня</span><br><span class="small">Последующие дни: ${escapeHtml(regularText)}</span>`;
      }
    });
  }

  const originalMount=window.mount;
  if(typeof originalMount==='function'){
    window.mount=function(page){
      const result=originalMount(page);
      if(page==='input') window.setTimeout(updateInputScopeDisplay,0);
      return result;
    };
  }

  window.updateInputScopeDisplay=updateInputScopeDisplay;
})();
