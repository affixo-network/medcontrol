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

test('T-046 10 courses and 1200 events: paged copy, exact reconstruction, tamper detection',async({page})=>{
 test.setTimeout(120000);
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 for(const file of ['modular3-shard-store.js','modular3-shard-crypto.js','modular3-shard-vault.js'])
  await page.addScriptTag({path:path.join(ROOT,'js',file)});
 await page.evaluate(()=>{
  const state={
   settings:{language:'ru',timezone:'Asia/Yerevan'},
   medications:Array.from({length:10},(_,i)=>({id:'course-'+i,name:'Synthetic course '+i})),
   intakeLogs:Array.from({length:1200},(_,i)=>({id:'event-'+i,course:'course-'+(i%10),status:i%7?'taken':'missed',time:'2026-01-01T09:00:00Z'})),
   intakeCorrections:[],archiveHistory:[],archivedCourses:[]
  };
  window.__t046Large=state;
  window.MedControlModular3ProtectedSession=Object.freeze({isUnlocked:()=>true,read:()=>structuredClone(state)});
 });
 await page.addScriptTag({path:path.join(ROOT,'js/modular3-copy-bridge.js')});
 const result=await page.evaluate(async()=>{
  const owner='t046-copy-'+crypto.randomUUID(),password='synthetic-event-password';
  const bridge=window.MedControlModular3CopyBridge;
  const progress=[];
  const copied=await bridge.copy({owner,password,onProgress:p=>progress.push(p.copied)});
  const good=await bridge.verify({owner,password,expected:window.__t046Large});
  const vault=await window.MedControlModular3ShardVault.open(owner,password);
  const id='item:intakeLogs:000000000001';
  const record=await vault.getRecord(id);
  await vault.replaceRecord(id,record,{...record,status:'tampered'});
  vault.lock();
  const bad=await bridge.verify({owner,password,expected:window.__t046Large});
  return {copied:copied.verified,good:good.equal,bad:bad.equal,
   records:good.records,batches:progress.length,sourceIntact:window.__t046Large.intakeLogs[1].status==='taken'};
 });
 expect(result).toEqual({copied:true,good:true,bad:false,records:1216,batches:13,sourceIntact:true});
});
