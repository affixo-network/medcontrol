(function(){
  const KEY='affixo_medcontrol_standard_v3';
  const MARKER='affixo_medcontrol_recovery_snapshot_2026_08_19_applied';
  const BACKUP='affixo_medcontrol_before_recovery_2026_08_19';
  if(localStorage.getItem(MARKER)==='1') return;

  const raw=localStorage.getItem(KEY);
  if(raw && !localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP,raw);

  let previous={};
  try{ previous=raw?JSON.parse(raw):{}; }catch(_){ previous={}; }
  const settings=Object.assign({},previous.settings||{}, {interfaceLanguage:'ru'});

  const archived=[
    {order:1,name:'Аспирин',manufacturer:'',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'принимать после еды'},
    {order:2,name:'Тест 1',manufacturer:'',contentValue:'1000',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'T1'},
    {order:3,name:'T2',manufacturer:'',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'capsule',details:'T2'},
    {order:4,name:'T3',manufacturer:'',contentValue:'100',contentUnit:'mg',intakeQuantity:'0.5',intakeUnit:'drop',details:'T3'},
    {order:5,name:'Тест 4',manufacturer:'',contentValue:'1000',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'T4'},
    {order:6,name:'Тест5',manufacturer:'ГГ',contentValue:'1000',contentUnit:'mg/ml',intakeQuantity:'1',intakeUnit:'teaspoon',details:'T5'},
    {order:7,name:'Тест 10',manufacturer:'ДД',contentValue:'1500',contentUnit:'mg/g',intakeQuantity:'1',intakeUnit:'vial',details:'после еды'},
    {order:8,name:'Тест 11',manufacturer:'КК',contentValue:'1000',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'через 30 минут после еды'},
    {order:9,name:'Тест 12',manufacturer:'ЛЛ',contentValue:'500',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',details:'только по назначению терапевта'}
  ].map(x=>Object.assign({
    id:'recovery-med-'+String(x.order).padStart(3,'0'),
    contentUnitOther:'',intakeUnitOther:'',dose:x=>x,
    scheduleType:'daily',times:[],startDate:'',endDate:'',weekdays:[],explicitDates:[],
    active:false,cancelled:true,history:[]
  },x,{dose:`${x.intakeQuantity} ${x.intakeUnit}`}));

  const active={
    id:'recovery-med-010',order:10,name:'INPUT-003-1',manufacturer:'CC',
    contentValue:'500',contentUnit:'other',contentUnitOther:'тс-4',
    intakeQuantity:'1',intakeUnit:'tablet',intakeUnitOther:'',dose:'1 tablet',
    details:'натощак принимать',scheduleType:'weekdays',
    times:['08:30'],startDate:'',endDate:'2026-08-20',
    weekdays:['Mon','Tue','Fri','Sat'],explicitDates:[],
    active:true,cancelled:false,history:[]
  };

  const next={settings,medications:[...archived,active],intakeLogs:[]};
  localStorage.setItem(KEY,JSON.stringify(next));
  localStorage.setItem(MARKER,'1');
})();