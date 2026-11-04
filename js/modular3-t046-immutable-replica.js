/* T-046 isolated IndexedDB immutable-object adapter.
 * Local test double only; NOT an independent remote failure domain.
 * A single readwrite transaction provides atomic compare-and-insert.
 */
(function(root){
'use strict';
function open(name='t046-immutable-replica-v1'){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>{
   for(const store of ['segments','manifests','head'])
    if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store);
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
function transaction(db,store,mode,operation){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode),objectStore=tx.objectStore(store);
  let result;
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(tx.error||Error('Transaction aborted'));
  tx.onerror=()=>{};
  operation(objectStore,tx,value=>{result=value;});
 });
}
function create(db){
 if(!db)throw Error('Database required');
 const get=(store,id)=>transaction(db,store,'readonly',(s,tx,done)=>{
  const req=s.get(id);req.onsuccess=()=>done(req.result);
 });
 const putImmutable=(store,id,value)=>transaction(db,store,'readwrite',(s,tx,done)=>{
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)){tx.abort();return;}
  const req=s.get(id);
  req.onsuccess=()=>{
   const existing=req.result;
   if(existing!==undefined){
    if(JSON.stringify(existing)!==JSON.stringify(value)){tx.abort();return;}
    done(false);return;
   }
   s.add(value,id);done(true);
  };
 });
 return Object.freeze({
  putSegment:(id,value)=>putImmutable('segments',id,value),
  getSegment:id=>get('segments',id),
  putManifest:(id,value)=>putImmutable('manifests',id,value),
  getManifest:id=>get('manifests',id),
  getHead:()=>get('head','current'),
  compareAndSwapHead:(expected,previous,next)=>transaction(db,'head','readwrite',(s,tx,done)=>{
   const req=s.get('current');
   req.onsuccess=()=>{
    const current=req.result;
    if((current?.generation||0)!==expected||(current?.commitment||null)!==previous){done(false);return;}
    s.put(next,'current');done(true);
   };
  })
 });
}
root.MedControlT046ImmutableReplica=Object.freeze({open,create});
})(typeof window!=='undefined'?window:globalThis);
