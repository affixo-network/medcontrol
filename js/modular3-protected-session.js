/* Modular-3 opt-in protected session. Never reads or alters legacy plaintext state.
 * A local password unlocks encrypted medical data only; it never authenticates to Supabase.
 */
(function(root){
 'use strict';
 const CREDENTIAL=root.MedControlModular3OfflineCredential;
 const VAULT=root.MedControlModular3EncryptedVault;
 if(!CREDENTIAL||!VAULT)throw Error('Modular-3 protected dependencies unavailable');
 const DATA_KEY='medcontrol_modular3_protected_state_v1';
 let secret=null,state=null,chain=Promise.resolve();
 const clone=x=>structuredClone(x);
 function requireOpen(){if(!secret||!state||!CREDENTIAL.isUnlocked())throw Error('Protected session locked');}
 const api={
  async initialize(initial,password){
   if(localStorage.getItem(DATA_KEY)||CREDENTIAL.isEnrolled())throw Error('Protected session already exists');
   if(localStorage.getItem('affixo_medcontrol_standard_v3')!==null)throw Error('Legacy data present: migration approval required');
   const sealed=await VAULT.seal(initial,password);
   localStorage.setItem(DATA_KEY,JSON.stringify(sealed));
   try{await CREDENTIAL.enroll(password);}catch(error){localStorage.removeItem(DATA_KEY);throw error;}
   secret=password;state=clone(initial);
   return true;
  },
  async unlock(password){
   secret=null;state=null;
   if(!await CREDENTIAL.unlock(password))return false;
   try{
    const raw=localStorage.getItem(DATA_KEY);
    if(!raw)throw Error('Encrypted data missing');
    const opened=await VAULT.open(JSON.parse(raw),password);
    secret=password;state=opened;return true;
   }catch(error){CREDENTIAL.lock();throw error;}
  },
  read(){requireOpen();return clone(state);},
  transact(mutator){
   if(typeof mutator!=='function')return Promise.reject(Error('Mutation callback required'));
   const task=chain.then(async()=>{
    requireOpen();
    const next=clone(state);
    await mutator(next);
    requireOpen();
    const sealed=await VAULT.seal(next,secret);
    localStorage.setItem(DATA_KEY,JSON.stringify(sealed));
    state=next;
    return clone(state);
   });
   chain=task.catch(()=>{});
   return task;
  },
  async lock(){await chain;secret=null;state=null;CREDENTIAL.lock();},
  isUnlocked(){return Boolean(secret&&state&&CREDENTIAL.isUnlocked());},
  storageKey:DATA_KEY
 };
 root.MedControlModular3ProtectedSession=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
