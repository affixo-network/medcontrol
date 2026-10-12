/* Experimental encrypted offline vault. Isolated from production storage and auth. */
(function(root){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const to64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
 const from64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
 async function keyFromPassword(password,salt){
  if(typeof password!=='string'||password.length<12)throw Error('Passphrase must contain at least 12 characters');
  const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function seal(data,password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFromPassword(password,salt);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(data)));
  return Object.freeze({version:1,kdf:'PBKDF2-SHA256',iterations:310000,cipher:'AES-256-GCM',salt:to64(salt),iv:to64(iv),ciphertext:to64(ciphertext)});
 }
 async function open(record,password){
  if(!record||record.version!==1||record.cipher!=='AES-256-GCM'||record.kdf!=='PBKDF2-SHA256'||record.iterations!==310000)throw Error('Unsupported vault format');
  const key=await keyFromPassword(password,from64(record.salt));
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(record.iv)},key,from64(record.ciphertext));
  return JSON.parse(decoder.decode(plain));
 }
 root.MedControlOfflineVault=Object.freeze({seal,open});
})(typeof window!=='undefined'?window:globalThis);
