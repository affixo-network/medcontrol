'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
test('T-046 isolated encrypted shards: durable paging, identity binding, stale-write rejection',async({page})=>{
  await page.goto('http://127.0.0.1:8765/auth-login.html');
  await page.addScriptTag({path:path.join(ROOT,'js/modular3-shard-crypto.js')});
  await page.addScriptTag({path:path.join(ROOT,'js/modular3-shard-store.js')});
  const result=await page.evaluate(async()=>{
    const cryptoApi=window.MedControlModular3ShardCrypto;
    const store=window.MedControlModular3ShardStore;
    const owner='synthetic-t046-'+crypto.randomUUID();
    const key=await cryptoApi.deriveKey('synthetic-test-password-only',cryptoApi.newSalt());
    const session=cryptoApi.session(key);
    const one=await session.encrypt(owner,'001',{medication:'synthetic-only',revision:1});
    const two=await session.encrypt(owner,'002',{medication:'synthetic-only',revision:2});
    await store.createEncrypted(owner,'001',one);
    await store.createEncrypted(owner,'002',two);
    let duplicateRejected=false;
    try{await store.createEncrypted(owner,'001',one);}catch(_){duplicateRejected=true;}
    const first=await store.pageEncrypted(owner,{limit:1});
    const second=await store.pageEncrypted(owner,{after:first.next,limit:1});
    const end=await store.pageEncrypted(owner,{after:second.rows[0].id,limit:1});
    const next=await session.encrypt(owner,'001',{medication:'synthetic-only',revision:3});
    await store.replaceEncryptedIfMatch(owner,'001',one,next);
    let staleRejected=false;
    try{await store.replaceEncryptedIfMatch(owner,'001',one,two);}catch(_){staleRejected=true;}
    let wrongIdentityRejected=false;
    try{await session.decrypt(owner,'002',next);}catch(_){wrongIdentityRejected=true;}
    const stored=await store.getEncrypted(owner,'001');
    const decrypted=await session.decrypt(owner,'001',stored);
    return {duplicateRejected,staleRejected,wrongIdentityRejected,
      first:first.rows.map(x=>x.id),second:second.rows.map(x=>x.id),
      end:end.rows.length===0&&end.next===null,
      revision:decrypted.revision};
  });
  expect(result).toEqual({duplicateRejected:true,staleRejected:true,wrongIdentityRejected:true,
    first:['001'],second:['002'],end:true,revision:3});
});

test('T-046 sharded vault: reopen, wrong password, paging, stale update, lock',async({page})=>{
  await page.goto('http://127.0.0.1:8765/auth-login.html');
  for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
    await page.addScriptTag({path:path.join(ROOT,'js',name)});
  const owner='synthetic-vault-'+Date.now()+'-'+Math.random();
  const password='synthetic-vault-password-only';
  const result=await page.evaluate(async({owner,password})=>{
    const vault=window.MedControlModular3ShardVault;
    const first=await vault.create(owner,password);
    await first.createRecord('001',{dose:1});
    await first.createRecord('002',{dose:2});
    let duplicateRejected=false;
    try{await first.createRecord('001',{dose:9});}catch(_){duplicateRejected=true;}
    first.lock();
    let lockedRejected=false;
    try{await first.getRecord('001');}catch(_){lockedRejected=true;}
    let wrongPasswordRejected=false;
    try{await vault.open(owner,'incorrect-password-123');}catch(_){wrongPasswordRejected=true;}
    const reopened=await vault.open(owner,password);
    const firstPage=await reopened.page({limit:1});
    const secondPage=await reopened.page({after:firstPage.next,limit:1});
    const before=await reopened.getRecord('001');
    const updated=await reopened.replaceRecord('001',before,{dose:3});
    let staleRejected=false;
    try{await reopened.replaceRecord('001',before,{dose:4});}catch(_){staleRejected=true;}
    return {duplicateRejected,lockedRejected,wrongPasswordRejected,staleRejected,
      pages:[firstPage.rows.map(r=>r.id),secondPage.rows.map(r=>r.id)],
      doses:[updated.dose,(await reopened.getRecord('002')).dose]};
  },{owner,password});
  expect(result).toEqual({duplicateRejected:true,lockedRejected:true,
    wrongPasswordRejected:true,staleRejected:true,pages:[['001'],['002']],doses:[3,2]});
  // A real navigation destroys the in-memory key and module session.
  await page.reload();
  for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
    await page.addScriptTag({path:path.join(ROOT,'js',name)});
  const restored=await page.evaluate(async({owner,password})=>{
    const vault=await window.MedControlModular3ShardVault.open(owner,password);
    const first=await vault.getRecord('001');
    const second=await vault.getRecord('002');
    const pageOne=await vault.page({limit:1});
    vault.lock();
    return {first,second,pageOne:pageOne.rows.map(r=>r.id)};
  },{owner,password});
  expect(restored).toEqual({first:{dose:3},second:{dose:2},pageOne:['001']});
});

test('T-046 interrupted writes leave previously committed encrypted records intact',async({page})=>{
  await page.goto('http://127.0.0.1:8765/auth-login.html');
  for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
    await page.addScriptTag({path:path.join(ROOT,'js',name)});
  const result=await page.evaluate(async()=>{
    const owner='synthetic-interruption-'+crypto.randomUUID();
    const vault=await window.MedControlModular3ShardVault.create(owner,'synthetic-interruption-password');
    await vault.createRecord('001',{revision:1});
    // Inject a failure through IndexedDB itself; the exported store is frozen.
    const nativeOpen=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){
      throw Error('Synthetic storage interruption');
    };
    let interrupted=false;
    try{await vault.replaceRecord('001',{revision:1},{revision:2});}
    catch(error){interrupted=Boolean(error);}
    finally{IDBObjectStore.prototype.put=nativeOpen;}
    const stillCommitted=await vault.getRecord('001');
    vault.lock();
    const reopened=await window.MedControlModular3ShardVault.open(owner,'synthetic-interruption-password');
    const restored=await reopened.getRecord('001');
    return {interrupted,stillCommitted,restored};
  });
  expect(result).toEqual({interrupted:true,stillCommitted:{revision:1},restored:{revision:1}});
});

test('T-046 encrypted backup pages retain vault salt and ciphertext without plaintext',async({page})=>{
  await page.goto('http://127.0.0.1:8765/auth-login.html');
  for(const name of ['modular3-shard-crypto.js','modular3-shard-store.js','modular3-shard-vault.js'])
    await page.addScriptTag({path:path.join(ROOT,'js',name)});
  const result=await page.evaluate(async()=>{
    const owner='synthetic-backup-'+crypto.randomUUID();
    const vault=await window.MedControlModular3ShardVault.create(owner,'synthetic-backup-password');
    await vault.createRecord('001',{medicine:'synthetic-secret-only',dose:1});
    const first=await vault.exportEncryptedPage({limit:1});
    const second=await vault.exportEncryptedPage({after:first.next,limit:1});
    const all=[...first.rows,...second.rows];
    const metadata=all.find(row=>row.id==='!vault');
    const medical=all.find(row=>row.id==='001');
    const serialized=JSON.stringify(all);
    const hasSalt=typeof metadata?.ciphertext?.salt==='string';
    const hasCipher=typeof medical?.ciphertext?.ciphertext==='string';
    const noPlaintext=!serialized.includes('synthetic-secret-only');
    return {hasSalt,hasCipher,noPlaintext,ids:all.map(row=>row.id),end:second.next===null};
  });
  expect(result).toEqual({hasSalt:true,hasCipher:true,noPlaintext:true,
    ids:['!vault','001'],end:true});
});
