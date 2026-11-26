'use strict';
const {test,expect}=require('@playwright/test');
const BASE=process.env.MEDCONTROL_REHEARSAL_BASE||'http://127.0.0.1:8765';
const PASS='Synthetic-Rehearsal-Locale-2026';
for(const code of ['en','ar'])test('rehearsal authored UI uses '+code+' while Cyrillic medical content stays unchanged',async({browser})=>{
 const context=await browser.newContext({locale:'fr-FR',timezoneId:'UTC',serviceWorkers:'block'});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
  await page.goto(BASE+'/modular3-protected.html?rehearsal=1');
  await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
  const initial=await page.evaluate(async({code,PASS})=>{
   const day='2026-11-24';
   const med={id:'synthetic-locale',name:'Принято',manufacturer:'Производитель',details:'Детали',contentValue:'1',contentUnit:'мг',intakeQuantity:'1',intakeUnit:'таблетка',active:true,scheduleType:'weekdays',weekdays:['Tue'],startDate:day,endDate:day,times:['09:00','18:00'],rowHistory:[{action:'created',at:day+'T08:00:00Z'},{action:'times_changed',at:day+'T08:00:00Z',previousTimes:['07:00','18:00'],newTimes:['09:00','18:00']},{action:'details_changed',at:day+'T08:00:00Z',previous:{details:'Название'},next:{details:'Детали'}},{action:'edited',at:day+'T08:00:00Z',details:'Произвольная заметка пользователя'}]};
   const archived={...med,id:'synthetic-archive',name:'Архив',active:false,cancelled:true};
   const intake={id:'synthetic-taken',medicationId:med.id,plannedAt:day+'T09:00:00.000Z',actualAt:day+'T09:05:00Z',action:'taken'};
   await MedControlModular3ProtectedSession.initialize({settings:{timezone:'UTC'},medications:[med,archived],intakeLogs:[intake]},PASS);
   await MedControlEntryLanguages.confirm(MedControlModular3ProtectedSession,code);
   const saved=MedControlModular3ProtectedSession.read();
   await MedControlModular3ProtectedSession.lock();return saved;
  },{code,PASS});
  await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('html')).toHaveAttribute('dir',code==='ar'?'rtl':'ltr');
  const raw=async()=>page.locator('#screen').evaluate(screen=>{
   const result=[];const walker=document.createTreeWalker(screen,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){
    const node=walker.currentNode,text=node.textContent.trim();
    if(!text||node.parentElement.closest('article > h3,[data-medcontrol-user-content]'))continue;
    if(/[А-Яа-яЁё]/.test(text))result.push(text);
   }
   for(const el of screen.querySelectorAll('[aria-label],[title],[placeholder]'))for(const key of ['aria-label','title','placeholder'])if(/[А-Яа-яЁё]/.test(el.getAttribute(key)||''))result.push(key+': '+el.getAttribute(key));
   return result;
  });
  expect(await raw(),'all authored Input labels, hints, history and attributes translated').toEqual([]);
  await expect(page.locator('article > h3').first()).toHaveText('Принято');
  const date=new Intl.DateTimeFormat(code,{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date('2026-11-24T12:00:00Z'));
  await expect(page.locator('article > p').first()).toContainText(date);
  const dialogs=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  const catalog=require('../locales/catalogs/'+code+'.json');
  const source=require('../locales/source-ru.json');
  const translated=text=>catalog.messages[Object.keys(source).find(id=>source[id].source===text)];
  await expect(page.locator('#screen > form label').filter({has:page.locator('input[name="name"]')})).toHaveText(translated('Название препарата'));
  await expect(page.locator('#screen > form .protected-save-course')).toHaveText(translated('Добавить'));
  await expect(page.locator('article').first()).toContainText('Название');
  await expect(page.locator('article').first()).toContainText('Произвольная заметка пользователя');
  const cancelId=Object.keys(source).find(id=>source[id].source==='Отменить препарат');
  await page.locator('article').first().getByRole('button',{name:catalog.messages[cancelId],exact:true}).click();
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain('Принято');
  expect(dialogs[0].replace('Принято','')).not.toMatch(/[А-Яа-яЁё]/);

  await expect(page.locator('article input[name="manufacturer"]').first()).toHaveValue('Производитель');
  await page.locator('#screen > form select[name="scheduleType"]').selectOption('weekdays');
  const weekday=await page.locator('#screen > form input[value="Mon"]').evaluate(el=>el.parentElement.textContent.trim());
  expect(weekday).toBe(new Intl.DateTimeFormat(code,{weekday:'short',timeZone:'UTC'}).format(new Date('2026-11-23T12:00:00Z')));
  await page.locator('#screen > form .protected-time-controls select').first().selectOption('10');
  await page.locator('#screen > form .protected-time-controls button').click();
  expect(await raw(),'newly added chip aria label translated').toEqual([]);
  for(const section of ['action','dashboard','archive']){
   await page.locator('[data-tab="'+section+'"]').click();
   expect(await raw(),section+' authored system strings translated').toEqual([]);
   await expect(page.locator('#screen > h2')).toHaveText(translated({action:'Приём препаратов',dashboard:'Табло',archive:'Архив'}[section]));
  }
  const saved=await page.evaluate(()=>MedControlModular3ProtectedSession.read());
  expect(saved).toEqual(initial);
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>window.medcontrolRehearsalLocaleError)).toBeUndefined();
 }finally{await context.close();}
});

