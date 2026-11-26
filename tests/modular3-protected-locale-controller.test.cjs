'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const target=path.join(__dirname,'../js/modular3-protected-locale-controller.js');
// Removing the controller must fail these behavioral contracts, not silently use legacy Settings.
function fixture({rejectStage=false,rejectRender=false}={}){
 assert.ok(fs.existsSync(target),'Protected locale controller must exist');
 const api=require(target);
 let state={settings:{interfaceLanguage:'ru',languageChoiceConfirmed:true,languageConfirmationVersion:1},medications:[{name:'Synthetic'}]};
 const events=[],errors=[],selector={value:'fil'};
 const session={read:()=>structuredClone(state),isEntryAuthorized:()=>true,isUnlocked:()=>true};
 const policy={registry:[{id:1,code:'ru',name:'русский',direction:'ltr'},{id:96,code:'fil',name:'Filipino',direction:'ltr'}],resolve:c=>c==='tl-PH'?'fil':(['ru','fil'].includes(c)?c:null),async confirm(s,code,{stage}){events.push('prepare:'+code);await stage({code});events.push('commit:'+code);state.settings.interfaceLanguage=code;return {code};}};
 const document={documentElement:{lang:'ru',dir:'ltr'},querySelectorAll:()=>[selector]};
 const controller=api.create({session,policy,document,stage:async c=>{events.push('stage:'+c);assert.equal(state.settings.interfaceLanguage,'ru');if(rejectStage)throw Error('offline');},render:async()=>{events.push('render:'+state.settings.interfaceLanguage);if(rejectRender)throw Error('render');},notify:code=>errors.push(code),failClosed:async()=>events.push('locked')});
 return {controller,events,errors,selector,read:()=>state};
}
test('canonical alias uses shared staged confirmation without mutating clinical data',async()=>{const f=fixture();assert.equal(await f.controller.change('tl-PH'),true);assert.deepEqual(f.events,['prepare:fil','stage:fil','commit:fil','render:fil']);assert.deepEqual(f.read().medications,[{name:'Synthetic'}]);});
test('staging failure preserves saved language and restores selector with explicit failure',async()=>{const f=fixture({rejectStage:true});assert.equal(await f.controller.change('fil'),false);assert.equal(f.read().settings.interfaceLanguage,'ru');assert.equal(f.selector.value,'ru');assert.equal(f.errors.length,1);assert.ok(!f.events.includes('locked'));});
test('postcommit render failure closes medical interface without deleting committed language',async()=>{const f=fixture({rejectRender:true});assert.equal(await f.controller.change('fil'),false);assert.equal(f.read().settings.interfaceLanguage,'fil');assert.ok(f.events.includes('locked'));});
test('unknown language cannot reach confirmation or alter state',async()=>{const f=fixture();assert.equal(await f.controller.change('xx'),false);assert.deepEqual(f.events,[]);assert.equal(f.read().settings.interfaceLanguage,'ru');});
const vm=require('node:vm');
const guard=fs.readFileSync(path.join(__dirname,'../js/auth-guard.js'),'utf8');
test('public staging rejects bootstrap false before a language can commit',async()=>{
 const match=guard.match(/  async function stagePublicLocale\(language\)\{[\s\S]*?\n  \}/);
 assert.ok(match,'Auth guard must stage public locale independently of saved settings');
 const context=vm.createContext({TRANSLATIONS:{en:{}},window:{MedControlEntryLanguages:{registry:[{code:'fil'}]},MedControlLocaleBootstrap:{install:async()=>false},fetch:async()=>{}},loadScript:async()=>{},registerPreparedLanguage:()=>true});
 vm.runInContext(match[0],context);
 await assert.rejects(vm.runInContext("stagePublicLocale('fil')",context),/activation failed/);
});
test('every protected render resets direction from canonical saved language',()=>{
 const match=guard.match(/  function applyProtectedLocaleDirection\(language\)\{[\s\S]*?\n  \}/);
 assert.ok(match,'Auth guard must reset direction on every protected render');
 const context=vm.createContext({document:{documentElement:{}},window:{MedControlEntryLanguages:{registry:[{code:'ar',direction:'rtl'},{code:'fil',direction:'ltr'}]}}});
 vm.runInContext(match[0],context);
 vm.runInContext("applyProtectedLocaleDirection('ar')",context);assert.equal(context.document.documentElement.dir,'rtl');
 vm.runInContext("applyProtectedLocaleDirection('fil')",context);assert.equal(context.document.documentElement.dir,'ltr');assert.equal(context.document.documentElement.lang,'fil');
 assert.throws(()=>vm.runInContext("applyProtectedLocaleDirection('xx')",context),/Unsupported/);
});
test('locale render failure removes medical UI before locking and preserves localized failure',async()=>{
 const match=guard.match(/  async function closeProtectedLocaleFailure\(error,options=\{\}\)\{[\s\S]*?\n  \}/);
 assert.ok(match);
 const app={textContent:'Synthetic medical interface'},events=[];
 const context=vm.createContext({document:{getElementById:()=>app},window:{medcontrolProtectedLocaleFailureLabel:'Localized failure',MedControlModular3ProtectedSession:{lock:async()=>{events.push(app.textContent);}}}});
 vm.runInContext("let validatedActiveLanguage=null;"+match[0],context);await vm.runInContext("closeProtectedLocaleFailure(Error('load'))",context);
 assert.deepEqual(events,['Localized failure']);assert.equal(context.window.medcontrolProtectedLocaleRefreshError,'load');
});
test('protected startup failure locks session and displays selected catalog error without medical data',async()=>{
 const app={textContent:'Synthetic medical interface'},events=[];
 const context=vm.createContext({URL,URLSearchParams,console:{error(){}},document:{scripts:[],currentScript:{dataset:{page:'unknown'}},getElementById:()=>app},window:{medcontrolProtectedInterface:true,location:{href:'https://local.test/input.html'},MedControlProtectedUiCatalogs:{fil:{'Не удалось запустить MedControl. Локальные данные не удалялись.':'Selected catalog error'}},MedControlModular3ProtectedSession:{read:()=>({settings:{interfaceLanguage:'fil'}}),lock:async()=>events.push(app.textContent)}}});
 await vm.runInContext(guard,context);
 assert.deepEqual(events,['Selected catalog error']);
 assert.equal(app.textContent,'Selected catalog error');
 assert.match(context.window.medcontrolProtectedLocaleRefreshError,/Auth Guard/);
});
test('protected Settings search exposes all canonical96 including Filipino without consulting navigator',()=>{
 const registry=require('../js/modular3-entry-languages.js').registry;
 const target={children:[],replaceChildren(){this.children=[];},append(button){this.children.push(button);}};
 const search={setAttribute(){}};
 const document={getElementById:id=>id==='settingsLanguageMatches'?target:id==='settingsLanguageSearch'?search:null,createElement:()=>({setAttribute(){}})};
 const window={document,medcontrolProtectedInterface:true};
 const context=vm.createContext({window,document});
 vm.runInContext(fs.readFileSync(targetPath(),'utf8'),context);
 window.MedControlProtectedLocaleController.install({session:{read:()=>({settings:{interfaceLanguage:'ru'}})},policy:{registry},stage:async()=>{},render:async()=>{},failClosed:async()=>{}});
 window.filterMedControlLanguages('');assert.equal(target.children.length,96);
 assert.ok(target.children.some(button=>button.textContent==='№96 · Filipino'));
 window.filterMedControlLanguages('Filipino');assert.equal(target.children.length,1);assert.equal(target.children[0].textContent,'№96 · Filipino');
 function targetPath(){return path.join(__dirname,'../js/modular3-protected-locale-controller.js');}
});
test('protected English stages catalog keys without overwriting immutable built-in translations',async()=>{
 const match=guard.match(/  async function stagePublicLocale\(language\)\{[\s\S]*?\n  \}/);
 const original=Object.freeze({nav_action:'Intake'}),labels=Object.freeze({nav_action:'Medication intake'});
 const context=vm.createContext({TRANSLATIONS:{en:original},window:{MedControlEntryLanguages:{registry:[{code:'en'}]},MedControlLocaleBootstrap:{install:async({register})=>{const result=register(Object.freeze({language:'en',labels}));context.window.MedControlProtectedUiCatalogs={en:{}};return result;}},fetch:async()=>{}},loadScript:async()=>{},registerPreparedLanguage:()=>assert.fail('Immutable built-in English cannot be registered')});
 vm.runInContext(match[0],context);await vm.runInContext("stagePublicLocale('en')",context);
 assert.equal(context.TRANSLATIONS.en,original);assert.equal(original.nav_action,'Intake');
 assert.equal(context.window.MedControlProtectedRuntimeLabels?.en?.nav_action,'Medication intake');
});
test('protected tr renders staged English catalog keys and preserves the original RU renderer',()=>{
 let language='en';
 const original=key=>key==='nav_action'?'Intake':key;
 const window={document:{},medcontrolProtectedInterface:true,tr:original,MedControlProtectedRuntimeLabels:{en:Object.freeze({nav_action:'Medication intake'})}};
 const context=vm.createContext({window});vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modular3-protected-locale-controller.js'),'utf8'),context);
 window.MedControlProtectedLocaleController.install({session:{read:()=>({settings:{interfaceLanguage:language}})},policy:{registry:[]}});
 assert.equal(window.tr('nav_action'),'Medication intake');language='ru';assert.equal(window.tr('nav_action'),'Intake');
});
test('protected logical layout installs once across RTL to LTR renders and isolates free text direction',()=>{
 const api=require('../js/modular3-protected-locale-controller.js');
 assert.equal(typeof api.applyLayout,'function','Protected layout must be applied after actual page renders');
 const nodes=new Map(),styles=[];
 const free={type:'text',name:'name',id:'medName',setAttribute(key,value){this[key]=value;}};
 const time={type:'text',name:'time',id:'inputTime',setAttribute(key,value){this[key]=value;}};
 const number={type:'number',name:'dose',id:'dose',setAttribute(key,value){this[key]=value;}};
 const doc={documentElement:{dir:'rtl',setAttribute(){}},head:{append(style){styles.push(style);nodes.set(style.id,style);}},getElementById:id=>nodes.get(id),createElement:()=>({}),querySelectorAll:()=>[free,time,number]};
 api.applyLayout(doc);doc.documentElement.dir='ltr';api.applyLayout(doc);
 assert.equal(styles.length,1);assert.match(styles[0].textContent,/text-align:start/);assert.match(styles[0].textContent,/text-align:end/);assert.match(styles[0].textContent,/padding-inline-start/);
 assert.equal(free.dir,'auto');assert.equal(time.dir,'ltr');assert.equal(number.dir,'ltr');assert.equal(doc.documentElement.dir,'ltr');
});

