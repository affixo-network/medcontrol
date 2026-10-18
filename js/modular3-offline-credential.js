/* Modular-3 offline credential. Never grants Supabase/cloud access. Opt-in only. */
(function(root){
 'use strict';
 const KEY='medcontrol_modular3_local_credential_v1',enc=new TextEncoder();
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 let unlocked=false;
 async function derive(secret,salt){
  if(typeof secret!=='string'||secret.length<12)throw Error('Passphrase too short');
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:310000},key,256));
 }
 const api={
  async enroll(secret){
   // All enrollment paths must prove that this password opens the existing vault.
   // Serialize credential creation across tabs, including direct API callers.
   if(!navigator.locks?.request)throw Error('Cross-tab credential locking unavailable');
   return navigator.locks.request('medcontrol-modular3-credential-enroll',{mode:'exclusive'},async()=>{
    if(localStorage.getItem(KEY)!==null)throw Error('Credential already enrolled');
    const dataKey='medcontrol_modular3_protected_state_v1';
    const vault=root.MedControlModular3EncryptedVault;
    const snapshot=localStorage.getItem(dataKey);
    if(!snapshot||!vault)throw Error('Encrypted checkpoint missing');
    await vault.open(JSON.parse(snapshot),secret);
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    const verifier=await derive(secret,salt);
    if(localStorage.getItem(KEY)!==null||localStorage.getItem(dataKey)!==snapshot)throw Error('Enrollment state changed');
    const serialized=JSON.stringify({version:1,salt,verifier});
    localStorage.setItem(KEY,serialized);
    if(localStorage.getItem(KEY)!==serialized||localStorage.getItem(dataKey)!==snapshot)
     throw Error('Enrollment verification failed');
    unlocked=true;return true;
   });
  },
  async unlock(secret){
   unlocked=false;
   const raw=localStorage.getItem(KEY);
   if(!raw)return false;
   const record=JSON.parse(raw);
   if(record.version!==1||typeof record.salt!=='string'||typeof record.verifier!=='string')throw Error('Invalid credential');
   const candidate=await derive(secret,record.salt);
   unlocked=candidate===record.verifier;
   return unlocked;
  },
  lock(){unlocked=false;},
  isUnlocked(){return unlocked;},
  isEnrolled(){return localStorage.getItem(KEY)!==null;}
 };
 root.MedControlModular3OfflineCredential=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
