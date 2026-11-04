/* T-046 isolated authenticated commitment experiment.
 * The caller supplies a non-extractable HMAC CryptoKey from an independent
 * trusted key-management flow. This module never creates or persists keys.
 * Not integrated with any medical vault.
 */
(function(root){
'use strict';
const encoder=new TextEncoder();
function assertKey(key){
 if(!key||key.type!=='secret'||key.algorithm?.name!=='HMAC'||!key.usages.includes('sign')||!key.usages.includes('verify'))throw Error('HMAC key required');
}
function message(vaultId,kind,commitment){
 if(typeof vaultId!=='string'||!/^vault_[A-Za-z0-9_-]{8,128}$/.test(vaultId))throw Error('Invalid vault');
 if(kind!=='segment'&&kind!=='manifest')throw Error('Invalid kind');
 if(typeof commitment!=='string'||! /^[a-f0-9]{64}$/.test(commitment))throw Error('Invalid commitment');
 return encoder.encode('medcontrol:t046:auth:v1\n'+vaultId+'\n'+kind+'\n'+commitment);
}
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function bytes(hexValue){return Uint8Array.from(hexValue.match(/../g),x=>parseInt(x,16));}
async function sign(key,vaultId,kind,commitment){
 assertKey(key);
 return hex(new Uint8Array(await root.crypto.subtle.sign('HMAC',key,message(vaultId,kind,commitment))));
}
async function verify(key,vaultId,kind,commitment,tag){
 assertKey(key);
 if(typeof tag!=='string'||! /^[a-f0-9]{64}$/.test(tag))return false;
 try{return await root.crypto.subtle.verify('HMAC',key,bytes(tag),message(vaultId,kind,commitment));}catch{return false;}
}
root.MedControlT046AuthenticatedCommitment=Object.freeze({sign,verify});
})(typeof window!=='undefined'?window:globalThis);
