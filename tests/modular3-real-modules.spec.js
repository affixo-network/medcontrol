'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
const pages=['input','action','dashboard','archive'];
test('real MedControl modules mount with synthetic empty local state and isolated auth',async({browser})=>{
  const context=await browser.newContext({locale:'ru-RU',timezoneId:'Asia/Yerevan'});
  const synthetic={settings:{interfaceLanguage:'ru',country:'AM',timezone:'Asia/Yerevan',locale:'ru-RU',infoDismissed:true},medications:[],intakeLogs:[]};
  await context.addInitScript(({synthetic})=>{
    localStorage.setItem('affixo_medcontrol_standard_v3',JSON.stringify(synthetic));
    localStorage.removeItem('sb-lewdbjjaohqxbirzhrbm-auth-token');
  },{synthetic});
  for(const name of pages){
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='http://127.0.0.1:8765')return route.abort();
      if(url.pathname==='/js/auth-guard.js'){
        const mocked=guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","Promise.resolve({createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-only'},access_token:'fake',refresh_token:'fake'}},error:null})}})})");
        return route.fulfill({status:200,contentType:'application/javascript',body:mocked});
      }
      if(url.pathname==='/js/cloud-snapshot.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* disabled cloud snapshots in synthetic browser tests */'});
      return route.continue();
    });
    await page.goto('http://127.0.0.1:8765/'+name+'.html');
    if(name==='archive'){
      await expect(page.getByRole('heading',{name:'MedControl — Архив'})).toBeVisible({timeout:20000});
      await expect(page.getByRole('heading',{name:'Завершённые курсы'})).toBeVisible();
    }else{
      await expect.poll(async()=>page.locator('#app').innerText(),{timeout:20000}).not.toBe('MedControl');
      const text=await page.locator('#app').innerText();
      expect(text).not.toContain('Ошибка запуска MedControl');
    }
    expect(pageErrors).toEqual([]);
    const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('affixo_medcontrol_standard_v3')));
    expect(local.medications).toEqual([]);
    expect(local.intakeLogs).toEqual([]);
    await page.close();
  }
  await context.close();
});
