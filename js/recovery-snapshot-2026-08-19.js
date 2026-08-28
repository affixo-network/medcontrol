(function(){
  const KEY='affixo_medcontrol_standard_v3';
  const MARKER='affixo_medcontrol_recovery_snapshot_2026_08_19_v6_applied';
  const BACKUP='affixo_medcontrol_before_recovery_2026_08_19';
  if(localStorage.getItem(MARKER)==='1') return;

  const raw=localStorage.getItem(KEY);
  if(raw && !localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP,raw);

  let previous={};
  try{ previous=raw?JSON.parse(raw):{}; }catch(_){ previous={}; }
  const previousMedications=Array.isArray(previous.medications)?previous.medications:[];
  const settings=Object.assign({},previous.settings||{}, {interfaceLanguage:'ru'});

  function previousMedication(order,name){
    return previousMedications.find(m=>m&&m.order===order) || previousMedications.find(m=>m&&m.name===name) || null;
  }

  function latestConfirmedSnapshot(old){
    const history=Array.isArray(old?.rowHistory)?old.rowHistory:[];
    const entries=history
      .filter(entry=>entry&&entry.snapshot&&typeof entry.snapshot==='object')
      .slice()
      .sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
    return entries[0]?.snapshot||null;
  }

  function preserveConfirmed(target){
    const old=previousMedication(target.order,target.name);
    if(!old) return target;

    const confirmed=latestConfirmedSnapshot(old);
    const merged=confirmed?Object.assign({},target,confirmed):Object.assign({},target);

    merged.id=old.id||target.id;
    merged.order=target.order;
    merged.history=Array.isArray(old.history)?old.history:[];
    merged.rowHistory=Array.isArray(old.rowHistory)?old.rowHistory:[];
    merged.temporalChangePermissions=old.temporalChangePermissions;
    merged.temporalPending=old.temporalPending;

    if(confirmed){
      merged.dose=`${merged.intakeQuantity||''} ${merged.intakeUnitOther||merged.intakeUnit||''}`.trim();
    }

    return merged;
  }

  const unitLabel={tablet:'таблетка',capsule:'капсула',drop:'капля',teaspoon:'чайная ложка',vial:'флакон'};
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
  ].map(x=>preserveConfirmed(Object.assign({
    id:'recovery-med-'+String(x.order).padStart(3,'0'),
    contentUnitOther:'',intakeUnitOther:'',
    scheduleType:'daily',times:[],startDate:'',endDate:'',weekdays:[],explicitDates:[],
    active:false,cancelled:true,history:[],rowHistory:[]
  },x,{dose:`${x.intakeQuantity} ${unitLabel[x.intakeUnit]||x.intakeUnit}`})));

  const active=[
    {
      id:'recovery-med-010',order:10,name:'INPUT-003-1',manufacturer:'CC',
      contentValue:'500',contentUnit:'other',contentUnitOther:'тс-4',
      intakeQuantity:'1',intakeUnit:'tablet',intakeUnitOther:'',dose:'1 таблетка',
      details:'натощак принимать',scheduleType:'weekdays',
      times:['08:30'],startDate:'',endDate:'2026-08-20',
      weekdays:['Mon','Tue','Fri','Sat'],explicitDates:[],active:true,cancelled:false,history:[],rowHistory:[]
    },
    {
      id:'recovery-med-011',order:11,name:'TEST-MED-01',manufacturer:'',
      contentValue:'500',contentUnit:'mg',contentUnitOther:'',
      intakeQuantity:'1',intakeUnit:'tablet',intakeUnitOther:'',dose:'1 таблетка',
      details:'После еды',scheduleType:'weekdays',
      times:['09:34'],startDate:'',endDate:'2026-08-19',
      weekdays:['Tue','Thu','Sat'],explicitDates:[],active:true,cancelled:false,history:[],rowHistory:[]
    },
    {
      id:'recovery-med-012',order:12,name:'Тест 08/12/2026',manufacturer:'Арфей',
      contentValue:'1000',contentUnit:'mg',contentUnitOther:'',
      intakeQuantity:'1',intakeUnit:'capsule',intakeUnitOther:'',dose:'1 капсула',
      details:'принимать до еды',scheduleType:'weekdays',
      times:['09:00','18:30'],startDate:'',endDate:'2026-08-31',
      weekdays:['Wed','Fri','Sun'],explicitDates:[],active:true,cancelled:false,history:[],rowHistory:[]
    }
  ].map(preserveConfirmed);

  const next={
    settings,
    medications:[...archived,...active],
    intakeLogs:Array.isArray(previous.intakeLogs)?previous.intakeLogs:[],
    intakeCorrections:Array.isArray(previous.intakeCorrections)?previous.intakeCorrections:[]
  };
  localStorage.setItem(KEY,JSON.stringify(next));
  localStorage.setItem(MARKER,'1');
})();