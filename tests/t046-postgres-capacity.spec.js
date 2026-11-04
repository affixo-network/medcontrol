'use strict';
const {test,expect}=require('@playwright/test');
const {Pool}=require('pg');
const {createCapacityLedger}=require('./helpers/t046-postgres-capacity.cjs');
test('T-046 capacity ledger is atomic across pools and idempotent for retries',async()=>{
 const url=process.env.T046_POSTGRES_URL;
 expect(url).toBeTruthy();
 const a=new Pool({connectionString:url}),b=new Pool({connectionString:url});
 const vaultId='capacity_'+Date.now();
 try{
  await a.query('INSERT INTO t046_replica_capacity(vault_id,limit_bytes) VALUES($1,$2)',[vaultId,100]);
  const left=createCapacityLedger(a,vaultId),right=createCapacityLedger(b,vaultId);
  const competing=await Promise.all([left.reserve('one',70),right.reserve('two',70)]);
  expect(competing.filter(x=>x.reserved)).toHaveLength(1);
  expect(await left.available()).toBe(30);
  const duplicate=await Promise.all([left.reserve('same',20),right.reserve('same',20)]);
  expect(duplicate.every(x=>x.reserved)).toBe(true);
  expect(await right.available()).toBe(10);
  expect((await left.reserve('same',21)).reserved).toBe(false);
  expect(await left.available()).toBe(10);
  const rejected=await left.reconcileMeasuredCapacity(async()=>80);
  expect(rejected).toEqual({updated:false,reason:'RESERVATIONS_EXCEED_MEASUREMENT'});
  expect(await left.available()).toBe(10);
  const expanded=await left.reconcileMeasuredCapacity(async()=>200);
  expect(expanded).toEqual({updated:true,limitBytes:200});
  expect(await left.available()).toBe(110);
 }finally{await Promise.all([a.end(),b.end()]);}
});
