(function(){
  function ensureEditDialog(){
    if(document.getElementById('editDialog')) return;
    const dialog=document.createElement('dialog');
    dialog.id='editDialog';
    dialog.innerHTML='<h2>Изменить препарат</h2><div id="editDialogContent"></div>';
    document.body.appendChild(dialog);
  }
  ensureEditDialog();
  const originalRenderInputPage=window.renderInputPage;
  if(typeof originalRenderInputPage==='function'){
    window.renderInputPage=function(){
      originalRenderInputPage();
      ensureEditDialog();
    };
  }
})();