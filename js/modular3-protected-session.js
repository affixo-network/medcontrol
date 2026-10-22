/* Modular-3 opt-in protected session. Never reads or alters legacy plaintext state.
 * A local password unlocks encrypted medical data only; it never authenticates to Supabase.
 */
(function(root){
 'use strict';
 const CREDENTIAL=root.MedControlModular3OfflineCredential;
 const VAULT=root.MedControlModular3EncryptedVault;
 if(!CREDENTIAL||!VAULT)throw Error('Modular-3 protected dependencies unavailable');
 const DATA_KEY='medcontrol_modular3_protected_state_v1';
 let secret=null,state=null,checkpoint=null,chain=Promise.resolve();
 const clone=x=>structuredClone(x);
 function requireOpen(){if(!secret||!state||!CREDENTIAL.isUnlocked())throw Error('Protected session locked');}
 const api={
  async initialize(initial,password){
   // Lock the entire create/verify sequence, not just credential enrollment.
   if(!navigator.locks?.request)throw Error('Cross-tab storage locking unavailable');
   return navigator.locks.request('medcontrol-modular3-initialize',{mode:'exclusive'},async()=>{
    if(localStorage.getItem(DATA_KEY)!==null||CREDENTIAL.isEnrolled())throw Error('Protected session already exists');
    if(localStorage.getItem('affixo_medcontrol_standard_v3')!==null)throw Error('Legacy data present: migration approval required');
    const sealed=await VAULT.seal(initial,password);
    if(localStorage.getItem(DATA_KEY)!==null||CREDENTIAL.isEnrolled())throw Error('Protected session already exists');
    const encoded=JSON.stringify(sealed);
    localStorage.setItem(DATA_KEY,encoded);
    try{
     if(localStorage.getItem(DATA_KEY)!==encoded||CREDENTIAL.isEnrolled())throw Error('Initialization state changed');
     await CREDENTIAL.enroll(password);
     const saved=localStorage.getItem(DATA_KEY);
     if(saved!==encoded)throw Error('Initial encrypted checkpoint changed');
     if(!await CREDENTIAL.unlock(password))throw Error('Initial credential verification failed');
     const restored=await VAULT.open(JSON.parse(saved),password);
     if(JSON.stringify(restored)!==JSON.stringify(initial))throw Error('Initial encrypted checkpoint mismatch');
     secret=password;state=restored;checkpoint=saved;
     return true;
    }catch(error){
     // Never delete a vault when a credential exists: the pair can be usable,
     // including if Storage throws *after* persisting a credential.
     if(localStorage.getItem(DATA_KEY)===encoded&&!CREDENTIAL.isEnrolled())
      localStorage.removeItem(DATA_KEY);
     throw error;
    }
   });
  },
  async unlock(password){
   secret=null;state=null;checkpoint=null;
   if(!await CREDENTIAL.unlock(password))return false;
   try{
    const raw=localStorage.getItem(DATA_KEY);
    if(!raw)throw Error('Encrypted data missing');
    const opened=await VAULT.open(JSON.parse(raw),password);
    secret=password;state=opened;checkpoint=raw;return true;
   }catch(error){CREDENTIAL.lock();throw error;}
  },
  read(){requireOpen();return clone(state);},
  transact(mutator,options={}){
   if(typeof mutator!=='function')return Promise.reject(Error('Mutation callback required'));
   const task=chain.then(async()=>{
    requireOpen();
    if(localStorage.getItem(DATA_KEY)!==checkpoint){secret=null;state=null;checkpoint=null;CREDENTIAL.lock();throw Error('Encrypted data changed in another tab; unlock again');}
    const next=clone(state);
    await mutator(next);
    requireOpen();
    if(localStorage.getItem(DATA_KEY)!==checkpoint){secret=null;state=null;checkpoint=null;CREDENTIAL.lock();throw Error('Encrypted data changed during edit; unlock again');}
    if(options.skipUnchanged===true&&JSON.stringify(next)===JSON.stringify(state))return clone(state);
    const sealed=await VAULT.seal(next,secret);
    const encoded=JSON.stringify(sealed);
    const previous=localStorage.getItem(DATA_KEY);
    if(!previous||previous!==checkpoint)throw Error('Encrypted checkpoint changed before write');
    try{
     localStorage.setItem(DATA_KEY,encoded);
     // Do not acknowledge a write until the stored ciphertext is decrypted and compared.
     const stored=localStorage.getItem(DATA_KEY);
     if(stored!==encoded)throw Error('Encrypted checkpoint verification failed');
     const verified=await VAULT.open(JSON.parse(stored),secret);
     if(JSON.stringify(verified)!==JSON.stringify(next))throw Error('Encrypted checkpoint content mismatch');
     state=verified;checkpoint=encoded;
     return clone(state);
    }catch(error){
     // Preserve the last verified encrypted snapshot when a new write fails.
     const current=localStorage.getItem(DATA_KEY);
     // Never overwrite a checkpoint written by another tab while rolling back.
     if(current===encoded){
      try{localStorage.setItem(DATA_KEY,previous);}catch(rollbackError){
       secret=null;state=null;checkpoint=null;CREDENTIAL.lock();
       throw Error('Encrypted write and rollback failed; session locked: '+rollbackError.message);
      }
     }else if(current!==previous){
      secret=null;state=null;checkpoint=null;CREDENTIAL.lock();
      throw Error('Encrypted checkpoint changed concurrently; session locked');
     }
     throw error;
    }
   });
   chain=task.catch(()=>{});
   return task;
  },
  async lock(){await chain;secret=null;state=null;checkpoint=null;CREDENTIAL.lock();},
  isUnlocked(){return Boolean(secret&&state&&CREDENTIAL.isUnlocked());},
  storageKey:DATA_KEY
 };
 root.MedControlModular3ProtectedSession=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
