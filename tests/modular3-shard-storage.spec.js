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
