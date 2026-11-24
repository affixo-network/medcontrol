'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const controller=require('../js/modular3-protected-locale-controller.js');
const guard=fs.readFileSync(path.join(__dirname,'../js/auth-guard.js'),'utf8');

test('a stale language failure cannot erase or lock the newly authorized session UI',async()=>{
 const close=guard.match(/  async function closeProtectedLocaleFailure\([^\n]*\)\{[\s\S]*?\n  \}/);
 assert.ok(close);
 let epoch=1,lockCalls=0,release,started;
 const paused=new Promise(resolve=>{release=resolve;});
 const entered=new Promise(resolve=>{started=resolve;});
 const app={textContent:'Old session records'};
 const session={entryEpoch:()=>epoch,isEntryAuthorized:()=>true,isUnlocked:()=>true,
  read:()=>({settings:{interfaceLanguage:'ru'}}),lock:async()=>{lockCalls++;}};
 const context=vm.createContext({validatedActiveLanguage:'ru',document:{getElementById:()=>app},
  window:{MedControlModular3ProtectedSession:session,medcontrolProtectedLocaleFailureLabel:'Old request error',
   medcontrolProtectedLocaleRefreshError:'current diagnostic',medcontrolOfflineShellReady:true}});
 vm.runInContext(close[0],context);
 const change=controller.create({session,policy:{resolve:code=>code,async confirm(){
  started();await paused;const error=Error('Protected session changed');
  error.code='protected_session_changed';error.expectedEntryEpoch=1;error.actualEntryEpoch=epoch;throw error;
 }},stage:async()=>{},render:async()=>{},notify:()=>{},document:{querySelectorAll:()=>[]},
 failClosed:context.closeProtectedLocaleFailure});
 const pending=change.change('fil');await entered;
 epoch=3;app.textContent='Newly authorized session records';release();
 assert.equal(await pending,false);
 assert.equal(lockCalls,0,'Stale failure cannot lock the later unlock');
 assert.equal(app.textContent,'Newly authorized session records','Stale failure must not erase the later session UI');
 assert.equal(context.validatedActiveLanguage,'ru');
 assert.equal(context.window.medcontrolProtectedLocaleRefreshError,'current diagnostic');
 assert.equal(context.window.medcontrolOfflineShellReady,true);
});

test('a stale failure hides old medical UI when the new epoch is still unauthorized without locking it',async()=>{
 const close=guard.match(/  async function closeProtectedLocaleFailure\([^\n]*\)\{[\s\S]*?\n  \}/);
 assert.ok(close);
 let lockCalls=0;
 const app={textContent:'Old medical records'};
 const session={entryEpoch:()=>3,isEntryAuthorized:()=>false,isUnlocked:()=>true,lock:async()=>{lockCalls++;}};
 const context=vm.createContext({validatedActiveLanguage:'ru',document:{getElementById:()=>app},
  window:{MedControlModular3ProtectedSession:session,medcontrolProtectedLocaleFailureLabel:'Selected error'}});
 vm.runInContext(close[0],context);
 const error=Error('Protected session changed');error.code='protected_session_changed';error.expectedEntryEpoch=1;
 await context.closeProtectedLocaleFailure(error,{expectedEntryEpoch:1});
 assert.equal(app.textContent,'Selected error');
 assert.equal(lockCalls,0,'An unauthorized later unlock also owns its own session');
 assert.equal(context.validatedActiveLanguage,null);
});

test('validated locale cache still rejects unconfirmed settings and validates a changed language',async()=>{
 const ensure=guard.match(/  async function ensureSelectedPublicLocale\(\)\{[\s\S]*?\n  \}/);
 assert.ok(ensure);
 let settings={interfaceLanguage:'ru',languageChoiceConfirmed:true},restores=0;
 const context=vm.createContext({validatedActiveLanguage:'ru',getState:()=>({settings}),
  window:{medcontrolProtectedInterface:true,MedControlModular3ProtectedSession:{read:()=>({settings})},
   MedControlEntryLanguages:{confirmed:value=>value.languageChoiceConfirmed===true,restore:async()=>{restores++;}}}});
 vm.runInContext(ensure[0],context);
 assert.equal(await context.ensureSelectedPublicLocale(),true);assert.equal(restores,0);
 settings={interfaceLanguage:'ru',languageChoiceConfirmed:false};
 await assert.rejects(context.ensureSelectedPublicLocale(),/Unconfirmed/);
 settings={interfaceLanguage:'fil',languageChoiceConfirmed:true};
 assert.equal(await context.ensureSelectedPublicLocale(),true);assert.equal(restores,1);
 assert.equal(context.validatedActiveLanguage,'fil');
});
