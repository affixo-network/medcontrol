/* T-046 opt-in sharded vault facade. Does not migrate or modify the legacy vault.
 * All records are encrypted individually; the salt is public, never a password.
 * No production switch until crash recovery, export and UI paging are verified.
 */
(function(root){
 'use strict';
 const STORE=root.MedControlModular3ShardStore;
 const CRYPTO=root.MedControlModular3ShardCrypto;
 if(!STORE||!CRYPTO)throw Error('Shard storage dependencies unavailable');
 const META='!vault';
 const toB64=bytes=>btoa(String.fromCharCode(...bytes));
 const fromB64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 function validateOwner(owner){
   if(typeof owner!=='string'||!owner||owner.length>256)throw Error('Invalid vault owner');
 }
 function validateId(id){
   if(typeof id!=='string'||!id||id===META||id==='\uffff')throw Error('Reserved or invalid record ID');
 }
 async function create(owner,password){
   validateOwner(owner);
   if(await STORE.getEncrypted(owner,META)!==null)throw Error('Sharded vault already exists');
   const salt=CRYPTO.newSalt();
   const key=await CRYPTO.deriveKey(password,salt);
   const cipher=CRYPTO.session(key);
   const proof=await cipher.encrypt(owner,META,{type:'medcontrol-shard-vault',version:1});
   await STORE.createEncrypted(owner,META,{version:1,salt:toB64(salt),proof});
   return open(owner,password);
 }
 async function open(owner,password){
   validateOwner(owner);
   const meta=await STORE.getEncrypted(owner,META);
   if(!meta||meta.version!==1||typeof meta.salt!=='string'||!meta.proof)
     throw Error('Sharded vault metadata missing or invalid');
   const salt=fromB64(meta.salt);
   const key=await CRYPTO.deriveKey(password,salt);
   const cipher=CRYPTO.session(key);
   const proof=await cipher.decrypt(owner,META,meta.proof);
   if(proof?.type!=='medcontrol-shard-vault'||proof.version!==1)
     throw Error('Sharded vault verification failed');
   let active=true;
   const requireOpen=()=>{if(!active)throw Error('Sharded vault locked');};
   return Object.freeze({
     async createRecord(id,record){
       requireOpen();validateId(id);
       const encrypted=await cipher.encrypt(owner,id,record);
       await STORE.createEncrypted(owner,id,encrypted);
       const verified=await STORE.getEncrypted(owner,id);
       const decoded=await cipher.decrypt(owner,id,verified);
       if(JSON.stringify(decoded)!==JSON.stringify(record))
         throw Error('Encrypted record verification failed');
       return structuredClone(decoded);
     },
     // Bounded batch writer for synthetic fixtures and future bulk import.
     // Encryption happens outside IndexedDB transactions; commit is atomic.
     async createRecordsBatch(records){
       requireOpen();
       if(!Array.isArray(records)||records.length<1||records.length>100)
         throw Error('Batch size must be 1..100');
       const seen=new Set();
       const rows=[];
       for(const item of records){
         validateId(item?.id);
         if(seen.has(item.id))throw Error('Duplicate batch record ID');
         seen.add(item.id);
         rows.push({id:item.id,ciphertext:await cipher.encrypt(owner,item.id,item.record)});
       }
       rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
       await STORE.importEncryptedPageNewOwner(owner,rows);
       return rows.length;
     },
     async getRecord(id){
       requireOpen();validateId(id);
       const encrypted=await STORE.getEncrypted(owner,id);
       return encrypted===null?null:cipher.decrypt(owner,id,encrypted);
     },
     async replaceRecord(id,expectedRecord,nextRecord){
       requireOpen();validateId(id);
       const current=await STORE.getEncrypted(owner,id);
       if(current===null)throw Error('Record missing');
       const decoded=await cipher.decrypt(owner,id,current);
       if(JSON.stringify(decoded)!==JSON.stringify(expectedRecord))
         throw Error('Record changed since last read');
       const encrypted=await cipher.encrypt(owner,id,nextRecord);
       await STORE.replaceEncryptedIfMatch(owner,id,current,encrypted);
       const persisted=await STORE.getEncrypted(owner,id);
       const verified=await cipher.decrypt(owner,id,persisted);
       if(JSON.stringify(verified)!==JSON.stringify(nextRecord))
         throw Error('Encrypted replacement verification failed');
       return structuredClone(verified);
     },
     async page({after='',limit=100}={}){
       requireOpen();
       if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Page limit must be 1..500');
       if(typeof after!=='string'||after==='\uffff')throw Error('Invalid page cursor');
       // Metadata must not consume a medical-record page slot.
       // Iterate only as needed, preserving cursor order across all record IDs.
       let cursor=after;
       const entries=[];
       let next=null;
       while(entries.length<limit){
         const result=await STORE.pageEncrypted(owner,{after:cursor,limit:limit-entries.length});
         entries.push(...result.rows.filter(row=>row.id!==META));
         next=result.next;
         if(next===null)break;
         cursor=next;
       }
       const rows=await Promise.all(entries.map(async row=>({
         id:row.id,record:await cipher.decrypt(owner,row.id,row.ciphertext)
       })));
       return {rows,next};
     },
     // Read-only encrypted backup stream. Caller must persist each page safely.
     // No plaintext leaves this method; the vault metadata carries the KDF salt.
     async exportEncryptedPage({after='',limit=100}={}){
       requireOpen();
       if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Page limit must be 1..500');
       if(typeof after!=='string'||after==='\uffff')throw Error('Invalid page cursor');
       const page=await STORE.pageEncrypted(owner,{after,limit});
       return {format:'medcontrol-shard-backup-v1',owner,
         rows:structuredClone(page.rows),next:page.next};
     },
     // Verify a streamed encrypted backup page before any future restore.
     // No writes: a damaged, foreign or plaintext record must be rejected.
     async verifyEncryptedBackupPage(page,{after=''}={}){
       requireOpen();
       if(!page||page.format!=='medcontrol-shard-backup-v1'||page.owner!==owner||
          !Array.isArray(page.rows)||page.rows.length>500||
          (page.next!==null&&typeof page.next!=='string'))
         throw Error('Invalid encrypted backup page');
       if(typeof after!=='string'||after==='\uffff')throw Error('Invalid expected backup cursor');
       if(page.rows.length===0&&page.next!==null)throw Error('Empty backup page cannot continue');
       let previous=after;
       for(const row of page.rows){
         if(!row||typeof row.id!=='string'||!row.id||row.id==='\uffff'||
            row.id<=previous||!row.ciphertext||typeof row.ciphertext!=='object')
           throw Error('Invalid or unordered backup record');
         previous=row.id;
         if(row.id===META){
           const meta=row.ciphertext;
           if(meta.version!==1||typeof meta.salt!=='string'||!meta.proof)
             throw Error('Invalid backup vault metadata');
           const stored=await STORE.getEncrypted(owner,META);
           if(!stored||stored.salt!==meta.salt)
             throw Error('Backup vault identity mismatch');
           const proof=await cipher.decrypt(owner,META,meta.proof);
           if(proof?.type!=='medcontrol-shard-vault'||proof.version!==1)
             throw Error('Invalid backup vault proof');
         }else{
           await cipher.decrypt(owner,row.id,row.ciphertext);
         }
       }
       if(page.next!==null&&page.next!==previous)
         throw Error('Backup cursor does not match final record');
       return {verified:page.rows.length,next:page.next};
     },
     lock(){active=false;}
   });
 }
 root.MedControlModular3ShardVault=Object.freeze({create,open});
})(typeof window!=='undefined'?window:globalThis);
