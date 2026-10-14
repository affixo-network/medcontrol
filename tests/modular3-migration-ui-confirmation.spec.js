'use strict';
const {test,expect}=require('@playwright/test');
const URL='http://127.0.0.1:8765/modular3-protected.html';
const SOURCE='affixo_medcontrol_standard_v3';
const DEST='medcontrol_modular3_protected_state_v1';
const CRED='medcontrol_modular3_local_credential_v1';
const PASS='Synthetic-UI-Migration-Password-2026';
const SAMPLE={
 settings:{timezone:'Asia/Yerevan'},
 medications:[{id:'ui-a',name:'SYNTHETIC UI A',times:['09:00','14:00'],startDate:'2026-10-14',endDate:'2026-10-17'},
 {id:'ui-archive',name:'SYNTHETIC UI ARCHIVE',times:['18:00'],archived:true}],
 intakeLogs:[{id:'ui-log',medicationId:'ui-a',plannedAt:'2026-10-14T05:00:00.000Z',actualAt:'2026-10-14T05:31:00.000Z',action:'taken'}],
 intakeCorrections:[{id:'ui-cancel',intakeId:'ui-log',action:'cancel',at:'2026-10-14T05:32:00.000Z'}],
 archiveHistory:[{id:'ui-archive-event',courseId:'ui-archive',event:'completed'}],
 timeHistory:[{id:'ui-time',action:'changed',oldTime:'10:00',newTime:'14:00'}]
};
async function setup(browser,failWrites=false){
 const context=await browser.newContext({timezoneId:'Asia/Yerevan',serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.addInitScript(({source,sample,dest,failWrites})=>{
   localStorage.setItem(source,JSON.stringify(sample));
   if(failWrites){
     const realSet=Storage.prototype.setItem;
     Storage.prototype.setItem=function(key,value){
       if(key===dest)throw new DOMException('Synthetic quota failure','QuotaExceededError');
       return realSet.call(this,key,value);
     };
   }
 },{source:SOURCE,sample:SAMPLE,dest:DEST,failWrites});
 await page.goto(URL);
 await page.locator('#password').fill(PASS);
 return {context,page};
}
async function snapshot(page){
 return page.evaluate(({source,dest,cred})=>({
  source:localStorage.getItem(source),destination:localStorage.getItem(dest),credential:localStorage.getItem(cred)
 }),{source:SOURCE,dest:DEST,cred:CRED});
}
test('migration UI: decline confirmation without changing either storage',async({browser})=>{
 const {context,page}=await setup(browser);
 const before=await snapshot(page);
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('#commit-migration').click();
 await expect(page.locator('#message')).toContainText('Перенос отменён');
 expect(await snapshot(page)).toEqual(before);
 await expect(page.locator('#login')).toBeVisible();
 await context.close();
});
test('migration UI: confirmation preserves source, seals full history, and allows offline restart',async({browser})=>{
 const {context,page}=await setup(browser);
 const before=await snapshot(page);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#commit-migration').click();
 await expect(page.locator('#workspace')).toBeVisible();
 await expect(page.locator('#message')).toContainText('Защищённая копия проверена');
 const after=await snapshot(page);
 expect(after.source).toBe(before.source);
 expect(after.destination).toBeTruthy();
 expect(after.credential).toBeTruthy();
 expect(after.destination).not.toContain('SYNTHETIC UI');
 const restored=await page.evaluate(async(pass)=>{
  return MedControlModular3ProtectedSession.read();
 },PASS);
 expect(restored).toEqual(SAMPLE);
 await page.locator('#lock').click();
 await page.reload();
 await context.setOffline(true);
 await page.locator('#password').fill(PASS);
 await page.locator('#unlock').click();
 await expect(page.locator('#workspace')).toBeVisible();
 expect(await page.evaluate(()=>MedControlModular3ProtectedSession.read())).toEqual(SAMPLE);
 expect((await snapshot(page)).source).toBe(before.source);
 await context.close();
});
test('migration UI: encrypted storage failure cannot report success or alter source',async({browser})=>{
 const {context,page}=await setup(browser,true);
 const before=await snapshot(page);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#commit-migration').click();
 await expect(page.locator('#message')).toContainText('Перенос не завершён');
 await expect(page.locator('#workspace')).toBeHidden();
 expect(await snapshot(page)).toEqual(before);
 await context.close();
});
