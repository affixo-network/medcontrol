const {test,expect}=require('@playwright/test');
const registry=require('../locales/manifest.json'),source=require('../locales/source-ru.json');
const BASE=process.env.MEDCONTROL_SYSTEM_BASE||'http://127.0.0.1:8765',PASS='Synthetic-System-Dialogs-2026';
const selected=process.env.MEDCONTROL_SYSTEM_CODES?.split(',');
const SRC=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,id]));
for(const {code} of registry.filter(x=>!selected||selected.includes(x.code)))test('owned native dialogs preserve selected '+code+' and opaque medical values',async({browser})=>{
 test.setTimeout(120000);const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE'}),page=await context.newPage();
 const messages=code==='ru'?Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.source])):require('../locales/catalogs/'+code+'.json').messages;
 const text=s=>messages[SRC[s]];const dialogs=[];let confirmations=0;
 page.on('dialog',async d=>{dialogs.push({kind:d.type(),message:d.message()});if(d.type()==='confirm'&&++confirmations<3)await d.accept();else await d.dismiss();});
 try{
  await page.goto(BASE+'/modular3-protected.html');await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
  await page.evaluate(async({PASS,code})=>{await MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:code,languageChoiceConfirmed:true,languageConfirmationVersion:1,infoDismissed:true},medications:[{id:'synthetic-system',name:'Принято TEST-OPAQUE',manufacturer:'Synthetic only',details:'Synthetic only',contentValue:'1',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',active:true,scheduleType:'daily',times:['12:00','13:00'],startDate:'2026-11-26',endDate:'2026-11-27',rowHistory:[]}],intakeLogs:[{id:'synthetic-log',medicationId:'synthetic-system',plannedAt:'2026-11-26T13:00:00.000Z',actualAt:'2026-11-26T13:01:00.000Z',action:'taken'}],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]},PASS);await MedControlModular3ProtectedSession.lock();},{PASS,code});
  await page.reload();await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page).toHaveURL(BASE+'/input.html');await expect(page.locator('.topbar')).toBeVisible();
  const pair=()=>page.evaluate(()=>[localStorage.getItem('medcontrol_modular3_protected_state_v1'),localStorage.getItem('medcontrol_modular3_local_credential_v1')]);let before=await pair();expect(before.every(Boolean)).toBe(true);
  await page.evaluate(()=>window.alert('Нет записей'));expect(dialogs.pop().message).toBe('Нет записей');
  await page.evaluate(()=>showMedicationHint('schedule_no_future_intake'));
  expect(dialogs.pop().message).toBe(text('Расписание не может быть сохранено.')+'\n\n'+text('После текущего момента и до окончания курса нет ни одного будущего расчётного приёма.')+'\n\n'+text('Проверьте дату окончания, дни недели / даты и время приёма.'));
  await page.evaluate(()=>{window.__a1ConflictTimes=['12:00'];showMedicationHint('schedule_retroactive_time_edit');});
  expect(dialogs.pop().message).toBe(text('Изменение не сохранено.')+'\n\n'+text('Добавляется уже прошедшее расчётное время текущего дня: ⟦0⟧.').replace('⟦0⟧','12:00')+'\n\n'+text('Изменение действует онлайн и не может создавать новые расчётные приёмы задним временем.'));

  await page.evaluate(()=>editMedicationTimeStatus('synthetic-system','12:00'));
  await page.locator('#timeEditHour').selectOption('13');await page.locator('[onclick="saveInputTimeEditV4()"]').click();
  await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs.pop().message).toBe(text('Такое время уже существует.'));
  await page.locator('#timeStatusEditDialog button[onclick*=".close()"]').click();expect(await pair()).toEqual(before);
  await page.addScriptTag({url:BASE+'/js/correction-cancel-taken-policy.js'});
  await page.evaluate(()=>openCorrection('synthetic-system','2026-11-26T12:00:00.000Z'));
  await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs.pop().message).toBe(text('Сначала необходимо зафиксировать «Принято».'));
  await page.evaluate(()=>{const original=window.canCorrectIntakeNow;window.canCorrectIntakeNow=()=>false;try{openCorrection('synthetic-system','2026-11-26T13:00:00.000Z');}finally{window.canCorrectIntakeNow=original;}});
  await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs.pop().message).toBe(text('Окно исправления закрыто.'));expect(await pair()).toEqual(before);

  await page.locator('[onclick="openEditMedication(\'synthetic-system\')"]').click();await page.locator('[data-medication-cancel]').click();
  expect(dialogs).toHaveLength(3);
  const first=[text('Вы собираетесь отменить приём препарата «⟦0⟧».').replace('⟦0⟧','Принято TEST-OPAQUE'),'\n\n',text('Текущее расписание: ⟦0⟧.').replace('⟦0⟧',text('Каждый день')),'\n\n',text('Важно: «Отменено» отличается от статуса «Пассивно».'),'\n',text('Пассивно — временная остановка с возможностью продолжения.'),'\n',text('Отменено — окончательное завершение этой карточки препарата.'),'\n\n',text('Продолжить?')].join('');
  const dates=await page.evaluate(()=>formatDate('2026-11-26')+' → '+formatDate('2026-11-27'));
  const second=text('Подтвердите прекращение действия дат приёма.')+'\n\n'+text('Текущий период / даты:\n⟦0⟧').replace('⟦0⟧',dates)+'\n\n'+text('После отмены эта карточка больше не будет использоваться')+' '+text('для дальнейшего приёма.')+'\n\n'+text('Продолжить?');
  const third=text('ФИНАЛЬНОЕ ПОДТВЕРЖДЕНИЕ')+'\n\n'+text('Препарат: ⟦0⟧').replace('⟦0⟧','Принято TEST-OPAQUE')+'\n'+text('Статус будет установлен: Отменено')+'\n\n'+text('Все ранее введённые данные и история сохранятся,')+'\n'+text('но эта карточка будет окончательно закрыта.')+'\n\n'+text('Если в будущем вы снова начнёте принимать этот препарат,')+'\n'+text('необходимо будет создать новую карточку и новую историю.')+'\n\n'+text('Подтвердить отмену?');
  expect(dialogs.map(d=>d.message)).toEqual([first,second,third]);
  expect(await pair()).toEqual(before);
  dialogs.length=0;
  await page.evaluate(()=>{window.__originalDraftFlush=window.medControlInputDraft.flush;window.medControlInputDraft.flush=async()=>{throw Error('Synthetic write failure');};});
  await page.locator('.topbar a[href="dashboard.html"]').click();await expect.poll(()=>dialogs.length).toBe(1);
  expect(dialogs[0].message).toBe(text('Не удалось сохранить черновик. Форма остаётся открытой.')+(code==='ru'?' Synthetic write failure':''));expect(await pair()).toEqual(before);
  await page.evaluate(()=>{window.medControlInputDraft.flush=window.__originalDraftFlush;window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='medcontrol_modular3_protected_state_v1')throw Error('Synthetic write failure');return window.__originalSetItem.call(this,key,value);};});
  dialogs.length=0;
  await page.evaluate(async()=>{try{const next=getState();next.settings.country='Synthetic';await saveStateAsync(next);}catch(_){}});
  await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs[0].message).toBe(text('Не удалось сохранить изменения. Предыдущие данные сохранены.')+(code==='ru'?'\nSynthetic write failure':''));expect(await pair()).toEqual(before);
  dialogs.length=0;await page.evaluate(async()=>{await window.confirmMedicationCreate();});await expect.poll(()=>dialogs.length).toBe(1);
  expect(dialogs[0].message).toBe(text('Не удалось сохранить препарат. Изменения не подтверждены.')+(code==='ru'?' Synthetic write failure':''));expect(await pair()).toEqual(before);
  await page.evaluate(async()=>{Storage.prototype.setItem=window.__originalSetItem;await MedControlModular3ProtectedSession.transact(state=>{state.medications[0].archivedCompleted=true;state.medications[0].courseCompleted=true;state.medications[0].active=false;delete state.inputDraft;});await window.mount('input');});
  before=await pair();dialogs.length=0;
  await page.locator('[onclick="manualMedControlCycleReset()"]').click();await expect.poll(()=>dialogs.length).toBe(1);
  const warning='Начать заново? Все медицинские записи, история и архив будут безвозвратно удалены. Отменить удаление после подтверждения невозможно.';
  expect(dialogs[0]).toEqual({kind:'confirm',message:await page.evaluate(warning=>MedControlSystemDialogMessages[document.documentElement.lang][warning],warning)});expect(await pair()).toEqual(before);
  if(code!=='ru'){
   await page.evaluate(()=>{window.__savedSystemMessages=window.MedControlSystemDialogMessages;window.MedControlSystemDialogMessages={};});dialogs.length=0;
   await page.locator('[onclick="manualMedControlCycleReset()"]').click();await expect.poll(()=>dialogs.length).toBe(1);expect(dialogs[0]).toEqual({kind:'alert',message:'MedControl'});expect(await pair()).toEqual(before);
   await page.evaluate(()=>{window.MedControlSystemDialogMessages=window.__savedSystemMessages;});
  }
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;window.medControlInputDraft.flush=async()=>{await MedControlModular3ProtectedSession.lock();throw Error('Synthetic write failure');};});dialogs.length=0;
  await page.locator('[data-medcontrol-logout]').click();await expect.poll(()=>dialogs.length).toBe(1);
  expect(dialogs[0].message).toBe(text('Последние изменения черновика не сохранены. Данные будут заблокированы.')+(code==='ru'?' Synthetic write failure':''));await expect(page.locator('#password')).toBeVisible();expect(await pair()).toEqual(before);
 }finally{await context.close();}
});

