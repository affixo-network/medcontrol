'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 isolated journal: encrypted append, immutable correction, indexed read, duplicate rejection',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-journal.js')});
 const result=await page.evaluate(async()=>{
  const j=window.MedControlT046Journal,owner='t046-journal-'+crypto.randomUUID();
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const indexKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
  const token=await j.tokenFor(indexKey,owner,'course-1');
  await j.append({owner,id:'0001',kind:'intake',body:{medicine:'test',status:'accepted'},key,tokens:[token]});
  await j.append({owner,id:'0002',kind:'correction',body:{corrects:'0001',reason:'mistake'},key,tokens:[token]});
  let duplicateRejected=false;
  try{await j.append({owner,id:'0001',kind:'intake',body:{status:'overwritten'},key,tokens:[token]});}catch(e){duplicateRejected=true;}
  const first=await j.get({owner,id:'0001',key});
  const second=await j.get({owner,id:'0002',key});
  const listing=await j.page({owner,token,key});
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medcontrol_t046_journal_v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const stored=await new Promise((resolve,reject)=>{const tx=db.transaction('events');const r=tx.objectStore('events').get([owner,'0001']);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  db.close();
  return {duplicateRejected,first,second,count:listing.rows.length,ids:listing.rows.map(r=>r.id),encrypted:!JSON.stringify(stored).includes('medicine')&&!JSON.stringify(stored).includes('accepted')};
 });
 expect(result).toMatchObject({duplicateRejected:true,first:{body:{medicine:'test',status:'accepted'}},second:{body:{corrects:'0001',reason:'mistake'}},count:2,ids:['0001','0002'],encrypted:true});
});
