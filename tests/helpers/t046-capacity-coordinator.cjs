/* T-046 isolated provider-capacity coordinator.
 * No production provider is configured. Never treats a request as provisioned bytes.
 */
'use strict';
function createCapacityCoordinator({ledger,provider}){
 if(!ledger||typeof ledger.reconcileMeasuredCapacity!=='function'||typeof ledger.available!=='function'||
    !provider||typeof provider.measureBytes!=='function'||typeof provider.ensureBytes!=='function')
  throw Error('Capacity coordinator prerequisites missing');
 let pending=null;
 async function ensureAvailable(requiredBytes){
  if(!Number.isSafeInteger(requiredBytes)||requiredBytes<1)throw Error('Invalid capacity request');
  if(pending)return pending.then(()=>ensureAvailable(requiredBytes));
  pending=(async()=>{
   const before=await provider.measureBytes();
   if(!Number.isSafeInteger(before)||before<0)throw Error('Invalid provider measurement');
   await ledger.reconcileMeasuredCapacity(async()=>before);
   let available=await ledger.available();
   if(available>=requiredBytes)return {availableBytes:available,provisioned:false};
   // Request additional physical capacity, then independently measure it.
   await provider.ensureBytes(requiredBytes-available);
   const after=await provider.measureBytes();
   if(!Number.isSafeInteger(after)||after<0)throw Error('Invalid provider remeasurement');
   const reconciled=await ledger.reconcileMeasuredCapacity(async()=>after);
   if(!reconciled.updated)throw Error('Provider capacity below existing reservations');
   available=await ledger.available();
   if(available<requiredBytes)throw Error('Provider did not confirm required capacity');
   return {availableBytes:available,provisioned:true};
  })();
  try{return await pending;}finally{pending=null;}
 }
 return Object.freeze({ensureAvailable});
}
module.exports={createCapacityCoordinator};
