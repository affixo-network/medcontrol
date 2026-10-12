'use strict';
const {test,expect}=require('@playwright/test');
test('offline access prototype: password, lock, reload offline, four section selectors',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-proof.html');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('/tests/modular3-offline-sw.js',{scope:'/tests/'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
 });
 await page.goto('http://127.0.0.1:8765/tests/modular3-offline-access.html');
 await page.locator('#passphrase').fill('Synthetic-Test-Only-Secret-2026');
 await page.getByRole('button',{name:'Unlock offline'}).click();
 await expect(page.locator('#sections')).toBeVisible();
 await page.locator('#lock').click();
 await expect(page.locator('#sections')).toBeHidden();
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('#sections')).toBeHidden();
 await page.locator('#passphrase').fill('wrong-secret-123');
 await page.getByRole('button',{name:'Unlock offline'}).click();
 await expect(page.locator('#content')).toContainText('Access denied');
 await page.locator('#passphrase').fill('Synthetic-Test-Only-Secret-2026');
 await page.getByRole('button',{name:'Unlock offline'}).click();
 await expect(page.locator('#sections')).toBeVisible();
 for(const section of ['input','action','dashboard','archive']){
  await page.locator('[data-section="'+section+'"]').click();
  await expect(page.locator('#content h2')).toHaveText(({input:'Ввод',action:'Приём препаратов',dashboard:'Табло',archive:'Архив'})[section]);
 }
 await context.close();
});
