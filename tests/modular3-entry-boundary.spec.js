'use strict';
const {test,expect}=require('@playwright/test');
const BASE=process.env.MEDCONTROL_BOUNDARY_BASE||'http://127.0.0.1:8765';
const KEY='medcontrol_modular3_protected_state_v1';
const PASS='Synthetic-Entry-Boundary-Password-2026';
async function open(page,invalid=false){
 await page.route(BASE+'/entry-boundary-harness.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic boundary test</title>'}));
 await page.goto(BASE+'/entry-boundary-harness.html');
 for(const name of ['entry-languages','encrypted-vault','offline-credential','protected-session','course-lifecycle-browser','write-boundary','protected-pages'])await page.addScriptTag({url:BASE+'/js/modular3-'+name+'.js'});
 await page.evaluate(async({PASS,invalid})=>{
  await MedControlModular3ProtectedSession.initialize({settings:{interfaceLanguage:invalid?'xx':'fil',languageChoiceConfirmed:true,languageConfirmationVersion:1,timezone:'UTC'},medications:[{id:'synthetic-boundary-course',times:['09:00']}],intakeLogs:[]},PASS);
 },{PASS,invalid});
}
test('setup unlock does not permit page reads or writes before explicit Enter authorization',async({page})=>{
 await open(page);
 const result=await page.evaluate(async key=>{
  const s=MedControlModular3ProtectedSession,b=MedControlModular3WriteBoundary,p=MedControlModular3ProtectedPages;
  const original=localStorage.getItem(key),reads=[],writes=[];
  for(const section of b.pages){
   try{b.read(section);reads.push(false);}catch(_){reads.push(true);}
   try{await b.write(section,state=>state.intakeLogs.push({id:'forbidden'}));writes.push(false);}catch(_){writes.push(true);}
  }
  let adapterRead=false,adapterWrite=false;
  try{p.dashboard();}catch(_){adapterRead=true;}
  try{await p.addHistory({id:'forbidden-history'});}catch(_){adapterWrite=true;}
  return {reads,writes,adapterRead,adapterWrite,enabled:[b.enabled(),p.enabled()],unlocked:s.isUnlocked(),authorized:s.isEntryAuthorized(),unchanged:localStorage.getItem(key)===original,setupReadable:s.read().settings.interfaceLanguage};
 },KEY);
 expect(result).toEqual({reads:[true,true,true,true],writes:[true,true,true,true],adapterRead:true,adapterWrite:true,enabled:[false,false],unlocked:true,authorized:false,unchanged:true,setupReadable:'fil'});
});
test('explicit authorization enables real page operations and persists only encrypted records',async({page})=>{
 await open(page);
 const result=await page.evaluate(async key=>{
  const s=MedControlModular3ProtectedSession,b=MedControlModular3WriteBoundary,p=MedControlModular3ProtectedPages;
  s.authorizeEntry();const original=localStorage.getItem(key);
  await b.write('action',state=>state.intakeLogs.push({id:'synthetic-authorized-event'}));
  await p.addHistory({id:'synthetic-authorized-history'});
  const stored=localStorage.getItem(key),record=JSON.parse(stored);
  return {enabled:[b.enabled(),p.enabled()],changed:stored!==original,cipher:record.cipher,leak:stored.includes('synthetic-authorized'),log:b.read('action').intakeLogs[0].id,history:p.archive().intakeCorrections[0].id};
 },KEY);
 expect(result).toEqual({enabled:[true,true],changed:true,cipher:'AES-256-GCM',leak:false,log:'synthetic-authorized-event',history:'synthetic-authorized-history'});
});
test('invalid saved locale cannot authorize page adapters or change ciphertext',async({page})=>{
 await open(page,true);
 const result=await page.evaluate(async key=>{
  const s=MedControlModular3ProtectedSession,b=MedControlModular3WriteBoundary,p=MedControlModular3ProtectedPages;
  const original=localStorage.getItem(key);let authorizeRejected=false,writeRejected=false;
  try{s.authorizeEntry();}catch(_){authorizeRejected=true;}
  try{await b.write('input',state=>state.medications=[]);}catch(_){writeRejected=true;}
  return {authorizeRejected,writeRejected,enabled:[b.enabled(),p.enabled()],unchanged:localStorage.getItem(key)===original};
 },KEY);
 expect(result).toEqual({authorizeRejected:true,writeRejected:true,enabled:[false,false],unchanged:true});
});
test('unauthorized submission is rejected even when authorization occurs before queue execution',async({page})=>{
 await open(page);
 const result=await page.evaluate(async key=>{
  const s=MedControlModular3ProtectedSession,b=MedControlModular3WriteBoundary,original=localStorage.getItem(key);
  const operation=b.write('input',state=>{state.forbidden='queued-before-enter';});s.authorizeEntry();
  let rejected=false;try{await operation;}catch(_){rejected=true;}
  return {rejected,unchanged:localStorage.getItem(key)===original,mutated:!!s.read().forbidden};
 },KEY);
 expect(result).toEqual({rejected:true,unchanged:true,mutated:false});
});
test('queued page transaction rechecks authorization after preceding setup invalidation',async({page})=>{
 await open(page);
 const result=await page.evaluate(async key=>{
  const s=MedControlModular3ProtectedSession,b=MedControlModular3WriteBoundary;s.authorizeEntry();
  let release,started;const blocked=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});
  const invalidation=s.transact(async state=>{started();await blocked;state.settings.interfaceLanguage='xx';});
  await entered;let callbackRan=false;
  const queued=b.write('input',state=>{callbackRan=true;state.forbidden='queued-after-invalid-locale';});
  // Let the boundary submit its transaction behind the already pending setup write.
  await new Promise(resolve=>setTimeout(resolve,0));release();await invalidation;
  const invalidated=localStorage.getItem(key);let rejected=false;try{await queued;}catch(_){rejected=true;}
  return {rejected,callbackRan,unchanged:localStorage.getItem(key)===invalidated,mutated:!!s.read().forbidden,authorized:s.isEntryAuthorized()};
 },KEY);
 expect(result).toEqual({rejected:true,callbackRan:false,unchanged:true,mutated:false,authorized:false});
});
