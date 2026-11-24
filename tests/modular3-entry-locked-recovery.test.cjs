'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const controller=require('../js/modular3-protected-locale-controller.js');

test('a language transaction that locks before resolving removes the medical interface',async()=>{
 let unlocked=true,medicalVisible=true,closed=0;
 const selector={value:'fil'};
 const session={isEntryAuthorized:()=>unlocked,isUnlocked:()=>unlocked,read(){
  if(!unlocked)throw Error('Protected session locked');
  return {settings:{interfaceLanguage:'ru'}};
 }};
 const locale=controller.create({session,policy:{resolve:value=>value,async confirm(){
  // This is the protected session's existing cross-tab checkpoint failure contract.
  unlocked=false;throw Error('Encrypted data changed in another tab; unlock again');
 }},document:{querySelectorAll:()=>[selector]},stage:async()=>{},render:async()=>{},
 notify:()=>{},failClosed:async()=>{closed++;medicalVisible=false;}});
 assert.equal(await locale.change('fil'),false);
 assert.equal(unlocked,false);
 assert.equal(closed,1,'A rejected transaction can already have locked the session');
 assert.equal(medicalVisible,false,'Rendered records must disappear after invalidation');
});

test('first language confirmation that locks restores password entry without changing stored copies',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/modular3-protected-workspace.js'),'utf8');
 const handler=source.match(/ confirmEntryLanguage.onclick=async\(\)=>\{[\s\S]*?\n \};/);
 assert.ok(handler,'Exercise the reachable production confirmation handler');
 const helper=source.match(/ (?:async )?function resetEntryAfterLock\([^)]*\)\{[\s\S]*?\n \}/);
 const stored=new Map([['medcontrol_modular3_protected_state_v1','synthetic ciphertext'],['medcontrol_modular3_local_credential_v1','synthetic credential']]);
 const before=[...stored];
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',setAttribute(){}});return nodes.get(id);};
 const passwordLabel=node('password-label');passwordLabel.hidden=true;
 const password=node('password');password.closest=()=>passwordLabel;
 node('unlock').hidden=true;node('preserved-backups').hidden=false;
 const languageStep=node('entry-language-step');
 const context={document:{getElementById:node,documentElement:{lang:'fil',dir:'ltr'}},
  localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  session:{isUnlocked:()=>true,isEntryAuthorized:()=>false,lock:async()=>{}},
  confirmEntryLanguage:node('confirm-entry-language'),entryLanguage:node('entry-language'),languageStep,
  confirmPasswordLabel:node('confirm-password-label'),confirmPassword:node('confirm-password'),password,
  login:node('login'),workspace:node('workspace'),languagePanel:node('protected-language-choice'),
  languagePending:true,languageConfirmed:false,confirmationBusy:false,confirmingCode:null,entryLocaleVersion:0,
  preparedEntry:{code:'fil'},currentLanguage:'fil',pendingOperationNotice:null,entryOriginals:new Map(),
  policy:{async confirm(){context.session.isUnlocked=()=>false;throw Error('Encrypted write and rollback failed; session locked');}},
  notice:()=>{},paintEntry:()=>{},textFor:(_,text)=>text,render:()=>{},window:{},console};
 context.entryLanguage.value='fil';context.workspace.hidden=true;
 vm.createContext(context);
 if(helper)vm.runInContext(helper[0],context);
 vm.runInContext(handler[0],context);
 await context.confirmEntryLanguage.onclick();
 assert.equal(context.session.isUnlocked(),false);
 assert.equal(passwordLabel.hidden,false,'Locked sessions must offer password re-entry');
 assert.equal(node('unlock').hidden,false);
 assert.equal(languageStep.hidden,true);
 assert.equal(context.languagePending,false);
 assert.equal(context.languageConfirmed,false);
 assert.equal(context.workspace.hidden,true);
 assert.equal(node('preserved-backups').hidden,false);
 assert.deepEqual([...stored],before,'Recovery UI must retain vault and credential');
});

test('stale language error leaves a later authorized interface and its notices unchanged',async()=>{
 let epoch=1,notices=0,closures=0;let release;const gate=new Promise(resolve=>{release=resolve;});
 const session={entryEpoch:()=>epoch,isEntryAuthorized:()=>true,isUnlocked:()=>true,read:()=>({settings:{interfaceLanguage:'ru'}})};
 const locale=controller.create({session,policy:{resolve:x=>x,confirm:async()=>{await gate;const error=Error('stale');error.code='protected_session_changed';throw error;}},document:{querySelectorAll:()=>[]},render:async()=>{},stage:async()=>{},notify:()=>{notices++;},failClosed:async()=>{closures++;}});
 const pending=locale.change('fil');await Promise.resolve();epoch=3;release();assert.equal(await pending,false);assert.equal(notices,0);assert.equal(closures,0);
});
