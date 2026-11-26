const {test,expect}=require('@playwright/test');
const registry=require('../locales/manifest.json'),source=require('../locales/source-ru.json');
const BASE=process.env.MEDCONTROL_SYSTEM_BASE||'http://127.0.0.1:8765',PASS='Synthetic-Import-Local-2026',FILE_PASS='Synthetic-Import-File-2026';
const selected=process.env.MEDCONTROL_SYSTEM_CODES?.split(',');
const ids=Object.fromEntries(Object.entries(source).map(([key,row])=>[row.source,key]));
for(const {code}of registry.filter(x=>!selected||selected.includes(x.code)))test('existing-vault import confirmation selected '+code+' preserves source and pair',async({browser})=>{
 const context=await browser.newContext({locale:'de-DE',serviceWorkers:'block'}),page=await context.newPage(),dialogs=[];
 page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 const messages=code==='ru'?Object.fromEntries(Object.entries(source).map(([k,row])=>[k,row.source])):require('../locales/catalogs/'+code+'.json').messages;
 const t=text=>messages[ids[text]];
 try{
  await page.goto(BASE+'/modular3-protected.html');await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
  const transfer=await page.evaluate(async({PASS,FILE_PASS,code})=>{
   const blank={settings:{timezone:'Asia/Yerevan',interfaceLanguage:code,languageChoiceConfirmed:true,languageConfirmationVersion:1,infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],archivedCourses:[],timeHistory:[]};
   await MedControlModular3ProtectedSession.initialize({...blank,medications:[{id:'old',name:'SYNTHETIC OLD'}]},PASS);await MedControlEntryLanguages.restore(MedControlModular3ProtectedSession);
   const incoming={...blank,medications:[{id:'incoming',name:'SYNTHETIC INCOMING'}],intakeLogs:[{id:'event',medicationId:'incoming',action:'taken'}]};
   const file=JSON.stringify({format:'medcontrol-encrypted-transfer-v1',encrypted:await MedControlModular3EncryptedVault.seal(incoming,FILE_PASS)});
   await MedControlModular3ProtectedSession.lock();localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify({synthetic:true,untouched:[0,false,null]}));return file;
  },{PASS,FILE_PASS,code});
  // Deliberately test old installations without a public language display hint.
  await page.evaluate(()=>localStorage.removeItem('medcontrol_modular3_entry_display_locale_v1'));
  await page.reload();await expect(page.locator('#unlock')).toBeEnabled();
  const before=await page.evaluate(()=>({cipher:localStorage.getItem('medcontrol_modular3_protected_state_v1'),credential:localStorage.getItem('medcontrol_modular3_local_credential_v1'),source:localStorage.getItem('affixo_medcontrol_standard_v3')}));
  await page.locator('#password').fill(PASS);await page.locator('#transfer-password').fill(FILE_PASS);await page.locator('#legacy-backup').setInputFiles({name:'synthetic-transfer.json',mimeType:'application/json',buffer:Buffer.from(transfer)});
  await page.locator('#inspect-migration').click();await expect(page.locator('#inspect-migration')).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('lang',code);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
  await page.locator('#import-backup').click();await expect.poll(()=>dialogs.length).toBe(1);
  const expected=t('Перенести из файла')+' 1 '+t('курсов и')+' 1 '+t('событий приёма в рабочее хранилище?\nТекущее хранилище (')+'1 '+t('курсов;')+' 0 '+t('событий) сначала сохранится отдельной зашифрованной копией. Её можно будет скачать.\nПароль входа останется прежним. Исходный Modular-2 и файл переноса не изменяются.');
  expect(dialogs[0]).toBe(expected);
  expect(await page.evaluate(()=>({cipher:localStorage.getItem('medcontrol_modular3_protected_state_v1'),credential:localStorage.getItem('medcontrol_modular3_local_credential_v1'),source:localStorage.getItem('affixo_medcontrol_standard_v3')}))).toEqual(before);
  expect(await page.evaluate(()=>MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
  expect(await page.evaluate(()=>MedControlModular3CopyMigration.listPreservedBackups())).toEqual([]);
 }finally{await context.close();}
});
