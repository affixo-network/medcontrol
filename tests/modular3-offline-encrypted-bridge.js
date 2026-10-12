/* Test-only synchronous state bridge: memory plaintext, encrypted durable vault.
 * Explicit asynchronous checkpoint is required after every mutation.
 * Never enabled on production pages.
 */
(function(root){
 'use strict';
 const KEY='affixo_medcontrol_standard_v3';
 const adapter=root.MedControlOfflineStorageAdapter;
 if(!adapter)throw Error('Encrypted adapter required');
 let state=null,secret=null,dirty=false;
 function assertOpen(){if(!state||!secret)throw Error('Offline vault locked');}
 const bridge={
  async unlock(passphrase){
   if(state)throw Error('Already unlocked');
   secret=passphrase;
   try{state=await adapter.load(passphrase);}
   catch(e){secret=null;throw e;}
   dirty=false;return true;
  },
  async initialize(initial,passphrase){
   if(state)throw Error('Already unlocked');
   if(localStorage.getItem('medcontrol_modular3_test_encrypted_state_v1'))throw Error('Encrypted state already exists');
   await adapter.save(initial,passphrase);
   secret=passphrase;state=structuredClone(initial);dirty=false;return true;
  },
  read(){assertOpen();return structuredClone(state);},
  write(next){assertOpen();if(!next||!Array.isArray(next.medications)||!Array.isArray(next.intakeLogs))throw Error('Invalid state');state=structuredClone(next);dirty=true;},
  async checkpoint(){assertOpen();if(dirty){await adapter.save(state,secret);dirty=false;}return true;},
  lock(){if(dirty)throw Error('Unsaved offline changes: checkpoint required');state=null;secret=null;},
  isDirty(){return dirty;},
  // The production storage key is deliberately not written by this test-only bridge.
  storageKey:KEY
 };
 root.MedControlOfflineEncryptedBridge=Object.freeze(bridge);
})(window);