test('native Hint channel uses all95 catalogs and preserves unknown/patient text and locked-session behavior',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/source-ru.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/manifest.json'),'utf8'));
 const bySource=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,id]));
 const catalogs={};
 for(const item of manifest.filter(x=>x.code!=='ru')){
  const messages=JSON.parse(fs.readFileSync(path.join(__dirname,'../locales/catalogs',item.code+'.json'),'utf8')).messages;
  catalogs[item.code]=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,messages[id]]));
 }
 let code='en',authorized=true,last;
 const session={read(){assert.ok(authorized,'Locked alert must not read encrypted settings');return {settings:{interfaceLanguage:code}};},isEntryAuthorized:()=>authorized};
 const document={documentElement:{},querySelectorAll:()=>[]};
 const window={document,medcontrolProtectedInterface:true,MedControlProtectedUiCatalogs:catalogs,alert:message=>{last=message;return 'native-return';},tr:key=>key==='hint_title'?(code==='ru'?'Подсказка':catalogs[code]['Подсказка']):key};
 const context=vm.createContext({window,document});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modular3-protected-locale-controller.js'),'utf8'),context);
 window.MedControlProtectedLocaleController.install({session,policy:{},stage:async()=>{},render:async()=>{},failClosed:async()=>{}});
 const hints=['Введите количественное содержание препарата.','Выберите единицу содержания.','Укажите другую единицу содержания.','Введите количество приёма.','Выберите единицу приёма.','Укажите другую единицу приёма.','Дата начала не заполнена.','Дата окончания не заполнена.','Выберите режим расписания.','Для изменения Расписания вначале отмените Расписание в разделе «Приём препаратов».','Для изменения времени приёма вначале отмените время приёма в разделе «Приём препаратов».'];
 for(const item of manifest.filter(x=>x.code!=='ru')){
  code=item.code;
  for(const hint of hints){assert.ok(bySource[hint]);assert.equal(window.alert(window.tr('hint_title')+'\n\n'+hint),'native-return');assert.equal(last,window.tr('hint_title')+'\n\n'+catalogs[code][hint],code+': '+hint);}
  const start='Подсказка\n\nВыбранная дата начала не соответствует дням недели расписания. Ближайшая допустимая дата начала: ⟦0⟧.';
  window.alert(start.replace('⟦0⟧','11/30/2026'));assert.equal(last,catalogs[code][start].replace('⟦0⟧','11/30/2026'));
  const end='Подсказка\n\nВыбранная дата окончания не соответствует дням недели расписания. Ближайшие допустимые даты: ⟦0⟧.';
  window.alert(end.replace('⟦0⟧','11/23/2026 или 11/30/2026'));assert.equal(last,catalogs[code][end].replace('⟦0⟧','11/23/2026 '+catalogs[code]['или']+' 11/30/2026'));
  const unknown=window.tr('hint_title')+'\n\nSYNTHETIC patient text: Статус';window.alert(unknown);assert.equal(last,unknown);
  window.alert('Препарат: Доза');assert.equal(last,'Препарат: Доза');
 }
 code='ru';const original='Подсказка\n\n'+hints[0];window.alert(original);assert.equal(last,original);
 code='en';authorized=false;window.alert(original);assert.equal(last,original);
});

