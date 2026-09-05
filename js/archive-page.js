(function(){
  function archiveShell(body){
    const tz=escapeHtml(getState().settings.timezone);
    return `<div class="wrap">
      <section class="topbar">
        <div class="nav">
          <a href="input.html">Ввод</a>
          <a href="action.html">Приём препаратов</a>
          <a href="dashboard.html">Табло</a>
          <a class="active" href="archive.html">Архив</a>
        </div>
        <div class="meta">
          <span class="pill">Текущая дата: <strong id="topCurrentDate"></strong></span>
          <span class="pill">Текущее время: <strong id="topCurrentTime"></strong></span>
          <span class="pill">Часовой пояс: <strong class="mono">${tz}</strong></span>
        </div>
      </section>${body}</div>`;
  }
  const style=`<style>
    :root{--fg:#111827;--muted:#6b7280;--bd:#e5e7eb;--bg:#f8fafc;--card:#fff}
    *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--fg);line-height:1.45}
    .wrap{max-width:1380px;margin:0 auto;padding:20px 16px 48px}.topbar,.card{background:var(--card);border:1px solid var(--bd);border-radius:16px}.topbar{padding:14px;margin-bottom:16px}.card{padding:18px;margin-bottom:16px}
    .nav,.meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.nav a{display:inline-flex;text-decoration:none;padding:10px 14px;border-radius:12px;border:1px solid var(--bd);background:#fff;color:var(--fg)}.nav .active{border-color:#111827;background:#111827;color:#fff}.meta{margin-top:12px}.pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid var(--bd);background:#fff;font-size:12px}.mono{font-family:ui-monospace,Consolas,monospace}.muted{color:var(--muted)}h1,h2{margin:0 0 12px}
  </style>`;
  document.head.insertAdjacentHTML('beforeend',style);
  document.body.innerHTML=archiveShell(`<section class="card"><h1>MedControl — Архив</h1><p class="muted">Архив подготовлен. Перенос архивных представлений будет выполняться только после проверки навигации.</p></section>`);
  scheduleClock();
})();