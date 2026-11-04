'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 two encrypted events form authenticated linked generations and reject stale head',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
  await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
 const result=await page.evaluate(async()=>{
  const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
  const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const api=window.MedControlT046IntegratedVault,head=window.MedControlT046ManifestHead;
  const first=await api.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
  const expectedHead=await head.read(vaultId);
  const second=await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead});
  const finalHead=await head.read(vaultId);
  const predecessor=await head.object(vaultId,second.manifest.previousCommitment);
  let staleRejected=false;
  try{await api.appendNextAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:3},encryptionKey,commitmentKey,expectedHead});}
  catch(e){staleRejected=/conflict/.test(e.message);}
  const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===vaultId);
  return {firstGeneration:first.manifest.generation,secondGeneration:second.manifest.generation,
   firstSequence:first.segment.firstSequence,secondSequence:second.segment.firstSequence,
   linked:second.manifest.previousCommitment===first.manifest.commitment,
   finalHead:finalHead.commitment,secondCommitment:second.manifest.commitment,
   predecessor:predecessor?.object.commitment,staleRejected,pending:pending.length};
 });
 expect(result.firstGeneration).toBe(1);
 expect(result.secondGeneration).toBe(2);
 expect(result.firstSequence).toBe(1);
 expect(result.secondSequence).toBe(2);
 expect(result.linked).toBe(true);
 expect(result.finalHead).toBe(result.secondCommitment);
 expect(result.predecessor).toBeTruthy();
 expect(result.staleRejected).toBe(true);
 expect(result.pending).toBe(2);
});


test('T-046 cross-tab same-head race leaves one committed successor and no orphan loser',async({browser})=>{
 const context=await browser.newContext();
 const [firstTab,secondTab]=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const tab of [firstTab,secondTab]){
   await tab.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
    await tab.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
  }
  const setup=await firstTab.evaluate(async()=>{
   const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
   const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
   const eventId='event_'+crypto.randomUUID().replaceAll('-','');
   await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId,kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
   return {vaultId,expectedHead:await window.MedControlT046ManifestHead.read(vaultId),
    encryption:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',encryptionKey))),
    commitment:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
  });
  const ids=['event_'+require('node:crypto').randomUUID().replaceAll('-',''),
             'event_'+require('node:crypto').randomUUID().replaceAll('-','')];
  const append=async(tab,eventId)=>tab.evaluate(async({setup,eventId})=>{
   const encryptionKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.encryption),'AES-GCM',false,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.commitment),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   try{
    const result=await window.MedControlT046IntegratedVault.appendNextAndStage({
     vaultId:setup.vaultId,eventId,kind:'intake',body:{dose:eventId},encryptionKey,commitmentKey,expectedHead:setup.expectedHead});
    return {ok:true,commitment:result.manifest.commitment};
   }catch(error){return {ok:false,error:String(error.message)};}
  },{setup,eventId});
  const outcomes=await Promise.all([append(firstTab,ids[0]),append(secondTab,ids[1])]);
  const inspection=await firstTab.evaluate(async({setup,ids})=>{
   const head=await window.MedControlT046ManifestHead.read(setup.vaultId);
   const events=await Promise.all(ids.map(id=>window.MedControlT046Journal.encrypted({owner:setup.vaultId,id})));
   const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===setup.vaultId);
   return {head,exists:events.map(Boolean),pending:pending.length};
  },{setup,ids});
  expect(outcomes.filter(x=>x.ok)).toHaveLength(1);
  expect(outcomes.filter(x=>!x.ok)).toHaveLength(1);
  expect(outcomes.find(x=>!x.ok).error).toMatch(/Manifest head conflict/);
  expect(inspection.head.generation).toBe(2);
  expect(inspection.head.commitment).toBe(outcomes.find(x=>x.ok).commitment);
  expect(inspection.exists).toEqual(outcomes.map(x=>x.ok));
  expect(inspection.pending).toBe(2);
 }finally{await context.close();}
});


