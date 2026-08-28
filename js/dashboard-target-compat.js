(function(){
  function duration(ms){let t=Math.max(0,Math.floor(ms/1000)),d=Math.floor(t/86400);t%=86400;let h=Math.floor(t/3600);t%=3600;let m=Math.floor(t/60),s=t%60;return `${d} дн. ${String(h).padStart(2,'0')} ч. ${String(m).padStart(2,'0')} мин. ${String(s).padStart(2,'0')} сек.`}
  function timing(item){
    if(item.status==='waiting') return `<strong>До времени приёма осталось</strong><br>${escapeHtml(duration(item.countdownMs||0))}`;
    if(item.status==='missed') return `<strong>Опоздание</strong><br>${escapeHtml(duration(item.countdownMs||0))}`;
    if(item.status==='taken'&&item.actualAt&&item.plannedMs){const diff=new Date(item.actualAt).getTime()-item.plannedMs;if(Math.abs(diff)<1000)return '<strong>Принято вовремя</strong>';return diff>0?`<strong>Принято позже на</strong><br>${escapeHtml(duration(diff))}`:`<strong>Принято раньше на</strong><br>${escapeHtml(duration(-diff))}`;}
    return '—';
  }
  function statusText(s){return({waiting:'Ожидается',missed:'Не выполнен',taken:'Принято',cancelled:'Отменен'})[s]||s}
  function statusCss(s){return s==='waiting'?'status expected':s==='missed'?'status overdue':s==='taken'?'status success':s==='cancelled'?'status upcoming':'status'}

  let dashboardRefreshTimer=null;

  window.renderDashboardPage=function(){
    const rows=buildMedControlTimeline().map(x=>`<tr>
      <td>${x.medication.order}</td>
      <td>${escapeHtml(x.medication.name)}</td>
      <td>${escapeHtml(x.medication.intakeQuantity||'—')}</td>
      <td>${escapeHtml(x.medication.intakeUnitOther||x.medication.intakeUnit||'—')}</td>
      <td>${escapeHtml(formatDate(x.plannedDate))}</td>
      <td>${escapeHtml(x.plannedTime)}</td>
      <td>${timing(x)}</td>
      <td>${x.actualAt?escapeHtml(formatDateTime(x.actualAt)):'—'}</td>
      <td><span class="${statusCss(x.status)}">${escapeHtml(statusText(x.status))}</span></td>
      <td><button type="button" onclick="window.showIntakeHistory('${x.medication.id}','${x.plannedAt}')">История</button></td>
    </tr>`).join('');
    const body=`<section class="card"><h1>MedControl — Табло</h1><p>Табло сохраняет временную картину и предоставляет доступ к истории по каждой строке.</p></section>
      <section class="card"><table><thead>
      <tr><th rowspan="3">№</th><th colspan="5">Введённые расчётные данные</th><th rowspan="3">Временной отсчёт</th><th colspan="3">Фактический приём препаратов</th></tr>
      <tr><th rowspan="2">Название препарата</th><th colspan="2">Доза</th><th colspan="2">Запланированный приём</th><th rowspan="2">Время</th><th rowspan="2">Статус</th><th rowspan="2">История</th></tr>
      <tr><th>Количество приёма</th><th>Единица приёма</th><th>Дата</th><th>Время</th></tr>
      </thead><tbody>${rows||'<tr><td colspan="10">Нет записей</td></tr>'}</tbody></table></section>
      <dialog id="intakeHistoryDialog"><h2>История</h2><div class="inline" style="margin-bottom:12px"><label>Период</label><select id="historyPeriodSelect" onchange="refreshIntakeHistory()"><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">Весь период</option></select></div><div id="intakeHistoryContent"></div><div class="right"><button type="button" onclick="document.getElementById('intakeHistoryDialog').close()">Закрыть</button></div></dialog>`;
    document.body.innerHTML=appShell('MedControl — Табло','dashboard',body);
    scheduleClock();

    if(dashboardRefreshTimer) clearTimeout(dashboardRefreshTimer);
    dashboardRefreshTimer=setTimeout(()=>{
      const dialog=document.getElementById('intakeHistoryDialog');
      if(dialog?.open) return;
      mount('dashboard');
    },1000);
  };
})();