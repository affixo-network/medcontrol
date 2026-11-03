'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 private equality tokens are stable, scoped and lockable',async({page})=>{
 await page.goto('http://127.0.0.1:8765/auth-login.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-private-index.js')});
 const result=await page.evaluate(async()=>{
  const api=MedControlModular3PrivateIndex;
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const password='synthetic-private-index-password';
  const a=await api.open(password,salt,'synthetic-owner-a');
  const b=await api.open(password,salt,'synthetic-owner-b');
  const same=await api.open(password,salt,'synthetic-owner-a');
  const first=await a.token('status','taken');
  const repeated=await same.token('status','taken');
  const foreign=await b.token('status','taken');
  const different=await a.token('status','missed');
  const field=await a.token('course','taken');
  a.lock();
  let locked=false;
  try{await a.token('status','taken');}catch(_){locked=true;}
  return {stable:first===repeated,isolated:first!==foreign,distinct:first!==different,
   fieldSeparated:first!==field,locked,length:first.length,
   noPlaintext:!first.includes('taken')};
 });
 expect(result).toEqual({stable:true,isolated:true,distinct:true,fieldSeparated:true,
  locked:true,length:64,noPlaintext:true});
});