test('T-046 concurrent tabs: injected failure before journal append cannot erase winning successor',async({browser})=>{
 const context=await browser.newContext();
 const tabs=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const tab of tabs){
   await tab.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
    await tab.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
  }
  const setup=await tabs[0].evaluate(async()=>{
   const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
   const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
   await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId:'event_'+crypto.randomUUID().replaceAll('-',''),kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
   return {vaultId,expectedHead:await window.MedControlT046ManifestHead.read(vaultId),
    encryption:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',encryptionKey))),
    commitment:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
  });
  const failedId='event_'+require('node:crypto').randomUUID().replaceAll('-','');
  const winningId='event_'+require('node:crypto').randomUUID().replaceAll('-','');
  const failure=await tabs[0].evaluate(async({setup,eventId})=>{
   const encryptionKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.encryption),'AES-GCM',false,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.commitment),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const original=window.MedControlT046Journal;
   window.MedControlT046Journal=Object.freeze({...original,append:async()=>{throw Error('Injected writer crash');}});
   try{await window.MedControlT046IntegratedVault.appendNextAndStage({vaultId:setup.vaultId,eventId,kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead:setup.expectedHead});return false;}
   catch(e){return /Injected writer crash/.test(e.message);}
   finally{window.MedControlT046Journal=original;}
  },{setup,eventId:failedId});
  const success=await tabs[1].evaluate(async({setup,eventId})=>{
   const encryptionKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.encryption),'AES-GCM',false,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.commitment),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   return window.MedControlT046IntegratedVault.appendNextAndStage({vaultId:setup.vaultId,eventId,kind:'intake',body:{dose:3},encryptionKey,commitmentKey,expectedHead:setup.expectedHead});
  },{setup,eventId:winningId});
  const state=await tabs[0].evaluate(async({setup,failedId,winningId})=>{
   const head=await window.MedControlT046ManifestHead.read(setup.vaultId);
   const lost=await window.MedControlT046Journal.encrypted({owner:setup.vaultId,id:failedId});
   const won=await window.MedControlT046Journal.encrypted({owner:setup.vaultId,id:winningId});
   const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===setup.vaultId);
   return {head,lost:!!lost,won:!!won,pending:pending.length};
  },{setup,failedId,winningId});
  expect(failure).toBe(true);
  expect(state.head.generation).toBe(2);
  expect(state.head.commitment).toBe(success.manifest.commitment);
  expect(state.lost).toBe(false);
  expect(state.won).toBe(true);
  expect(state.pending).toBe(2);
 }finally{await context.close();}
});


test('T-046 closing tab holding vault write lock lets surviving tab commit without history loss',async({browser})=>{
 const context=await browser.newContext();
 const [blockedTab,survivor]=await Promise.all([context.newPage(),context.newPage()]);
 try{
  for(const tab of [blockedTab,survivor]){
   await tab.goto('http://127.0.0.1:8765/t046-indexed-test.html');
   for(const name of ['journal','segment-codec','authenticated-commitment','replica-queue','manifest-head','integrated-vault'])
    await tab.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-'+name+'.js')});
  }
  const setup=await survivor.evaluate(async()=>{
   const vaultId='vault_'+crypto.randomUUID().replaceAll('-','');
   const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},true,['sign','verify']);
   const firstId='event_'+crypto.randomUUID().replaceAll('-','');
   await window.MedControlT046IntegratedVault.appendAndStage({vaultId,eventId:firstId,kind:'intake',body:{dose:1},encryptionKey,commitmentKey});
   return {vaultId,firstId,expectedHead:await window.MedControlT046ManifestHead.read(vaultId),
    encryption:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',encryptionKey))),
    commitment:Array.from(new Uint8Array(await crypto.subtle.exportKey('raw',commitmentKey)))};
  });
  // Hold the exact vault lock in one real browser tab until the tab is closed.
  const holding=blockedTab.evaluate(async(vaultId)=>{
   await navigator.locks.request('medcontrol-t046-chain-'+vaultId,{mode:'exclusive'},async()=>{
    window.__t046LockHeld=true;
    await new Promise(()=>{});
   });
  },setup.vaultId).catch(()=>{});
  await blockedTab.waitForFunction(()=>window.__t046LockHeld===true);
  const successorId='event_'+require('node:crypto').randomUUID().replaceAll('-','');
  const writing=survivor.evaluate(async({setup,eventId})=>{
   const encryptionKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.encryption),'AES-GCM',false,['encrypt','decrypt']);
   const commitmentKey=await crypto.subtle.importKey('raw',new Uint8Array(setup.commitment),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
   const result=await window.MedControlT046IntegratedVault.appendNextAndStage({
    vaultId:setup.vaultId,eventId,kind:'intake',body:{dose:2},encryptionKey,commitmentKey,expectedHead:setup.expectedHead});
   return {generation:result.manifest.generation,commitment:result.manifest.commitment};
  },{setup,eventId:successorId});
  // The queued writer cannot proceed while the other tab holds the lock.
  await survivor.waitForFunction(async vaultId=>{
   const state=await navigator.locks.query();
   return state.pending.some(x=>x.name==='medcontrol-t046-chain-'+vaultId);
  },setup.vaultId);
  await blockedTab.close();
  await holding;
  const written=await writing;
  const inspection=await survivor.evaluate(async({setup,eventId})=>{
   const head=await window.MedControlT046ManifestHead.read(setup.vaultId);
   const first=await window.MedControlT046Journal.encrypted({owner:setup.vaultId,id:setup.firstId});
   const second=await window.MedControlT046Journal.encrypted({owner:setup.vaultId,id:eventId});
   const pending=(await window.MedControlT046ReplicaQueue.pending()).filter(x=>x.vaultId===setup.vaultId);
   return {head,first:!!first,second:!!second,pending:pending.length};
  },{setup,eventId:successorId});
  expect(written.generation).toBe(2);
  expect(inspection.head.commitment).toBe(written.commitment);
  expect(inspection.first).toBe(true);
  expect(inspection.second).toBe(true);
  expect(inspection.pending).toBe(2);
 }finally{await context.close();}
});
