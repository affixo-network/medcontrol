'use strict';
// Real enrollment and medical UI, persistent browser profiles, and disconnected
// restarts. No seeded vaults, mocked catalogs, or route fulfillment.
const {test, expect, chromium} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../locales/manifest.json');
const source = require('../locales/source-ru.json');
const PASS = 'Synthetic-96-Local-Password-2026';
const SOURCE_IDS=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,id]));
const catalogText=(code,text)=>messages(code)[SOURCE_IDS[text]];
const SECTIONS = ['input', 'action', 'dashboard', 'archive'];
const NAV_IDS = {input:'2641301ae19af731', action:'6a543025d854b29c', dashboard:'67f955e0e8892d65', archive:'3c54b5e783ef6052'};
const TITLE_IDS = {input:'87a2b9ea146d476e', action:'f45170df6a0828f5', dashboard:'0fe132872b85f083', archive:'78aca0cace982b30'};
// Diagnostic subsets are explicit in the report; the default always runs 96.
const diagnostic = process.env.MEDCONTROL_ENTRY96_CODES?.split(',').filter(Boolean);
if (diagnostic?.some(code => !manifest.some(item => item.code === code))) throw Error('Unknown diagnostic language');
const languages = diagnostic ? manifest.filter(item => diagnostic.includes(item.code)) : manifest;
function messages(code) {
  return code === 'ru' ? Object.fromEntries(Object.entries(source).map(([id, row]) => [id, row.source]))
    : JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/catalogs', code + '.json'), 'utf8')).messages;
}
async function state(page) { return page.evaluate(() => getState()); }
function medical(value) {
  return Object.fromEntries(['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses'].map(key => [key, value[key] || []]));
}
async function navigate(page, base, section) {
  await page.locator('.topbar .nav a[href="' + section + '.html"]').click();
  await expect(page).toHaveURL(base + '/' + section + '.html');
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.topbar .nav a.active')).toHaveAttribute('href',section+'.html');
}
async function assertLocale(page, language) {
  await expect(page.locator('.topbar')).toBeVisible({timeout:20000});
  const catalog = messages(language.code);
  await expect(page.locator('html')).toHaveAttribute('lang', language.code);
  await expect(page.locator('html')).toHaveAttribute('dir', language.direction);
  const section = new URL(page.url()).pathname.split('/').pop().replace('.html', '');
  await expect(page.locator('.topbar .nav a.active')).toHaveAttribute('href',section+'.html');
  // The legacy shell appends its colon; Archive catalogs the whole caption.
  const metadata=section==='archive'
    ? [['#topCurrentDate','9e3155cc798e53c1'],['#topCurrentTime','110913d36234c4e3']]
    : [['#topCurrentDate','8df2040160ce7336'],['#topCurrentTime','727721a75694fd16']];
  for(const [selector,id] of metadata){
    await expect(page.locator(selector).locator('..')).toContainText(catalog[id]);
  }
  await expect(page.locator('.topbar .meta .pill').filter({hasText:'Asia/Yerevan'})).toContainText(catalog[section==='archive'?'2db0c625b694bc0f':'ce2e24e73ac44e1c']);
  await expect(page).toHaveTitle(catalog[TITLE_IDS[section]]);
  await expect.poll(() => page.evaluate(() => getState().settings.interfaceLanguage)).toBe(language.code);
  expect(await page.evaluate(() => MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(true);
  const selector = page.locator('.topbar select[onchange*="changeInterfaceLanguage"]');
  // Archive's established read-only shell has no language picker. Its saved
  // locale, active translations, navigation, title and direction still must match.
  if (section !== 'archive') await expect(selector).toHaveValue(language.code);
  for (const section of SECTIONS) {
    await expect(page.locator('.topbar .nav a[href="' + section + '.html"]')).toHaveText(catalog[NAV_IDS[section]]);
  }
  // Compare the active runtime lookup to actual published catalog strings,
  // rather than accepting document.lang alone as localization evidence.
  const translated = await page.evaluate(() => ['nav_input','nav_action','nav_dashboard'].map(key => tr(key)));
  expect(translated).toEqual([catalog[NAV_IDS.input], catalog[NAV_IDS.action], catalog[NAV_IDS.dashboard]]);
}
async function assertVisibleEnglish(page){
 if(await page.locator('html').getAttribute('lang')!=='en')return;
 const russian=()=>page.evaluate(()=>{
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),out=[];
  while(walker.nextNode()){
   const n=walker.currentNode,p=n.parentElement;
   if(!p||p.closest('script,style,select,option')||!/[А-Яа-яЁё]/.test(n.nodeValue))continue;
   if(p.closest('dialog')&&!p.closest('dialog').open)continue;
   const range=document.createRange();range.selectNodeContents(n);if(range.getBoundingClientRect().height)out.push(n.nodeValue.trim());
  }return out;
 });
 await expect.poll(russian,{message:'These synthetic fixtures use Latin patient text; visible Russian is untranslated UI'}).toEqual([]);
}
async function createCourse(page, name) {
  for (const [field, value] of Object.entries({name,manufacturer:'Synthetic Factory',contentValue:'1'})) {
    await page.locator('#create_' + field).fill(value);
  }
  await page.locator('#create_contentUnit').selectOption('mg');
  await page.locator('#create_intakeQuantity').fill('1');
  await page.locator('#create_intakeUnit').selectOption('tablet');
  await page.locator('#create_details').fill('Synthetic 96-language UI course');
  await page.locator('#create_scheduleType').selectOption('daily');
  for (const hour of ['13', '14']) {
    await page.locator('#create_timeHour').selectOption(hour);
    await page.locator('#create_timeMinute').selectOption('00');
    // The existing sequence controller replaces inline handlers with delegated
    // data attributes after rendering. Click the real controller-owned button.
    await page.locator('button[data-med-sequence-action="add-time"]').click();
  }
  await page.locator('#create_startDate').fill('2026-11-24');
  await page.locator('#create_endDate').fill('2026-11-24');
  await page.locator('#createMedicationButton').click();
  await expect(page.locator('#medicationConfirmDialog')).toBeVisible();
  const code=await page.locator('html').getAttribute('lang'),catalog=messages(code);
  const label=text=>catalog[Object.keys(source).find(id=>source[id].source===text)];
  const rows=page.locator('#medicationConfirmContent table tr');
  for(const [index,text] of [[1,'Производитель'],[2,'Количественное содержание'],[3,'Доза']])await expect(rows.nth(index).locator('td').first()).toHaveText(label(text));
  await expect(rows.nth(2).locator('td').last()).toHaveText('1 '+label('мг'));
  await expect(rows.nth(3).locator('td').last()).toHaveText('1 '+label('таблетка'));
  await expect(page.locator('#medicationConfirmContent [data-confirm-status] td').first()).toHaveText(label('Статус'));
  await expect(page.locator('#medicationConfirmContent [data-confirm-status] td').last()).toHaveText(label('Активно'));
  await expect(rows.nth(0).locator('td').last()).toHaveText(name);
  console.log('[entry96 '+code+'] confirmation locale verified');
  expect((await state(page)).medications).toHaveLength(0);
  await assertVisibleEnglish(page);

  await page.locator('#medicationConfirmDialog button[onclick="proceedMedicationCreateConfirmation()"] ').click();
  await expect(page.locator('#medicationSaveDialog')).toBeVisible();
  await page.locator('#medicationSaveDialog button[onclick="confirmMedicationCreate()"] ').click();
  await expect.poll(async () => (await state(page)).medications.filter(item => item.name === name).length).toBe(1);
  const course = (await state(page)).medications.find(item => item.name === name);
  expect(course.times).toEqual(['13:00','14:00']);
  return course.id;
}

for (const language of languages) {
  test('complete protected language ' + language.id + '/96 ' + language.code, async ({}, info) => {
    test.setTimeout(240000);
    const base = String(info.project.use.baseURL || 'http://127.0.0.1:8765').replace(/\/$/, '');
    const next = manifest[language.id % manifest.length];
    const profile = info.outputPath('persistent-profile');
    const records = [], errors = [], external = [], nativeDialogs=[];
    let dialogLanguage=null;
    let context;
    const progress = stage => console.log('[entry96 ' + language.code + '] ' + stage);
    async function launch(offline) {
      const launchOptions = info.project.use.launchOptions || {};
      context = await chromium.launchPersistentContext(profile, {
        ...launchOptions, headless:true,
        ...(process.env.MEDCONTROL_CHROMIUM ? {executablePath:process.env.MEDCONTROL_CHROMIUM} : {}),
        locale:next.code, timezoneId:'Asia/Yerevan', offline, serviceWorkers:'allow',
      });
      context.setDefaultTimeout(15000);
      await context.addInitScript(()=>{
        window.__entryDeviceReads=0;
        for(const property of ['language','languages']){
          const native=Object.getOwnPropertyDescriptor(Navigator.prototype,property)?.get;
          if(native)Object.defineProperty(navigator,property,{configurable:true,get(){window.__entryDeviceReads++;return native.call(navigator);}});
        }
      });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) { external.push(url.href); return route.abort(); }
        return route.continue();
      });
      context.on('page', page => {
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => {nativeDialogs.push({language:dialogLanguage,type:dialog.type(),message:dialog.message()});dialog.accept();});
      });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
      return page;
    }
    async function visitAll(page, selected, phase, expected) {
      for (const section of SECTIONS) {
        await navigate(page, base, section);
        await assertLocale(page, selected);
        await assertVisibleEnglish(page);
        expect(medical(await state(page))).toEqual(expected);
        const record = {language:language.code, selected:selected.code, section, phase, pass:true};
        records.push(record);
        await info.attach(language.code + '-' + phase + '-' + section, {body:Buffer.from(JSON.stringify(record)), contentType:'application/json'});
      }
    }
    async function restartAndUnlock(selected,offline=true) {
      progress('closing browser and restarting '+(offline?'disconnected':'via local HTTP')+': '+selected.code);
      await context.close(); // Closes the entire persistent Chromium process.
      const page = await launch(offline); // Offline runs disconnect BEFORE navigation.
      await page.goto(base + '/modular3-protected.html');
      await expect(page.locator('#entry-language-step')).toBeHidden();
      await expect(page.locator('.topbar')).toHaveCount(0);
      await page.locator('#password').fill(PASS);
      await page.locator('#unlock').click();
      await expect(page).toHaveURL(base + '/input.html');
      await expect(page.locator('#entry-language-step')).toHaveCount(0);
      await expect(page.locator('#medcontrolFirstLanguageDialog')).toHaveCount(0);
      await assertLocale(page, selected);
      return page;
    }
    try {
      progress('enrollment');
      let page = await launch(false);
      await page.goto(base + '/modular3-protected.html');
      await expect(page.locator('#entry-language-step')).toBeHidden();
      await expect(page.locator('#confirm-password-label')).toBeHidden();
      expect(await page.evaluate(()=>window.__entryDeviceReads)).toBe(0);
      await page.locator('#password').fill(PASS);
      await page.locator('#enroll').click();
      expect(await page.evaluate(()=>window.__entryDeviceReads)).toBe(0);
      await page.locator('#confirm-password').fill(PASS);
      await page.locator('#enroll').click();
      await expect(page.locator('#entry-language-step')).toBeVisible();
      expect(await page.evaluate(()=>window.__entryDeviceReads)).toBeGreaterThan(0);
      const pendingPair=await page.evaluate(()=>({cipher:localStorage.getItem('medcontrol_modular3_protected_state_v1'),credential:localStorage.getItem('medcontrol_modular3_local_credential_v1')}));
      progress('full restart before language confirmation');
      await context.close();
      page=await launch(false);
      await page.goto(base+'/modular3-protected.html');
      await expect(page.locator('#unlock')).toBeEnabled();
      expect(await page.evaluate(()=>window.__entryDeviceReads)).toBe(0);
      await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
      await expect(page.locator('#entry-language-step')).toBeVisible();
      await expect(page.locator('#existing-import')).toBeHidden();
      expect(await page.evaluate(()=>({cipher:localStorage.getItem('medcontrol_modular3_protected_state_v1'),credential:localStorage.getItem('medcontrol_modular3_local_credential_v1')}))).toEqual(pendingPair);
      await expect(page.locator('#password').locator('..')).toBeHidden();
      await expect(page.locator('#confirm-password-label')).toBeHidden();
      await expect(page.locator('#legacy-backup').locator('..')).toBeHidden();
      await expect(page.locator('#entry-language')).toHaveValue(next.code);
      expect(await page.evaluate(()=>window.__entryDeviceReads)).toBeGreaterThan(0);
      records.push({language:language.code,deviceLanguage:next.code,phase:'password-first-device-detection',pass:true});
      expect(await page.evaluate(() => MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
      await page.locator('#entry-language').selectOption(language.code);
      await expect(page.locator('#confirm-entry-language')).toHaveText(messages(language.code)['27bca309f5f89bc6']);
      await expect(page.locator('#entry-language')).toHaveAttribute('aria-label', messages(language.code)['9089a73112cc819e']);
      await expect(page.locator('body > h1')).toHaveText(messages(language.code)['f0078d3655994ddb']);
      await page.locator('#confirm-entry-language').click();
      await expect(page.locator('#entry-language-step')).toBeHidden();
      expect(await page.evaluate(() => MedControlModular3ProtectedSession.read().settings.interfaceLanguage)).toBe(language.code);
      expect(await page.evaluate(() => MedControlModular3ProtectedSession.isEntryAuthorized())).toBe(false);
      await expect(page.locator('.topbar')).toHaveCount(0);
      await expect(page.locator('#unlock')).toHaveText(messages(language.code)['8fc9ab2eeb38ad7a']);
      await page.locator('#unlock').click();
      await expect(page).toHaveURL(base + '/input.html');
      await assertLocale(page, language);
      dialogLanguage=language.code;
      await expect(page.locator('#create_timeHour')).toHaveAttribute('aria-label', messages(language.code)['7e6da98020ac2053']);
      await expect(page.locator('#create_timeMinute')).toHaveAttribute('aria-label', messages(language.code)['935ec56194d6f572']);
      const emptyMedical=medical(await state(page));
      for(const section of SECTIONS){
        await navigate(page,base,section);await assertLocale(page,language);
        if(['action','dashboard'].includes(section))await expect(page.locator('.wrap td[colspan]').first()).toHaveText(messages(language.code)['5f084638f6f971ec']);
        expect(medical(await state(page))).toEqual(emptyMedical);
        const record={language:language.code,selected:language.code,section,phase:'empty-online',pass:true};
        records.push(record);
        await info.attach(language.code+'-empty-online-'+section,{body:Buffer.from(JSON.stringify(record)),contentType:'application/json'});
      }
      await navigate(page,base,'input');
      const name = 'Synthetic language ' + language.code;

      await page.locator('#create_name').fill(name);
      await page.locator('#create_manufacturer').fill('Synthetic Factory');
      const beforeHint=medical(await state(page));
      const hintEvent=page.waitForEvent('dialog');
      await page.locator('#create_contentUnit').focus();
      const validationHint=await hintEvent;
      expect(validationHint.type()).toBe('alert');
      expect(validationHint.message()).toBe(messages(language.code)['576077460ea8b800']+'\n\n'+messages(language.code)['d6b8f8f44922621f']);
      expect(medical(await state(page))).toEqual(beforeHint);
      progress('native amount hint verified');
      progress('create synthetic course');
      const id = await createCourse(page, name);
      const beforeActiveRestart=medical(await state(page));
      page=await restartAndUnlock(language,false);
      expect(medical(await state(page))).toEqual(beforeActiveRestart);
      const populatedMedical=medical(await state(page));
      const catalog=messages(language.code);
      for(const section of SECTIONS){
        await navigate(page,base,section);await assertLocale(page,language);
        if(section==='input'){
          const row=page.locator('tr').filter({has:page.locator('button[onclick^="openEditMedication("]')});
          for(const [index,key] of [[4,'4d3b9935cee18ed7'],[6,'a5e49b2e7c253894'],[9,'f37b297e01100c8c']])
            await expect(row.locator(':scope > td').nth(index)).toHaveText(catalog[key]);
          await expect(row.locator(':scope > td > .status')).toHaveText(catalog['68505b6d0475073b']);
        }
        if(['action','dashboard'].includes(section))await expect(page.locator('td > .status').first()).toHaveText(catalog['d6839d4bba6f57f0']);
        if(section==='dashboard'){
          await expect(page.locator('[data-dashboard-timing]').first().locator('strong')).toHaveText(catalog['f811d075b83b0531']);
          const duration=catalog['06cf4eca8aefb953'].replace('⟦0⟧','0').replace('⟦1⟧','01').replace('⟦2⟧','00').replace('⟦3⟧','00');
          await expect(page.locator('[data-dashboard-timing]').first()).toContainText(duration);
        }

        await assertVisibleEnglish(page);
        if(section==='input'){
          await page.locator('button[onclick="showRowHistory(\''+id+'\')"]').click();
          await expect(page.locator('#rowHistoryDialog')).toBeVisible();
          await expect(page.locator('#rowHistoryDialog h2')).toHaveText(catalogText(language.code,'История препарата «⟦0⟧»').replace('⟦0⟧',name));
          const createdRow=page.locator('#rowHistoryContent tbody tr').first();
          await expect(createdRow.locator('td').nth(1)).toHaveText(catalogText(language.code,'Создано'));
          await expect(createdRow.locator('td').nth(4)).toHaveText(catalogText(language.code,'мг'));
          await expect(createdRow.locator('td').nth(6)).toHaveText(catalogText(language.code,'таблетка'));
          await assertVisibleEnglish(page);
          await page.locator('#rowHistoryDialog button[onclick*=".close()"] ').click();
          await page.locator('button[onclick="openEditMedication(\''+id+'\')"]').click();
          await expect(page.locator('#editDialog')).toBeVisible();
          await expect(page.locator('#editDialog h2')).toHaveText(catalogText(language.code,'Изменить препарат'));
          await expect(page.locator('#editDialog label').filter({hasText:catalogText(language.code,'Количественное содержание (указанное производителем) *')})).toHaveCount(1);
          await assertVisibleEnglish(page);
          await page.locator('#editDialog button[onclick*=".close()"] ').click();
        }
        if(['action','dashboard'].includes(section)){
          await page.locator('button[onclick^="showIntakeHistory("]').first().click();
          await expect(page.locator('#intakeHistoryDialog')).toBeVisible();
          await expect(page.locator('#intakeHistoryDialog h2')).toHaveText(catalogText(language.code,'История приёма препарата «⟦0⟧»').replace('⟦0⟧',name));
          await assertVisibleEnglish(page);
          await page.locator('#intakeHistoryDialog button[onclick*=".close()"] ').click();
        }
        expect(medical(await state(page))).toEqual(populatedMedical);
        const record={language:language.code,selected:language.code,section,phase:'populated-online',pass:true};
        records.push(record);
        await info.attach(language.code+'-populated-online-'+section,{body:Buffer.from(JSON.stringify(record)),contentType:'application/json'});
      }
      await navigate(page, base, 'action');
      await assertLocale(page, language);
      const taken = () => page.locator('button[onclick^="markTaken(\'' + id + '\'"]');
      progress('take, cancel, retake, final archive');
      await taken().first().click();
      await expect.poll(async () => (await state(page)).intakeLogs.length).toBe(1);
      await page.locator('button[onclick^="showIntakeHistory("]').first().click();await expect(page.locator('#intakeHistoryDialog')).toBeVisible();await assertVisibleEnglish(page);await page.locator('#intakeHistoryDialog button[onclick*=".close()"] ').click();
      const firstLogId = (await state(page)).intakeLogs[0].id;
      const factualTime = (await state(page)).intakeLogs[0].actualAt;
      // Distinct user events need distinct simulated timestamps; freezing the
      // clock across take and cancel makes the legacy chronological resolver
      // unable to place a cancellation after its original Taken event.
      await page.clock.setFixedTime(new Date('2026-11-24T08:00:00.500Z'));
      await page.locator('button[onclick^="openCorrection(\'' + id + '\'"]').first().click();
      await assertVisibleEnglish(page);
      await page.locator('#correction_reason').selectOption('accident');
      await page.locator('#correction_apply').click();
      await expect.poll(async () => (await state(page)).intakeCorrections.length).toBe(1);
      await page.locator('button[onclick^="showIntakeHistory("]').first().click();await expect(page.locator('#intakeHistoryDialog')).toBeVisible();await assertVisibleEnglish(page);await page.locator('#intakeHistoryDialog button[onclick*=".close()"] ').click();
      expect((await state(page)).intakeLogs[0].actualAt).toBe(factualTime);
      await page.clock.setFixedTime(new Date('2026-11-24T08:00:01Z'));
      await taken().first().click();
      // The protected adapter appends the retake, retaining the original fact
      // and its cancellation. The unprotected legacy replacement helper is
      // deliberately not the oracle for this protected real UI flow.
      await expect.poll(async () => (await state(page)).intakeLogs.length).toBe(2);
      expect((await state(page)).intakeLogs.find(log => log.id === firstLogId).actualAt).toBe(factualTime);
      expect((await state(page)).intakeCorrections[0].before.actualAt).toBe(factualTime);
      await page.clock.setFixedTime(new Date('2026-11-24T08:00:02Z'));
      await taken().last().click();
      await expect(page.locator('#finalIntakeDialog')).toBeVisible();
      await expect(page.locator('#finalIntakeDialog h2')).toHaveText(catalogText(language.code,'Последний приём курса'));
      await expect(page.locator('#finalIntakeConfirm')).toHaveText(catalogText(language.code,'Подтвердить «Принято»'));
      await assertVisibleEnglish(page);
      await page.locator('#finalIntakeConfirm').click();
      await expect.poll(async () => (await state(page)).medications.find(item => item.id === id).archivedCompleted).toBe(true);
      const expected = medical(await state(page));
      expect(expected.intakeLogs).toHaveLength(3);
      expect(expected.intakeCorrections).toHaveLength(1);
      progress('four online sections');
      await visitAll(page, language, 'online', expected);
      await expect(page.locator('body')).toContainText(name);
      await page.locator('button[onclick="showArchiveMedicationHistory(\'' + id + '\')"]').click();
      await expect(page.locator('#archiveHistoryTitle')).toContainText(name);
      await expect(page.locator('#archiveHistoryContent')).not.toBeEmpty();
      await expect(page.locator('#archiveHistoryTitle')).toHaveText(catalogText(language.code,'История курса «⟦0⟧»').replace('⟦0⟧',name));
      const journal=page.locator('#archiveHistoryContent tbody tr');
      const createdJournal=journal.filter({has:page.getByText(catalogText(language.code,'Создано'),{exact:true})}).first();
      await expect(createdJournal.locator('td').nth(3)).toHaveText('1 '+catalogText(language.code,'мг'));
      await expect(createdJournal.locator('td').nth(4)).toHaveText('1 '+catalogText(language.code,'таблетка'));
      await expect(createdJournal.locator('td').nth(5)).toHaveText(catalogText(language.code,'Каждый день'));
      await expect(journal.filter({has:page.getByText(catalogText(language.code,'Расчётный приём'),{exact:true})}).first().locator('td').nth(8)).toContainText(catalogText(language.code,'Случайное нажатие'));
      progress('owned dialogs and history locale verified');
      await assertVisibleEnglish(page);
      await page.waitForFunction(() => window.medcontrolOfflineShellReady === true, null, {timeout:45000});
      page = await restartAndUnlock(language);
      progress('four offline sections');
      await visitAll(page, language, 'offline-restart', expected);
      // Switch through the actual UI online; the next selected catalog must then
      // survive another fully disconnected browser-process restart.
      await context.setOffline(false);
      progress('change selected language: ' + next.code);
      await navigate(page, base, 'input');
      await page.locator('.topbar select[onchange*="changeInterfaceLanguage"]').selectOption(next.code);
      await assertLocale(page, next);
      dialogLanguage=next.code;
      expect(medical(await state(page))).toEqual(expected);
      await page.waitForFunction(() => window.medcontrolOfflineShellReady === true, null, {timeout:45000});
      page = await restartAndUnlock(next);
      progress('four switched offline sections');
      await visitAll(page, next, 'switched-offline-restart', expected);
      expect(external, 'No outside service is contacted').toEqual([]);
      expect(errors, 'No uncaught browser errors').toEqual([]);
      // These fixtures use Latin patient names/details. Cyrillic in a native
      // dialog is therefore UI copy unless that selected language uses Cyrillic.
      const cyrillic=new Set(['ru','be','bg','mk','sr','uk','kk','ky','tg','mn']);
      expect(nativeDialogs.filter(x=>x.language&&!cyrillic.has(x.language)&&/[А-Яа-яЁё]/.test(x.message)),'No Russian native UI fallback').toEqual([]);
    } finally {
      if (context) await context.close();
      await info.attach('language-flow-evidence', {body:Buffer.from(JSON.stringify({language:language.code, diagnosticSubset:!!diagnostic, requiredSections:4, records, external, errors,nativeDialogs}, null, 2)),contentType:'application/json'});
    }
  });
}
