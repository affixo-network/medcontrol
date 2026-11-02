/* T-046: opt-in per-record encryption for sharded storage.
 * No implicit migration, no plaintext persistence, and no use by legacy sessions.
 */
(function(root){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const b64=bytes=>{let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);};
 const un64=value=>Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
 const ITERATIONS=310000;
 async function deriveKey(password,salt){
   if(typeof password!=='string'||password.length<12)throw Error('Passphrase too short');
   if(!(salt instanceof Uint8Array)||salt.length!==16)throw Error('Invalid vault salt');
   const material=await root.crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
   return root.crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 function newSalt(){return root.crypto.getRandomValues(new Uint8Array(16));}
 function associatedData(owner,id){
   if(typeof owner!=='string'||!owner||typeof id!=='string'||!id)throw Error('Record identity required');
   return encoder.encode(JSON.stringify(['medcontrol-shard-v1',owner,id]));
 }
 function session(key){
   if(!key||key.type!=='secret'||key.algorithm?.name!=='AES-GCM')throw Error('AES-GCM key required');
   return Object.freeze({
     async encrypt(owner,id,record){
       if(record===undefined)throw Error('Record required');
       const aad=associatedData(owner,id);
       const iv=root.crypto.getRandomValues(new Uint8Array(12));
       const encrypted=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(record)));
       return {version:1,cipher:'AES-256-GCM',iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
     },
     async decrypt(owner,id,envelope){
       const aad=associatedData(owner,id);
       if(!envelope||envelope.version!==1||envelope.cipher!=='AES-256-GCM'||typeof envelope.iv!=='string'||typeof envelope.ciphertext!=='string')throw Error('Unsupported encrypted record');
       const iv=un64(envelope.iv);
       if(iv.length!==12)throw Error('Invalid record nonce');
       const bytes=await root.crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,un64(envelope.ciphertext));
       return JSON.parse(decoder.decode(bytes));
     }
   });
 }
 root.MedControlModular3ShardCrypto=Object.freeze({newSalt,deriveKey,session,iterations:ITERATIONS});
})(typeof window!=='undefined'?window:globalThis);
