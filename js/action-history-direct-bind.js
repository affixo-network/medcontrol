(function(){
  function timelineEntries(){
    return typeof buildMedControlTimeline==='function' ? (buildMedControlTimeline()||[]) : [];
  }

  function bindDirectHistoryButtons(){
    const rows=[...document.querySelectorAll('section.card table tbody tr')];
    const entries=timelineEntries();

    rows.forEach((row,index)=>{
      const entry=entries[index];
      if(!entry||!entry.medication||!entry.plannedAt)return;
      const button=[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='История');
      if(!button)return;
      button.onclick=function(event){
        event.preventDefault();
        event.stopPropagation();
        window.showIntakeHistory(entry.medication.id,entry.plannedAt);
      };
    });
  }

  function wrapRenderer(name){
    const base=window[name];
    if(typeof base!=='function')return;
    window[name]=function(){
      const result=base.apply(this,arguments);
      bindDirectHistoryButtons();
      return result;
    };
  }

  wrapRenderer('renderActionPage');
  wrapRenderer('renderDashboardPage');
})();
