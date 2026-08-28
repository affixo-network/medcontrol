(function(){
  const originalShowIntakeHistory=window.showIntakeHistory;
  if(typeof originalShowIntakeHistory!=='function') return;
  window.showIntakeHistory=function(medicationId){
    const result=originalShowIntakeHistory.apply(this,arguments);
    const med=(getState().medications||[]).find(item=>item.id===medicationId);
    const dialog=document.getElementById('intakeHistoryDialog');
    const title=dialog?.querySelector('h2');
    if(title&&med) title.textContent=`История приёма препарата «${med.name}»`;
    return result;
  };
})();