test('catalog templates preserve patient captures and translate only explicitly typed UI slots',()=>{
 const api=require(target);
 const catalog={'История курса «⟦0⟧»':'Course history «⟦0⟧»','⟦0⟧ заменён':'⟦0⟧ replaced','Статус':'Status','Производитель':'Manufacturer'};
 assert.equal(api.formatMessage('История курса «Статус $&»',catalog),'Course history «Статус $&»');
 assert.equal(api.formatMessage('Производитель заменён',catalog,true),'Manufacturer replaced');
 assert.equal(api.formatMessage('Производитель заменён',catalog),'Производитель replaced');
 assert.equal(api.formatMessage('SYNTHETIC patient text: Статус',catalog),null);
 assert.equal(api.formatMessage('История курса «Статус»',undefined),null);
});
test('history ownership binds the preferred existing dialog, preserves returns and avoids duplicate wrappers',()=>{
 const archive={dataset:{}},fallback={dataset:{}},document={querySelector:selector=>selector==='#archiveHistoryDialog'?archive:selector==='#rowHistoryDialog'?fallback:null};
 const window={document,medcontrolProtectedInterface:true,showArchiveMedicationHistory(id){this.lastId=id;return 'original-result';}};
 const context=vm.createContext({window,document});vm.runInContext(fs.readFileSync(target,'utf8'),context);
 window.MedControlProtectedLocaleController.bindHistoryOwners();
 const wrapped=window.showArchiveMedicationHistory;
 assert.equal(wrapped.call(window,'synthetic-owner'),'original-result');assert.equal(window.lastId,'synthetic-owner');
 assert.equal(archive.dataset.medcontrolHistoryOwner,'synthetic-owner');assert.equal(archive.dataset.medcontrolHistoryKind,'archive');assert.equal(fallback.dataset.medcontrolHistoryOwner,undefined);
 window.MedControlProtectedLocaleController.bindHistoryOwners();assert.equal(window.showArchiveMedicationHistory,wrapped);
 const replacement=function(){return false;};window.showArchiveMedicationHistory=replacement;
 window.medcontrolProtectedInterface=false;window.MedControlProtectedLocaleController.bindHistoryOwners();assert.equal(window.showArchiveMedicationHistory,replacement);
});
