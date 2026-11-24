'use strict';
const {test,expect}=require('@playwright/test');
// Multiple real encrypted reopen flows and full worker-cache acknowledgment.
test.setTimeout(120000);
const {BASE,openProtected}=require('./modular3-protected-test-fixture.cjs');
const pages=['input','action','dashboard','archive'];
test('real MedControl modules mount with synthetic empty local state and explicit protected entry',async({browser})=>{
  const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan',serviceWorkers:'block'});
  const synthetic={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[]};
  for(const name of pages){
    const page=await context.newPage();
    const pageErrors=[];
    const consoleErrors=[];
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('pageerror',e=>pageErrors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===BASE?route.continue():route.abort());
    await openProtected(page,name,synthetic);
    await page.waitForTimeout(1200);
    console.log('E2E_DIAG '+JSON.stringify({section:name,url:page.url(),app:await page.locator('#app').allTextContents(),errors:pageErrors,consoleErrors,body:(await page.locator('body').innerText()).slice(0,600)}));
    if(name==='archive'){
      await expect(page.getByRole('heading',{name:'MedControl — Архив'})).toBeVisible({timeout:20000});
      await expect(page.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible();
    }else{
      await expect(page.locator('body')).toContainText('MedControl', {timeout:20000});
      await expect(page.locator('body')).not.toContainText('Ошибка запуска MedControl');
      await expect(page.locator('body')).not.toContainText('Проверка авторизации MedControl');
    }
    expect(pageErrors).toEqual([]);
    const local=await page.evaluate(()=>MedControlModular3ProtectedSession.read());
    expect(local.medications).toEqual([]);
    expect(local.intakeLogs).toEqual([]);
    await page.close();
  }
  await context.close();
});