test('supplemental administrative warnings cover exactly the canonical96 and preserve RU',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),host={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/modular3-system-dialog-messages.js'),'utf8'),{window:host});
 const rows=host.MedControlSystemDialogMessages;
 expect(Object.keys(rows).sort()).toEqual(registry.map(x=>x.code).sort());
 const keys=Object.keys(rows.ru);expect(keys).toHaveLength(2);
 expect(keys).toEqual(['Начать заново? Все медицинские записи, история и архив будут безвозвратно удалены. Отменить удаление после подтверждения невозможно.','Медицинские записи сброшены, но переход в раздел «Ввод» не выполнен. Откройте раздел вручную.']);
 for(const {code}of registry){
  expect(Object.keys(rows[code])).toEqual(keys);for(const key of keys)expect(rows[code][key].trim().length).toBeGreaterThan(0);
  if(code==='ru')for(const key of keys)expect(rows.ru[key]).toBe(key);
  if(code!=='ru'&&code!=='en')for(const key of keys){expect(rows[code][key]).not.toBe(rows.ru[key]);expect(rows[code][key]).not.toBe(rows.en[key]);}
  const nav=code==='ru'?'Ввод':require('../locales/catalogs/'+code+'.json').messages['2641301ae19af731'];
  expect(rows[code][keys[1]]).toContain(nav);
 }
});
