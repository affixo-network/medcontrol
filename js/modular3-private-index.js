/* T-046 opt-in private equality tokens; no persistent indexes or legacy data changes. */
(function(root){
 'use strict';
 const enc=new TextEncoder();
 const DOMAIN='medcontrol-t046-query-token-v1';
 function validate(value,label){
  if(typeof value!=='string'||!value||value.length>512)throw Error('Invalid '+label);
 }
 async function open(password,salt,owner){
  if(typeof password!=='string'||password.length<12)throw Error('Passphrase too short');
  if(!(salt instanceof Uint8Array)||salt.length!==16)throw Error('Invalid salt');
  validate(owner,'owner');
  const material=await root.crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const domain=enc.encode(DOMAIN);
  const separatedSalt=new Uint8Array(salt.length+domain.length);
  separatedSalt.set(salt);separatedSalt.set(domain,salt.length);
  const bits=await root.crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:separatedSalt,iterations:310000},material,256);
  const key=await root.crypto.subtle.importKey('raw',bits,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  let active=true;
  return Object.freeze({
   async token(field,value){
    if(!active)throw Error('Query token session locked');
    validate(field,'field');validate(value,'value');
    const bytes=enc.encode(JSON.stringify([DOMAIN,owner,field,value]));
    const mac=new Uint8Array(await root.crypto.subtle.sign('HMAC',key,bytes));
    return Array.from(mac,b=>b.toString(16).padStart(2,'0')).join('');
   },
   lock(){active=false;}
  });
 }
 root.MedControlModular3PrivateIndex=Object.freeze({open});
})(typeof window!=='undefined'?window:globalThis);
