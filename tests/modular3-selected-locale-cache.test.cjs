'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function fixture(){
 const source=fs.readFileSync(require('node:path').join(__dirname,'../js/auth-guard.js'),'utf8');
 const body=source.match(/  async function ensureSelectedPublicLocale\(\)\{[\s\S]*?\n  \}/)[0];
 let settings={interfaceLanguage:'fil',interfaceLanguageConfirmed:true,interfaceLanguageVersion:1},calls=0;
 const context={window:{medcontrolProtectedInterface:true,MedControlModular3ProtectedSession:{read:()=>({settings})},MedControlEntryLanguages:{confirmed:s=>s.interfaceLanguageConfirmed===true,restore:async()=>{calls++;}}},getState:()=>{},stagePublicLocale:async()=>{}};
 vm.createContext(context);vm.runInContext('let validatedActiveLanguage=null;'+body,context);
 return {run:()=>context.ensureSelectedPublicLocale(),calls:()=>calls,set:s=>{settings=s;}};
}
test('observer refreshes reuse the validated current locale instead of refetching its entire offline shell',async()=>{const f=fixture();await f.run();await f.run();assert.equal(f.calls(),1);f.set({interfaceLanguage:'ar',interfaceLanguageConfirmed:true});await f.run();assert.equal(f.calls(),2);});
test('cached language never bypasses saved confirmation validation',async()=>{const f=fixture();await f.run();f.set({interfaceLanguage:'fil',interfaceLanguageConfirmed:false});await assert.rejects(f.run(),/Unconfirmed/);assert.equal(f.calls(),1);});
