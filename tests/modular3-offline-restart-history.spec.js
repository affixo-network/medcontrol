'use strict';
const {test,expect}=require('@playwright/test');
// Multiple real encrypted reopen flows and full worker-cache acknowledgment.
test.setTimeout(120000);
const fs=require('node:fs'),path=require('node:path');
const {BASE,openProtected,warmOffline}=require('./modular3-protected-test-fixture.cjs');
test('real sections restart offline and preserve synthetic intake history, encrypted vault rejects wrong password',async({browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',locale:'ru-RU'});
 const external=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==BASE){external.push(route.request().url());return route.abort();}return route.continue();});
 const page=await context.newPage();
 await openProtected(page,'input');
 await expect(page.locator('#create_name')).toBeVisible({timeout:20000});
 const original=await page.evaluate(async()=>{
  const state=getState();
  state.medications.push({id:'OFFLINE-RESTART-SYNTHETIC',name:'Synthetic restart medicine',active:true,times:['09:00'],scheduleType:'daily',startDate:'2026-10-13',endDate:'2026-10-14'});
  state.intakeLogs.push({medicationId:'OFFLINE-RESTART-SYNTHETIC',scheduledAt:'2026-10-13T05:00:00.000Z',action:'taken',createdAt:'2026-10-13T05:05:00.000Z'});
  if(!await saveStateAsync(state))throw Error('Unable to save test history');
  return getState();
 });
 await page.addScriptTag({url:'/tests/modular3-offline-vault.js'});
 await page.addScriptTag({url:'/tests/modular3-offline-storage-adapter.js'});
 await page.evaluate(async()=>MedControlOfflineStorageAdapter.save(getState(),'Synthetic-Restart-Passphrase-2026'));
 await warmOffline(page);
 await page.close();await context.setOffline(true);
 for(const name of ['input','action','dashboard','archive']){
  const reopened=await context.newPage();
  await openProtected(reopened,name);
  if(name==='input')await expect(reopened.locator('#create_name')).toBeVisible({timeout:20000});
  else if(name==='archive')await expect(reopened.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible({timeout:20000});
  else await expect(reopened.locator('body')).toContainText('MedControl',{timeout:20000});
  const actual=await reopened.evaluate(()=>MedControlModular3ProtectedSession.read());
  expect(actual.medications.find(m=>m.id==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
  expect(actual.intakeLogs.find(l=>l.medicationId==='OFFLINE-RESTART-SYNTHETIC'&&l.action==='taken')).toBeTruthy();
  await reopened.close();
 }
 const reopened=await context.newPage();
 await reopened.goto(BASE+'/modular3-protected.html');
 await reopened.addScriptTag({content:fs.readFileSync(path.join(__dirname,'modular3-offline-vault.js'),'utf8')});
 await reopened.addScriptTag({content:fs.readFileSync(path.join(__dirname,'modular3-offline-storage-adapter.js'),'utf8')});
 const result=await reopened.evaluate(async()=>{
  const restored=await MedControlOfflineStorageAdapter.load('Synthetic-Restart-Passphrase-2026');
  const wrongRejected=await MedControlOfflineStorageAdapter.load('Synthetic-Wrong-Passphrase-2026').then(()=>false,()=>true);
  const raw=localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1');
  return {restored,wrongRejected,raw};
 });
 expect(result.restored.medications.find(m=>m.id==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
 expect(result.restored.intakeLogs.find(l=>l.medicationId==='OFFLINE-RESTART-SYNTHETIC')).toBeTruthy();
 expect(result.wrongRejected).toBe(true);
 expect(result.raw).not.toContain('Synthetic restart medicine');
 expect(result.raw).not.toContain('OFFLINE-RESTART-SYNTHETIC');
 expect(external).toEqual([]);await context.close();
});
