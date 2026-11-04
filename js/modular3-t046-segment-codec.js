/* T-046 isolated segment/manifest codec; no I/O, no legacy vault access.
 * Ciphertext frames only. No event plaintext, keys or medical facts accepted.
 * Design prototype: not a durable storage engine or certified crypto protocol.
 */
(function(root){
'use strict';
const enc=new TextEncoder();
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const canonical=x=>{
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 throw Error('Noncanonical data');
};
async function hash(v){
 const bytes=enc.encode(canonical(v));
 return hex(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)));
}
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const opaque=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{16,128}$/.test(s);
function frameCheck(f){
 if(!f||!safe(f.sequence)||f.sequence<1||!opaque(f.eventId)||typeof f.envelope!=='object'||!f.envelope||Array.isArray(f.envelope))throw Error('Invalid encrypted frame');
 if(f.envelope.v!==1||f.envelope.alg!=='AES-GCM'||typeof f.envelope.iv!=='string'||typeof f.envelope.ciphertext!=='string')throw Error('Invalid AEAD envelope');
 if(f.envelope.iv.length!==16||f.envelope.ciphertext.length>1024*1024*4)throw Error('Invalid frame size');
}
async function buildSegment({vaultId,frames}){
 if(!opaque(vaultId)||!Array.isArray(frames)||frames.length<1||frames.length>1024)throw Error('Invalid segment');
 let prev=0;
 const seen=new Set();
 for(const f of frames){
  frameCheck(f);
  if(prev&&f.sequence!==prev+1)throw Error('Noncontiguous sequence');
  if(seen.has(f.eventId))throw Error('Duplicate event');
  prev=f.sequence;seen.add(f.eventId);
 }
 const core={format:'mc.segment',version:1,vaultId,firstSequence:frames[0].sequence,lastSequence:prev,eventCount:frames.length,frames:structuredClone(frames)};
 return Object.freeze({...core,commitment:await hash(core)});
}
async function verifySegment(s){
 if(!s||s.format!=='mc.segment'||s.version!==1||!opaque(s.vaultId)||!Array.isArray(s.frames)||s.eventCount!==s.frames.length)return false;
 try{
  if(s.frames.length<1||s.frames.length>1024)return false;
  let prev=0;const seen=new Set();
  for(const f of s.frames){frameCheck(f);if(prev&&f.sequence!==prev+1||seen.has(f.eventId))return false;prev=f.sequence;seen.add(f.eventId);}
  if(s.firstSequence!==s.frames[0].sequence||s.lastSequence!==prev||!digest(s.commitment))return false;
  const {commitment,...core}=s;
  return await hash(core)===commitment;
 }catch{return false;}
}
async function buildManifest({vaultId,generation,previousCommitment=null,segments}){
 if(!opaque(vaultId)||!safe(generation)||generation<1||!Array.isArray(segments)||segments.length<1||segments.length>1024)throw Error('Invalid manifest');
 if(generation===1&&previousCommitment!==null||generation>1&&!digest(previousCommitment))throw Error('Invalid predecessor');
 let last=0;let total=0;
 for(const s of segments){
  if(!s||!digest(s.commitment)||s.vaultId!==vaultId||!safe(s.firstSequence)||s.firstSequence<1||!safe(s.lastSequence)||s.lastSequence<s.firstSequence||s.eventCount!==s.lastSequence-s.firstSequence+1)throw Error('Invalid segment descriptor');
  if(last&&s.firstSequence!==last+1)throw Error('Manifest sequence gap');
  last=s.lastSequence;total+=s.eventCount;
 }
 const core={format:'mc.manifest',version:1,vaultId,generation,previousCommitment,segments:segments.map(s=>({commitment:s.commitment,vaultId:s.vaultId,firstSequence:s.firstSequence,lastSequence:s.lastSequence,eventCount:s.eventCount})),committedThrough:last,eventCount:total};
 return Object.freeze({...core,commitment:await hash(core)});
}
async function verifyManifest(m,previous=null){
 try{
  if(!m||m.format!=='mc.manifest'||m.version!==1||!digest(m.commitment))return false;
  if(previous&&(m.previousCommitment!==previous.commitment||m.generation!==previous.generation+1||m.vaultId!==previous.vaultId))return false;
  const regenerated=await buildManifest(m);
  return regenerated.commitment===m.commitment;
 }catch{return false;}
}
root.MedControlT046SegmentCodec=Object.freeze({buildSegment,verifySegment,buildManifest,verifyManifest});
})(typeof window!=='undefined'?window:globalThis);
