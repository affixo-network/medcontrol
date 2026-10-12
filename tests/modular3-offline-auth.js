/* Isolated offline prototype authentication. NOT production auth. */
'use strict';
(function(root){
 const KEY='medcontrol_offline_proof_credential_v1';
 const enc=new TextEncoder();
 const hex=bytes=>Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 async function derive(secret,salt){
  const base=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:210000},base,256));
 }
 let unlocked=false;
 root.medcontrolOfflineProofAuth={
  async enroll(secret){
   if(typeof secret!=='string'||secret.length<12)throw Error('Minimum 12 characters');
   if(localStorage.getItem(KEY))throw Error('Already enrolled');
   const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
   localStorage.setItem(KEY,JSON.stringify({salt,verifier:await derive(secret,salt)}));
   unlocked=true;return true;
  },
  async unlock(secret){
   const record=JSON.parse(localStorage.getItem(KEY)||'null');
   if(!record)throw Error('No offline credential');
   unlocked=(await derive(secret,record.salt))===record.verifier;
   return unlocked;
  },
  lock(){unlocked=false;},
  isUnlocked(){return unlocked;}
 };
})(window);
