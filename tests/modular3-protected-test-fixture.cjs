'use strict';
// Synthetic module-test fixture. Acceptance journeys continue to enroll through UI.
const {expect}=require('@playwright/test');
const BASE=process.env.MEDCONTROL_TEST_BASE||'http://127.0.0.1:8765';
const PASSWORD='Synthetic-Module-Fixture-2026!';
const EMPTY={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[],intakeCorrections:[],archiveHistory:[],timeHistory:[]};
async function openProtected(page,section='input',sample){
 await page.goto(BASE+'/modular3-protected.html');
 await page.waitForFunction(()=>window.medcontrolProtectedWorkspaceReady===true);
 await page.evaluate(async({sample,PASSWORD,EMPTY})=>{
  const session=MedControlModular3ProtectedSession;
  if(localStorage.getItem('medcontrol_modular3_protected_state_v1')===null)await session.initialize(sample||EMPTY,PASSWORD);
  else if(!session.isUnlocked()&&!await session.unlock(PASSWORD))throw Error('Synthetic fixture unlock failed');
  if(!MedControlEntryLanguages.confirmed(session.read().settings))await MedControlEntryLanguages.confirm(session,'ru');
  if(session.isEntryAuthorized())throw Error('Fixture setup must not authorize entry');
 },{sample,PASSWORD,EMPTY});
 await page.locator('#password').fill(PASSWORD);
 await page.locator('#unlock').click();
 await expect(page.locator('.topbar')).toBeVisible({timeout:20000});
 if(section!=='input')await page.evaluate(section=>window.medcontrolNavigateTo(section),section);
 await expect(page).toHaveURL(BASE+'/'+section+'.html');
}
module.exports={BASE,PASSWORD,EMPTY,openProtected};
async function warmOffline(page){
 await page.waitForFunction(()=>navigator.serviceWorker.controller!==null&&window.medcontrolOfflineShellReady===true,null,{timeout:60000});
 await page.evaluate(async()=>{
  const cache=await caches.open(MedControlEntryLanguages.cacheName);
  for(const url of ['/modular3-protected.html','/input.html','/action.html','/dashboard.html','/archive.html','/js/auth-guard.js'])if(!await cache.match(url))throw Error('Real SW shell missing '+url);
 });
}
module.exports.warmOffline=warmOffline;
