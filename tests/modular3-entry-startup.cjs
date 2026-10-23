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
  for(let i=0;i<100;i++){try{if((await fetch(BASE+'/modular3-protected.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
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
  await page.evaluate(async password=>window.MedControlModular3ProtectedSession.initialize({settings:{timezone:'Asia/Yerevan',interfaceLanguage:'ru'},medications:[{id:'synthetic-startup',name:'Synthetic Startup',active:false,times:['13:00'],startDate:'2026-10-23',endDate:'2026-10-24'}],intakeLogs:[]},password),PASS);
  const before=await page.evaluate(key=>localStorage.getItem(key),DATA);
  const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await context.close();
  const modules=['encrypted-vault','offline-credential','protected-session','write-boundary','course-lifecycle-browser','protected-pages','final-intake','copy-migration','protected-workspace'];
  for(const module of modules){
   context=await browser.newContext();page=await context.newPage();
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
   await page.locator('#create_name').waitFor({timeout:10000});
   assert.equal(await page.evaluate(()=>getState().medications[0].id),'synthetic-startup');
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
  assert.match(await page.locator('#message').innerText(),/Не удалось подготовить вход/);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA),before);
  console.log('PASS persistent entry failure gives retry and preserves encrypted data');
  await context.close();
  context=await browser.newContext();page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
  await page.goto(BASE+'/modular3-protected.html');
  await page.locator('#unlock').click();
  assert.match(await page.locator('#message').innerText(),/Введите локальный пароль/);
  console.log('PASS empty password gives visible response');
  await page.locator('#password').fill(PASS);await page.locator('#unlock').click();
  assert.match(await page.locator('#message').innerText(),/На этом адресе защищённое хранилище не найдено/);
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