// The reference is the existing shared help dictionary, not the alternate renderer.
// Assert every label and description, not just the existence of a language option.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helperSource=fs.readFileSync(path.join(__dirname,'../js/modular3-action-help.js'),'utf8');
const dictionaryStart=helperSource.indexOf('const texts=')+'const texts='.length;
const dictionaryEnd=helperSource.indexOf(';\n function render',dictionaryStart);
const helpReference=vm.runInNewContext('('+helperSource.slice(dictionaryStart,dictionaryEnd)+')');
const registry=require('../locales/manifest.json');
const selected=process.env.MEDCONTROL_REHEARSAL_CODES?.split(',');
for(const language of registry.filter(item=>!selected||selected.includes(item.code)))test('rehearsal shared help, four sections and offline restart '+language.code,async({},info)=>{
 test.setTimeout(90000);
 const {chromium}=require('@playwright/test');
 const code=language.code,profile=info.outputPath('synthetic-profile');let context;
 const keys=['medcontrol_modular3_protected_state_v1','medcontrol_modular3_local_credential_v1'];
 const stored=page=>page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),keys);
 const start=async offline=>{
  context=await chromium.launchPersistentContext(profile,{...(info.project.use.launchOptions||{}),headless:true,locale:'de-DE',timezoneId:'Asia/Yerevan',offline});
  await context.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
  const page=await context.newPage();await page.goto(BASE+'/modular3-protected.html?rehearsal=1');
  await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);return page;
 };
 const source=require('../locales/source-ru.json');
 const messages=code==='ru'?Object.fromEntries(Object.entries(source).map(([id,row])=>[id,row.source])):require('../locales/catalogs/'+code+'.json').messages;
 const translate=text=>messages[Object.keys(source).find(id=>source[id].source===text)];
 const check=async page=>{
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('html')).toHaveAttribute('dir',language.direction);
  const panel=page.locator('#action-semantics-help');
  for(const section of ['input','action','dashboard','archive']){
   await page.locator('[data-tab="'+section+'"]').click();
   await expect(page.locator('#screen > h2')).toHaveText(translate({input:'Ввод',action:'Приём препаратов',dashboard:'Табло',archive:'Архив'}[section]));
   await expect(panel).toBeVisible();await panel.locator('summary').click();
   await expect(panel.locator('dt')).toHaveText(Array.from(helpReference[code],pair=>pair[0]));
   await expect(panel.locator('dd')).toHaveText(Array.from(helpReference[code],pair=>pair[1]));
   await expect(panel.locator('summary')).toHaveText(helpReference[code][0][0]+' / '+helpReference[code][1][0]+' — '+code.toUpperCase());
   await panel.locator('summary').click();
  }
 };
 try{
  let page=await start(false);
  await page.evaluate(async({PASS,code})=>{
   const day='2026-11-26';
   const med={id:'synthetic-help',name:'TEST-HELP-001',details:'Synthetic only',contentValue:'1',contentUnit:'mg',intakeQuantity:'1',intakeUnit:'tablet',active:true,scheduleType:'daily',startDate:day,endDate:'2026-11-27',times:['12:00'],rowHistory:[]};
   await MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan'},medications:[med],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]},PASS);
   await MedControlEntryLanguages.confirm(MedControlModular3ProtectedSession,code);await MedControlModular3ProtectedSession.lock();
  },{PASS,code});
  const before=await stored(page);expect(before.every(value=>typeof value==='string'&&value.length>0)).toBe(true);
  await page.reload();await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page.locator('#workspace')).toBeVisible();
  await check(page);expect(await stored(page)).toEqual(before);
  await page.waitForFunction(async()=>{
   if(!navigator.serviceWorker.controller)return false;
   const cache=await caches.open('medcontrol-static-modular3-v16');return !!await cache.match('/js/modular3-action-help.js');
  });
  await context.close();context=null;
  page=await start(true);await page.locator('#password').fill(PASS);await page.locator('#unlock').click();await expect(page.locator('#workspace')).toBeVisible();
  await check(page);expect(await stored(page)).toEqual(before);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read().medications[0].name)).toBe('TEST-HELP-001');
 }finally{await context?.close();}
});
