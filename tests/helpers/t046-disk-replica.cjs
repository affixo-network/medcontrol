/* T-046 isolated disk-backed replica store for process-restart testing.
 * Single server process only. Not a cross-host CAS, independent backup or production store.
 */
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const digest=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
function createDiskReplica(directory){
 if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('Absolute storage directory required');
 let serial=Promise.resolve();
 const lock=fn=>{const result=serial.then(fn);serial=result.catch(()=>{});return result;};
 const file=(kind,id)=>path.join(directory,kind,id+'.json');
 async function atomicWrite(filename,value){
  await fs.mkdir(path.dirname(filename),{recursive:true});
  const temp=filename+'.'+crypto.randomUUID()+'.tmp';
  try{
   const handle=await fs.open(temp,'wx',0o600);
   try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}
   await fs.rename(temp,filename);
   const dir=await fs.open(path.dirname(filename),'r');
   try{await dir.sync();}finally{await dir.close();}
  }finally{await fs.rm(temp,{force:true});}
 }
 async function read(filename){
  try{return JSON.parse(await fs.readFile(filename,'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 async function immutable(kind,id,value){
  if(!digest(id)||!value||value[kind==='segments'?'segment':'manifest']?.commitment!==id)throw Error('Invalid immutable object');
  return lock(async()=>{
   const target=file(kind,id),existing=await read(target);
   if(existing!==null){if(JSON.stringify(existing)!==JSON.stringify(value))throw Error('Immutable conflict');return false;}
   await atomicWrite(target,value);return true;
  });
 }
 return Object.freeze({
  putSegment:(id,value)=>immutable('segments',id,value),
  getSegment:id=>{if(!digest(id))throw Error('Invalid commitment');return read(file('segments',id));},
  putManifest:(id,value)=>immutable('manifests',id,value),
  getManifest:id=>{if(!digest(id))throw Error('Invalid commitment');return read(file('manifests',id));},
  getHead:()=>read(path.join(directory,'head.json')),
  compareAndSwapHead:(expected,previous,next)=>lock(async()=>{
   if(!Number.isSafeInteger(expected)||expected<0||!next||!digest(next.commitment)||next.generation!==expected+1)return false;
   const current=await read(path.join(directory,'head.json'));
   if((current?.generation||0)!==expected||(current?.commitment||null)!==previous||
      current&&current.vaultId!==next.vaultId)return false;
   const manifest=await read(file('manifests',next.commitment));
   if(!manifest||manifest.manifest?.generation!==next.generation||manifest.manifest?.vaultId!==next.vaultId)return false;
   await atomicWrite(path.join(directory,'head.json'),next);return true;
  })
 });
}
module.exports={createDiskReplica};
