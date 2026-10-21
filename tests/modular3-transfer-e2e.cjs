'use strict';
// Synthetic-only, cross-origin end-to-end test for the MedControl encrypted handoff.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = process.cwd();
const legacyRoot = path.join(ROOT, 'legacy');
const protectedRoot = path.join(ROOT, 'protected');
const ports = { legacy: 18761, protected: 18762 };
const TEST_PASSWORD = 'Synthetic-test-passphrase-2026!';
const original = {
 settings: {timezone:'Asia/Yerevan',interfaceLanguage:'ru'},
 medications:Array.from({length:7},(_,i)=>({
   id:'synthetic-course-'+(i+1),name:'SYNTHETIC_COURSE_'+(i+1),
   times:['12:30'],startDate:'2026-10-05',endDate:'2026-10-12',
   archivedCompleted:true,active:false,
   rowHistory:[{action:'course_completed',at:'2026-10-12T12:31:00+04:00'}]
 })),
 intakeLogs:[{id:'intake-1',medicationId:'synthetic-course-1',action:'taken',plannedAt:'2026-10-12T12:30:00+04:00',actualAt:'2026-10-12T12:31:00+04:00'}],
 intakeCorrections:[{id:'correction-1',medicationId:'synthetic-course-1',reason:'Случайность'}],
 archiveHistory:[{id:'archive-1',medicationId:'synthetic-course-1'}],
 archivedCourses:[{id:'synthetic-course-1'}],
 timeHistory:[{id:'change-1',medicationId:'synthetic-course-1'}]
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function server(root,port){
 return new Promise((resolve,reject)=>{
  const app=http.createServer((req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const relative=path.posix.normalize(pathname).replace(/^\/+/, '');
   const filename=path.resolve(root,relative);
   if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(filename,(err,data)=>{
    if(err){res.writeHead(404).end('Not found: '+relative);return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
   });
  });
  app.once('error',reject);app.listen(port,'127.0.0.1',()=>resolve(app));
 });
}
async function run(){
 let legacy,protectedServer,browser;
 try{
  legacy=await server(legacyRoot,ports.legacy);
  protectedServer=await server(protectedRoot,ports.protected);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+ports.legacy+'/transfer-to-modular3.html',{waitUntil:'load'});
  await page.evaluate(data=>localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(data)),original);
  await page.reload();
  await page.locator('#secret').fill(TEST_PASSWORD);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
  const bytes=fs.readFileSync(await download.path(),'utf8');
  assert.equal(bytes.includes('SYNTHETIC_COURSE_1'),false,'Medical names must not appear in transfer file');
  assert.equal(JSON.parse(bytes).format,'medcontrol-encrypted-transfer-v1');
  console.log('PASS 1: encrypted export without plaintext names');
  const protectedUrl='http://127.0.0.1:'+ports.protected+'/modular3-protected.html';
  await page.goto(protectedUrl,{waitUntil:'load'});
  await page.locator('#legacy-backup').setInputFiles({name:'medcontrol-encrypted-transfer.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await page.locator('#password').fill('Wrong-passphrase-123');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-backup').click();
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Импорт не завершён'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('medcontrol_modular3_protected_state_v1')),null);
  console.log('PASS 2: incorrect password rejected without writing vault');
  await page.locator('#password').fill(TEST_PASSWORD);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#import-backup').click();
  await page.locator('#workspace').waitFor({state:'visible',timeout:30000});
  const restored=await page.evaluate(()=>window.MedControlModular3ProtectedSession.read());
  assert.deepEqual(restored,original);
  console.log('PASS 3: seven courses, intake, history and corrections restored exactly');
  await page.locator('#lock').click();
  await page.reload();
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read()),original);
  console.log('PASS 4: protected re-login retains all records');
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{timeout:30000}).catch(()=>{});
  await context.setOffline(true);
  await page.locator('#lock').click();
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('#unlock').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.MedControlModular3ProtectedSession.read()),original);
  console.log('PASS 5: offline reload and local-password unlock');
  await context.setOffline(false);
  const noSource=await context.newPage();
  await noSource.goto('http://127.0.0.1:'+ports.legacy+'/transfer-to-modular3.html');
  assert.equal(await noSource.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')).medications.length),7);
  console.log('PASS 6: source courses untouched');
  assert.deepEqual(errors,[],'Unexpected page script errors');
  console.log('PASS 7: no uncaught browser script errors');
 }finally{
  if(browser)await browser.close();
  if(legacy)await new Promise(r=>legacy.close(r));
  if(protectedServer)await new Promise(r=>protectedServer.close(r));
 }
}
run().catch(error=>{console.error('FAIL protected transfer E2E:',error);process.exitCode=1;});
