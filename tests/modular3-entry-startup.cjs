'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const BASE='http://127.0.0.1:8794';
const PASS='Synthetic-Startup-Password-2026';
const DATA='medcontrol_modular3_protected_state_v1';
async function run(){
 const server=spawn('python3',['-m','http.server','8794','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 try{
  // Avoid undici's incomplete-response socket teardown during startup polling.
  const http=require('node:http');
  for(let i=0;i<100;i++){
   const ready=await new Promise(resolve=>{
    const req=http.get(BASE+'/modular3-protected.html',res=>{
     res.resume();res.on('end',()=>resolve(res.statusCode===200));res.on('error',()=>resolve(false));
    });
    req.on('error',()=>resolve(false));
   });
   if(ready)break;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  browser=await chromium.launch({headless:true,...(process.env.MEDCONTROL_CHROMIUM?{executablePath:process.env.MEDCONTROL_CHROMIUM,args:['--no-sandbox']}:{} )});
  let context=await browser.newContext();
  let page=await context.newPage();
  const external=[];
  let failWorkspace=false;
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==BASE){external.push(url.origin);return route.abort();}
   if(failWorkspace&&url.pathname==='/js/modular3-protected-workspace.js'&&route.request().resourceType()==='script'){
    failWorkspace=false;return route.fulfill({status:503,body:'Synthetic interrupted script response'});
   }
   return route.continue();
  });
  await page.goto(BASE+'/modular3-protected.html');
  await page.locator('#entry-language option').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#entry-language option').count(),95,
   'Protected sign-in must offer all 95 languages before unlocking');
  assert.equal(await page.locator('#entry-language').inputValue(),'en',
   'English browser must receive English language proposal');
  assert.equal(await page.locator('#password').isVisible(),true);
  console.log('PASS protected entry has 95 registered languages and browser language proposal');
  await page.evaluate(async password=>window.MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru'},medications:[{id:'synthetic-startup',name:'Synthetic Startup',active:false,times:['13:00'],startDate:'2026-10-23',endDate:'2026-10-24'}],intakeLogs:[]},password),PASS);
  const before=await page.evaluate(key=>localStorage.getItem(key),DATA);
  const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await context.close();
  context=await browser.newContext();page=await context.newPage();
  await page.addInitScript(stored=>{for(const [key,value]of Object.entries(stored))localStorage.setItem(key,value);},stored);
  await context.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
  for(const directPath of ['/input.html','/action.html','/dashboard.html','/archive.html']){
   await page.goto(BASE+directPath);
   await page.waitForURL('**/modular3-protected.html',{timeout:20000});
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),before,
    'Direct route must not change encrypted vault: '+directPath);
   assert.equal(await page.locator('#password').isVisible(),true,
    'Direct route must require protected password: '+directPath);
   assert.equal(await page.locator('.topbar').count(),0,
    'Direct route must not render medical UI: '+directPath);
  }
  await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
  await page.locator('#entry-language-step').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('.topbar').count(),0);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),before,
   'Language confirmation step must not alter encrypted vault');
  await page.locator('#entry-language').selectOption('ru');
  await page.locator('#confirm-entry-language').click();
  await page.waitForFunction(()=>{const s=window.MedControlModular3ProtectedSession.read().settings;return s?.languageChoiceConfirmed===true&&s.languageConfirmationVersion===1;});
  await page.locator('#unlock').click();
  await page.locator('.topbar').waitFor({state:'visible',timeout:20000});
  assert.equal(new URL(page.url()).pathname,'/input.html',
   'Canonical entry must open input after direct-route redirect');
  assert.equal(await page.locator('.topbar .nav a').count(),4,
   'All four medical sections must be accessible after canonical entry');
  assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().medications[0].id),'synthetic-startup',
   'Encrypted medical course must survive direct-route entry');
  console.log('PASS four direct routes redirect and canonical entry opens all sections without another password');
  await context.close();
  const modules=['encrypted-vault','offline-credential','protected-session','write-boundary','course-lifecycle-browser','protected-pages','final-intake','copy-migration','protected-workspace'];
  for(const module of modules){
   // Route-controlled fault injection must not be bypassed or replayed by the service worker.
   context=await browser.newContext({serviceWorkers:'block'});page=await context.newPage();
   await page.addInitScript(stored=>{for(const [key,value]of Object.entries(stored))localStorage.setItem(key,value);},stored);
   let failed=false;
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==BASE){external.push(url.origin);return route.abort();}
    if(!failed&&url.pathname==='/js/modular3-'+module+'.js'&&route.request().resourceType()==='script'){
     failed=true;return route.fulfill({status:503,body:'Synthetic interrupted script response'});
    }
    return route.continue();
   });
   await page.goto(BASE+'/modular3-protected.html');
   await page.waitForFunction(()=>window.medcontrolProtectedEntryReady!==undefined);
   assert.equal(await page.evaluate(()=>window.medcontrolProtectedEntryReady),true,'Entry recovery failed for '+module);
   assert.equal(await page.evaluate(()=>typeof document.getElementById('unlock').onclick),'function');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),before,'Startup recovery changed medical vault');
   await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
   await page.locator('#entry-language-step').waitFor({state:'visible',timeout:20000});
   // One shared sign-in mechanism must accept every registered language, not
   // merely English and Russian. Synthetic vault only; no real medical data.
   const allEntryLanguages=await page.locator('#entry-language option').evaluateAll(options=>
    options.map(option=>option.value));
   assert.equal(new Set(allEntryLanguages).size,95,'All 95 entry language codes must be unique');
   for(const code of allEntryLanguages){
    await page.locator('#entry-language').selectOption(code);
    assert.equal(await page.locator('#entry-language').inputValue(),code,
     'Language selector must accept '+code);
   }
   console.log('PASS language selector accepts 95/95 registered language codes');
 
   const registered=await page.locator('#entry-language option').evaluateAll(options=>options.map(option=>option.value));
   assert.equal(registered.length,95,'Language confirmation must retain all 95 registered languages');
   assert.equal(registered.includes('fil'),false,'Filipino #96 must not be offered in the 95-language registry');
   await page.locator('#entry-language').selectOption('ru');
   await page.locator('#confirm-entry-language').click();
   await page.waitForFunction(()=>{const s=window.MedControlModular3ProtectedSession.read().settings;return s?.languageChoiceConfirmed===true&&s.languageConfirmationVersion===1;});
   assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().settings.interfaceLanguage),'ru','Confirmed language must be stored in encrypted vault');
   assert.equal(await page.locator('#entry-language-step').isVisible(),false,'Language confirmation must close after saving');
   assert.equal(await page.locator('#unlock').isVisible(),true,'Enter button must appear only after language confirmation');
   await page.locator('#unlock').click();
   await page.locator('.topbar').waitFor({state:'visible',timeout:20000});
   assert.equal(new URL(page.url()).pathname,'/input.html');
   assert.equal(await page.locator('.topbar .nav a').count(),4);
   assert.equal(await page.locator('#topCurrentDate').isVisible(),true);
   assert.equal(await page.locator('#topCurrentTime').isVisible(),true);
   assert.equal(await page.locator('#medcontrolFirstLanguageDialog').count(),0,'Confirmed language must not prompt again after entry');
   assert.equal(await page.evaluate(()=>MedControlModular3ProtectedSession.read().medications[0].id),'synthetic-startup');
   if(module==='protected-workspace'){
    await page.evaluate(async()=>{await window.MedControlModular3ProtectedSession.lock();});
    const reloadErrors=[];
    page.on('pageerror',error=>reloadErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')reloadErrors.push(message.text());});
    await page.goto(BASE+'/modular3-protected.html');
    const entryResult=await page.evaluate(async()=>{
     const settled=await Promise.race([
      Promise.resolve(window.medcontrolProtectedEntryReady).then(value=>({settled:true,value}),error=>({settled:true,error:String(error)})),
      new Promise(resolve=>setTimeout(()=>resolve({settled:false}),16000))
     ]);
     return {
      url:location.href,settled,
      workspaceReady:window.medcontrolProtectedWorkspaceReady,
      unlockHandler:typeof document.getElementById('unlock')?.onclick,
      retryVisible:!!document.getElementById('retry-entry')?.offsetParent,
      message:document.getElementById('message')?.textContent,
      options:document.querySelectorAll('#entry-language option').length
     };
    });
    console.log('DIAGNOSTIC protected-workspace second entry',JSON.stringify({entryResult,reloadErrors}));
    assert.equal(entryResult.settled.value,true,'Returning user entry initialization failed: '+JSON.stringify({entryResult,reloadErrors}));
    assert.equal(await page.locator('#entry-language-step').isVisible(),false,
     'Returning user must not confirm language before password');
    await page.locator('#password').fill(PASS);
    await page.locator('#unlock').click();
    const afterUnlock=await page.evaluate(()=>({
     url:location.href,
     message:document.getElementById('message')?.textContent,
     languageStepVisible:!!document.getElementById('entry-language-step')?.offsetParent,
     unlocked:window.MedControlModular3ProtectedSession?.isUnlocked(),
     settings:window.MedControlModular3ProtectedSession?.isUnlocked()?window.MedControlModular3ProtectedSession.read().settings:null,
     topbarPresent:!!document.querySelector('.topbar')
    }));
    console.log('DIAGNOSTIC protected-workspace returning unlock',JSON.stringify({afterUnlock,reloadErrors}));
    await page.locator('.topbar').waitFor({state:'visible',timeout:20000});
    assert.equal(await page.locator('#medcontrolFirstLanguageDialog').count(),0,
     'Returning user must enter without another language confirmation');
    assert.equal(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read().settings.interfaceLanguage),'ru',
     'Returning user must restore confirmed language');
    console.log('PASS returning user restores protected language without re-confirmation');
   }
   console.log('PASS interrupted '+module+' recovers and opens existing encrypted data');
   await context.close();
  }
  context=await browser.newContext();page=await context.newPage();
  await page.addInitScript(stored=>{for(const [key,value]of Object.entries(stored))localStorage.setItem(key,value);},stored);
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==BASE){external.push(url.origin);return route.abort();}
   if(url.pathname==='/js/modular3-protected-workspace.js')return route.fulfill({status:503,body:'Synthetic persistent failure'});
   return route.continue();
  });
  await page.goto(BASE+'/modular3-protected.html');
  assert.equal(await page.evaluate(()=>window.medcontrolProtectedEntryReady),false);
  assert.equal(await page.locator('#unlock').isDisabled(),true);
  assert.equal(await page.locator('#retry-entry').isVisible(),true);
  assert.match(await page.locator('#message').innerText(),/Unable to prepare sign-in/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),before);
  console.log('PASS persistent entry failure gives retry and preserves encrypted data');
  await context.close();
  context=await browser.newContext();page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
  await page.goto(BASE+'/modular3-protected.html');
  await page.locator('#unlock').click();
  assert.match(await page.locator('#message').innerText(),/Enter your local password\./);
  console.log('PASS empty password gives visible response');
  await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
  assert.match(await page.locator('#message').innerText(),/No protected vault was found at this address/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),null);
  console.log('PASS new address reports missing vault without creating or deleting data');
  await page.evaluate(()=>{
   const native=Storage.prototype.getItem;window.restoreStorageRead=()=>{Storage.prototype.getItem=native;};
   Storage.prototype.getItem=function(key){if(key.startsWith('medcontrol_modular3_'))throw Error('Synthetic blocked storage');return native.call(this,key);};
  });
  await page.locator('#unlock').click();
  assert.match(await page.locator('#message').innerText(),/Ошибка входа/);
  await page.evaluate(()=>window.restoreStorageRead());
  console.log('PASS blocked browser storage reports login error');
  await context.close();
  assert.deepEqual(external,[]);
 }finally{if(browser)await browser.close();server.kill();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
