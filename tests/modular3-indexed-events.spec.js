'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 indexed encrypted event writes are atomic and owner scoped',async({page})=>{
 await page.goto('http://127.0.0.1:8765/input.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-indexed-events.js')});
 const result=await page.evaluate(async()=>{
  const api=MedControlT046IndexedEvents;
  const owner='synthetic-'+crypto.randomUUID();
  const token='a'.repeat(64),other='b'.repeat(64);
  await api.insert(owner,'event-001',{ciphertext:'synthetic-cipher-1'},[token]);
  await api.insert(owner,'event-002',{ciphertext:'synthetic-cipher-2'},[token,other]);
  let collisionRejected=false;
  try{await api.insert(owner,'event-001',{ciphertext:'should-not-appear'},[other]);}
  catch(_){collisionRejected=true;}
  const first=await api.page(owner,token,{limit:1});
  const second=await api.page(owner,token,{after:first.next,limit:1});
  const all=await api.page(owner,token,{limit:10});
  const secondary=await api.page(owner,other,{limit:10});
  const foreign=await api.page(owner+'-other',token,{limit:10});
  return {collisionRejected,first:first.rows.map(x=>x.id),second:second.rows.map(x=>x.id),
   all:all.rows.map(x=>x.id),secondary:secondary.rows.map(x=>x.id),
   foreign:foreign.rows.length,original:all.rows[0].envelope.ciphertext};
 });
 expect(result).toEqual({collisionRejected:true,first:['event-001'],second:['event-002'],
  all:['event-001','event-002'],secondary:['event-002'],foreign:0,original:'synthetic-cipher-1'});
});
