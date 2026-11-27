'use strict';
const {expect}=require('@playwright/test');
const manifest=require('../locales/manifest.json'),source=require('../locales/source-ru.json');
const BASE='http://127.0.0.1:'+(process.env.MEDCONTROL_P1_PORT||'8765'),PASS='Synthetic-Functional-P1-2026';
const ids=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,id]));
const selected=process.env.MEDCONTROL_P1_CODES?.split(',');
if(selected?.some(code=>!manifest.some(x=>x.code===code)))throw Error('Unknown P1 diagnostic language');
const languages=manifest.filter(x=>!selected||selected.includes(x.code));
function dictionary(code){return code==='ru'?Object.fromEntries(Object.values(source).map(row=>[row.source,row.source])):Object.fromEntries(Object.entries(require('../locales/catalogs/'+code+'.json').messages).map(([id,value])=>[source[id].source,value]));}
async function setup(page,code){
 const external=[],errors=[],dialogs=[],answers=[];
 await page.context().route('**/*',route=>{if(new URL(route.request().url()).origin===BASE)return route.continue();external.push(route.request().url());return route.abort();});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});if(answers.shift()===true)await dialog.accept();else await dialog.dismiss();});
 await page.clock.setFixedTime(new Date('2026-11-24T08:00:00Z'));
 await page.goto(BASE+'/modular3-protected.html');await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 // Real enrollment and explicit language confirmation, not a seeded vault.
 await page.locator('#password').fill(PASS);await page.locator('#enroll').click();await page.locator('#confirm-password').fill(PASS);await page.locator('#enroll').click();
 await expect(page.locator('#entry-language-step')).toBeVisible();await page.locator('#entry-language').selectOption(code);await page.locator('#confirm-entry-language').click();await page.locator('#unlock').click();
 await expect(page).toHaveURL(BASE+'/input.html');await expect(page.locator('.topbar')).toBeVisible();
 expect(await page.evaluate(()=>getState().settings.localCycleOrigin)).toBe('protected-local-v1');
 const dict=dictionary(code),t=(value)=>{expect(dict[value],'Catalog source: '+value).toBeDefined();return dict[value];};
 const medical=()=>page.evaluate(()=>{const s=getState();return Object.fromEntries(['medications','intakeLogs','intakeCorrections','archiveHistory','archivedCourses','timeHistory'].map(k=>[k,s[k]||[]]));});
 const checkpoints=[];
 async function surface(name){
  const values=await page.evaluate(dict=>{
   // A translated Bulgarian status can itself be another Russian source key.
   // Bind this owned cell to its actual medication and assert its exact key,
   // rather than treating a cross-language spelling collision as a fallback.
   const verifiedStatusNodes=new Set();
   for(const label of document.querySelectorAll('td:nth-child(4) > span[data-medcontrol-ui-label]')){
    const row=label.closest('tr'),action=row.querySelector('button[onclick^="showArchiveMedicationHistory("]');
    const match=/^showArchiveMedicationHistory\('([^']+)'\)$/.exec(action?.getAttribute('onclick')||'');
    const med=match&&(getState().medications||[]).find(m=>m.id===match[1]);
    if(!med?.cancelled)continue;
    if(label.textContent!==dict['Отменён'])throw Error('Cancelled archive status does not match its catalog key');
    for(const node of label.childNodes)verifiedStatusNodes.add(node);
   }
   const values=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){const n=walker.currentNode,p=n.parentElement;if(verifiedStatusNodes.has(n)||!p||p.closest('script,style,select[onchange*="changeInterfaceLanguage"],#settingsLanguageMatches')||p.closest('dialog:not([open])'))continue;
    const range=document.createRange();range.selectNodeContents(n);if(range.getBoundingClientRect().height&&n.textContent.trim())values.push(n.textContent.trim());
   }
   for(const el of document.querySelectorAll('input,select,textarea,button,[title],[aria-label]')){if(!el.getClientRects().length)continue;for(const attr of ['placeholder','title','aria-label']){const v=el.getAttribute(attr);if(v)values.push(v);}}
   return [...new Set(values)];
  },dict);
  const templates=Object.entries(dict).filter(([source,target])=>source.includes('⟦')&&source!==target&&/[А-Яа-яЁё]/.test(source)).map(([source,target])=>{const pattern=source.split(/(⟦\d+⟧)/g).map(part=>/^⟦\d+⟧$/.test(part)?'(.+?)':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');return {source,target,pattern:new RegExp('^'+pattern+'$')};});
  const untranslated=values.filter(value=>(dict[value]&&dict[value]!==value)||templates.some(item=>item.pattern.test(value))); 
  expect.soft(untranslated,'Untranslated own surface '+code+'/'+name).toEqual([]);
  checkpoints.push({name,values,untranslated});
 }
 async function hint(action,body){
  dialogs.length=0;await action();await expect.poll(()=>dialogs.length).toBe(1);
  expect(dialogs[0]).toEqual({type:'alert',message:t('Подсказка')+'\n\n'+t(body)});
  await page.waitForFunction(()=>!medicationSequenceGuardActive);expect((await medical()).medications).toEqual([]);checkpoints.push({name:'native-required-hint',source:body,message:dialogs[0].message,passed:true});
 }
 async function navigate(section){
  await page.locator('.topbar a[href="'+section+'.html"]').click();await expect(page).toHaveURL(BASE+'/'+section+'.html');await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.topbar .nav a.active')).toHaveAttribute('href',section+'.html');
  const titles={input:'MedControl — Ввод',action:'MedControl — Приём препаратов',dashboard:'MedControl — Табло',archive:'MedControl — Архив'};
  await expect(page).toHaveTitle(t(titles[section]));await surface(section);
 }
 async function finish(info){expect(external).toEqual([]);expect(errors).toEqual([]);await info.attach('functional-p1-evidence',{body:Buffer.from(JSON.stringify({code,external,errors,dialogs,checkpoints},null,2)),contentType:'application/json'});}
 return {t,dialogs,answers,medical,surface,hint,navigate,finish};
}
module.exports={setup,languages,BASE,PASS,dictionary};
