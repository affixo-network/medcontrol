'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const storage=fs.readFileSync(path.resolve(__dirname,'../js/storage.js'),'utf8');
test('real storage refuses failed writes and keeps prior medicine and intake history intact',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 const outcome=await page.evaluate(source=>{
  localStorage.clear();
  (0,eval)(source);
  const key='affixo_medcontrol_standard_v3';
  const original={settings:{interfaceLanguage:'ru',timezone:'Asia/Yerevan'},medications:[{id:'SYNTH-FAIL',name:'Preserve me'}],intakeLogs:[{id:'SYNTH-TAKEN',action:'taken'}]};
  if(!saveState(original,{silent:true}))throw Error('seed failed');
  const prior=localStorage.getItem(key);
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,k,v);};
  let saved,stillOriginal;
  try{
   const changed=structuredClone(original);changed.intakeLogs.push({id:'SYNTH-CANCEL',action:'cancelled'});
   saved=saveState(changed,{silent:true});
   stillOriginal=localStorage.getItem(key)===prior;
  }finally{Storage.prototype.setItem=set;}
  const recovered=getState();
  return {saved,stillOriginal,medications:recovered.medications.length,logs:recovered.intakeLogs.length};
 },storage);
 expect(outcome).toEqual({saved:false,stillOriginal:true,medications:1,logs:1});
});
test('real storage preserves corrupted bytes and stops startup if emergency backup write fails',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 const outcome=await page.evaluate(source=>{
  localStorage.clear();
  (0,eval)(source);
  const key='affixo_medcontrol_standard_v3',backup=key+'_corrupt_backup',raw='{CORRUPTED-SYNTHETIC';
  localStorage.setItem(key,raw);
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===backup)throw new DOMException('Storage blocked','QuotaExceededError');return set.call(this,k,v);};
  let code;
  try{getState();code='unexpected_success';}catch(e){code=e.code;}finally{Storage.prototype.setItem=set;}
  return {code,originalPreserved:localStorage.getItem(key)===raw,backupExists:localStorage.getItem(backup)!==null};
 },storage);
 expect(outcome).toEqual({code:'corrupt_backup_failed',originalPreserved:true,backupExists:false});
});
test('real storage stops startup without modifying original when mandatory pre-upgrade backup cannot be created',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 const outcome=await page.evaluate(source=>{
  localStorage.clear();
  (0,eval)(source);
  const key='affixo_medcontrol_standard_v3',backup=key+'_pre_modular_2_upgrade_backup';
  const raw=JSON.stringify({settings:{interfaceLanguage:'ru'},medications:[{id:'SYNTH-BACKUP'}],intakeLogs:[{id:'SYNTH-HISTORY'}]});
  localStorage.setItem(key,raw);
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===backup)throw new DOMException('Backup blocked','QuotaExceededError');return set.call(this,k,v);};
  let code;
  try{getState();code='unexpected_success';}catch(e){code=e.code;}finally{Storage.prototype.setItem=set;}
  return {code,originalPreserved:localStorage.getItem(key)===raw,backupExists:localStorage.getItem(backup)!==null};
 },storage);
 expect(outcome).toEqual({code:'pre_upgrade_backup_failed',originalPreserved:true,backupExists:false});
});
