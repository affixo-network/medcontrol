/* Modular-3 encrypted vault core. Explicit opt-in; no legacy storage migration. */
(function(root){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const b64=b=>{
  const bytes=new Uint8Array(b),parts=[];
  for(let offset=0;offset<bytes.length;offset+=0x8000)
   parts.push(String.fromCharCode(...bytes.subarray(offset,offset+0x8000)));
  return btoa(parts.join(''));
 };
 const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const ITERATIONS=310000;
 async function derive(secret,salt){
  if(typeof secret!=='string'||secret.length<12)throw Error('Passphrase too short');
  const material=await crypto.subtle.importKey('raw',encoder.encode(secret),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function seal(state,secret){
  if(!state||!Array.isArray(state.medications)||!Array.isArray(state.intakeLogs))throw Error('Invalid state');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(secret,salt);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(state)));
  return {version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};
 }
 async function open(record,secret){
  if(!record||record.version!==1||record.kdf!=='PBKDF2-SHA256'||record.iterations!==ITERATIONS||record.cipher!=='AES-256-GCM')throw Error('Unsupported vault format');
  const key=await derive(secret,un64(record.salt));
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(record.iv)},key,un64(record.ciphertext));
  const state=JSON.parse(decoder.decode(plaintext));
  if(!state||!Array.isArray(state.medications)||!Array.isArray(state.intakeLogs))throw Error('Invalid decrypted state');
  return state;
 }
 root.MedControlModular3EncryptedVault=Object.freeze({seal,open});
})(typeof window!=='undefined'?window:globalThis);
