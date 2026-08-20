(function(){
  const UNIT_LABELS={
    ru:{tablet:'таблетка',capsule:'капсула',ml:'мл',drop:'капля',teaspoon:'чайная ложка',tablespoon:'столовая ложка',dose:'доза',puff:'впрыск',ampoule:'ампула',vial:'флакон',packet:'пакет',sachet:'саше',suppository:'суппозиторий',patch:'пластырь',injection:'инъекция',unit:'единица'},
    en:{tablet:'tablet',capsule:'capsule',ml:'ml',drop:'drop',teaspoon:'teaspoon',tablespoon:'tablespoon',dose:'dose',puff:'puff',ampoule:'ampoule',vial:'vial',packet:'packet',sachet:'sachet',suppository:'suppository',patch:'patch',injection:'injection',unit:'unit'},
    hy:{tablet:'հաբ',capsule:'պատիճ',ml:'մլ',drop:'կաթիլ',teaspoon:'թեյի գդալ',tablespoon:'ճաշի գդալ',dose:'դոզա',puff:'ցողում',ampoule:'ամպուլա',vial:'սրվակ',packet:'փաթեթ',sachet:'սաշե',suppository:'մոմիկ',patch:'պլաստիր',injection:'ներարկում',unit:'միավոր'},
    fr:{tablet:'comprimé',capsule:'gélule',ml:'ml',drop:'goutte',teaspoon:'cuillère à café',tablespoon:'cuillère à soupe',dose:'dose',puff:'bouffée',ampoule:'ampoule',vial:'flacon',packet:'paquet',sachet:'sachet',suppository:'suppositoire',patch:'patch',injection:'injection',unit:'unité'},
    de:{tablet:'Tablette',capsule:'Kapsel',ml:'ml',drop:'Tropfen',teaspoon:'Teelöffel',tablespoon:'Esslöffel',dose:'Dosis',puff:'Sprühstoß',ampoule:'Ampulle',vial:'Fläschchen',packet:'Packung',sachet:'Beutel',suppository:'Zäpfchen',patch:'Pflaster',injection:'Injektion',unit:'Einheit'},
    es:{tablet:'tableta',capsule:'cápsula',ml:'ml',drop:'gota',teaspoon:'cucharadita',tablespoon:'cucharada',dose:'dosis',puff:'inhalación',ampoule:'ampolla',vial:'vial',packet:'paquete',sachet:'sobre',suppository:'supositorio',patch:'parche',injection:'inyección',unit:'unidad'},
    ar:{tablet:'قرص',capsule:'كبسولة',ml:'مل',drop:'قطرة',teaspoon:'ملعقة صغيرة',tablespoon:'ملعقة كبيرة',dose:'جرعة',puff:'بخة',ampoule:'أمبولة',vial:'قارورة',packet:'عبوة',sachet:'كيس',suppository:'تحميلة',patch:'لصقة',injection:'حقنة',unit:'وحدة'},
    zh:{tablet:'片',capsule:'胶囊',ml:'毫升',drop:'滴',teaspoon:'茶匙',tablespoon:'汤匙',dose:'剂量',puff:'喷',ampoule:'安瓿',vial:'药瓶',packet:'包',sachet:'袋',suppository:'栓剂',patch:'贴剂',injection:'注射',unit:'单位'},
    ja:{tablet:'錠',capsule:'カプセル',ml:'mL',drop:'滴',teaspoon:'小さじ',tablespoon:'大さじ',dose:'用量',puff:'吸入',ampoule:'アンプル',vial:'バイアル',packet:'包',sachet:'小袋',suppository:'坐薬',patch:'貼付剤',injection:'注射',unit:'単位'}
  };

  function language(){return getState()?.settings?.interfaceLanguage||'en'}
  window.medControlIntakeUnitLabel=function(med){
    if(!med) return '—';
    if(med.intakeUnit==='other') return med.intakeUnitOther||'—';
    const lang=language();
    return UNIT_LABELS[lang]?.[med.intakeUnit]||UNIT_LABELS.en[med.intakeUnit]||med.intakeUnit||'—';
  };

  function medicationByOrder(order){
    return (getState().medications||[]).find(m=>String(m.order)===String(order));
  }

  function localizeActionRows(){
    const table=document.querySelector('section.card table');
    if(!table) return;
    table.querySelectorAll('tbody tr').forEach(row=>{
      if(row.children.length<3) return;
      const med=medicationByOrder(row.children[0].textContent.trim());
      if(!med) return;
      const qty=med.intakeQuantity||'—';
      row.children[2].textContent=`${qty} ${window.medControlIntakeUnitLabel(med)}`;
    });
  }

  function localizeDashboardRows(){
    const table=document.querySelector('section.card table');
    if(!table) return;
    table.querySelectorAll('tbody tr').forEach(row=>{
      if(row.children.length<4) return;
      const med=medicationByOrder(row.children[0].textContent.trim());
      if(!med) return;
      row.children[3].textContent=window.medControlIntakeUnitLabel(med);
    });
  }

  const action=window.renderActionPage;
  if(typeof action==='function'){
    window.renderActionPage=function(){
      const result=action.apply(this,arguments);
      localizeActionRows();
      return result;
    };
  }

  const dashboard=window.renderDashboardPage;
  if(typeof dashboard==='function'){
    window.renderDashboardPage=function(){
      const result=dashboard.apply(this,arguments);
      localizeDashboardRows();
      return result;
    };
  }
})();
