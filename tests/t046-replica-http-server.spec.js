'use strict';
const {test,expect}=require('@playwright/test');
const {createReplicaServer}=require('./helpers/t046-replica-http-server.cjs');
test('T-046 server enforces immutable objects and atomic concurrent head CAS',async()=>{
 const replica=createReplicaServer();const port=await replica.listen();
 const base='http://127.0.0.1:'+port;
 const call=async(method,path,body,token='test-token')=>{
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 };
 try{
  const segment='a'.repeat(64),first='b'.repeat(64),second='c'.repeat(64),vaultId='vault_test12345678';
  expect((await call('GET','/v1/head',undefined,'wrong')).status).toBe(401);
  expect((await call('PUT','/v1/segments/'+segment,{segment:{commitment:segment},tag:'original'})).status).toBe(200);
  expect((await call('PUT','/v1/segments/'+segment,{segment:{commitment:segment},tag:'forged'})).status).toBe(409);
  for(const id of [first,second]){
   expect((await call('PUT','/v1/manifests/'+id,{manifest:{commitment:id,vaultId,generation:1},tag:id})).status).toBe(200);
  }
  const results=await Promise.all([first,second].map(id=>call('POST','/v1/head/compare-and-swap',{
   expectedGeneration:0,previousCommitment:null,next:{vaultId,generation:1,commitment:id}
  })));
  expect(results.map(x=>x.status).sort()).toEqual([200,409]);
  const head=(await call('GET','/v1/head')).data;
  expect([first,second]).toContain(head.commitment);
  expect((await call('GET','/v1/manifests/'+head.commitment)).data.manifest.commitment).toBe(head.commitment);
  expect((await call('GET','/v1/segments/'+segment)).data.tag).toBe('original');
 }finally{await replica.close();}
});
