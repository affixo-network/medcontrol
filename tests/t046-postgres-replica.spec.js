'use strict';
const {test,expect}=require('@playwright/test');
const {Pool}=require('pg');
const {createPostgresReplica}=require('./helpers/t046-postgres-replica.cjs');
test('two independent database connections enforce one winner',async()=>{
 const url=process.env.T046_POSTGRES_URL;
 expect(url).toBeTruthy();
 const leftPool=new Pool({connectionString:url}),rightPool=new Pool({connectionString:url});
 const vaultId='isolated_'+Date.now();
 try{
  const left=createPostgresReplica(leftPool,vaultId);
  const right=createPostgresReplica(rightPool,vaultId);
  const a='a'.repeat(64),b='b'.repeat(64);
  await left.putManifest(a,{manifest:{commitment:a,vaultId,generation:1}});
  await right.putManifest(b,{manifest:{commitment:b,vaultId,generation:1}});
  const results=await Promise.all([
   left.compareAndSwapHead(0,null,{vaultId,generation:1,commitment:a}),
   right.compareAndSwapHead(0,null,{vaultId,generation:1,commitment:b})
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const head=await right.getHead();
  expect([a,b]).toContain(head.commitment);
  expect(await left.getHead()).toEqual(head);
 }finally{await Promise.all([leftPool.end(),rightPool.end()]);}
});
