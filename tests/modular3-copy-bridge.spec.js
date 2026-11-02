'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
test('T-046 copy-only bridge preserves synthetic medical state and leaves source unchanged',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 await page.addScriptTag({path:path.join(ROOT,'js/modular3-shard-store.js')});
 await page.addScriptTag({path:path.join(ROOT,'js/modular3-shard-crypto.js')});
 await page.addScriptTag({path:path.join(ROOT,'js/modular3-shard-vault.js')});
 await page.evaluate(()=>{
  const state={settings:{language:'ru',timezone:'Asia/Yerevan'},
   medications:[{id:'a',name:'synthetic',schedule:[{time:'09:00'}]}],
   intakeLogs:[{id:'e1',medicationId:'a',status:'taken',time:'2026-01-01'}],
   intakeCorrections:[{id:'c1',reason:'mistake'}],
   archiveHistory:[],archivedCourses:[]};
  window.__t046Source=structuredClone(state);
  window.MedControlModular3ProtectedSession=Object.freeze({
   isUnlocked:()=>true,read:()=>structuredClone(state)
  });
 });
 await page.addScriptTag({path:path.join(ROOT,'js/modular3-copy-bridge.js')});
 const result=await page.evaluate(async()=>{
  const owner='t046-copy-'+crypto.randomUUID(),password='synthetic-password-only';
  const bridge=window.MedControlModular3CopyBridge;
  const before=JSON.stringify(window.__t046Source);
  const copied=await bridge.copy({owner,password});
  const verified=await bridge.verify({owner,password,expected:window.__t046Source});
  const after=JSON.stringify(window.MedControlModular3ProtectedSession.read());
  let duplicateRejected=false;
  try{await bridge.copy({owner,password});}catch(_){duplicateRejected=true;}
  return {copied:copied.verified,verified:verified.equal,records:verified.records,
   unchanged:before===after,duplicateRejected};
 });
 expect(result).toEqual({copied:true,verified:true,records:9,unchanged:true,duplicateRejected:true});
});
