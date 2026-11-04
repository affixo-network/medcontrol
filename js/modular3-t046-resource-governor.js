/* T-046 isolated automatic resource governor.
 * Bounded replication work; never deletes a medical event or asserts remote durability.
 * The host service, not the patient, owns capacity expansion.
 */
(function(root){
'use strict';
function create({maxInFlight=2,maxBatchBytes=1024*1024,lowWatermarkBytes=8*1024*1024,requestCapacity,measureCapacity}={}){
 if(!Number.isSafeInteger(maxInFlight)||maxInFlight<1||maxInFlight>16||
    !Number.isSafeInteger(maxBatchBytes)||maxBatchBytes<1||
    !Number.isSafeInteger(lowWatermarkBytes)||lowWatermarkBytes<0||
    typeof requestCapacity!=='function'||(measureCapacity!==undefined&&typeof measureCapacity!=='function'))throw Error('Invalid governor configuration');
 let inFlight=0,expansion=null;
 async function reserve({availableBytes,pendingBytes=0,estimatedWriteBytes}){
  for(const value of [availableBytes,pendingBytes,estimatedWriteBytes])
   if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid resource measurement');
  if(estimatedWriteBytes===0)throw Error('Empty write estimate');
  const remaining=availableBytes-pendingBytes;
  if(remaining-estimatedWriteBytes<lowWatermarkBytes&&!expansion){
   expansion=Promise.resolve().then(()=>requestCapacity({
    requiredBytes:Math.max(0,lowWatermarkBytes+pendingBytes+estimatedWriteBytes-availableBytes)
   })).finally(()=>{expansion=null;});
  }
  if(expansion)await expansion;
  // The expansion callback is only a request, not proof of provisioned bytes.
  // An authoritative measurement is required before admission after expansion.
  const measured=measureCapacity?await measureCapacity():null;
  if(measured!==null&&(!Number.isSafeInteger(measured)||measured<0))throw Error('Invalid capacity remeasurement');
  const actual=measured===null?availableBytes:measured;
  const admitted=actual-pendingBytes>=estimatedWriteBytes;
  return Object.freeze({admitted,
   status:admitted?'LOCAL_CAPACITY_MEASURED':'CAPACITY_UNAVAILABLE',
   requiresRecheck:measured===null&&remaining-estimatedWriteBytes<lowWatermarkBytes});
 }
 async function runBatch({bytes,task}){
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>maxBatchBytes||typeof task!=='function')throw Error('Invalid batch');
  if(inFlight>=maxInFlight)return {started:false,reason:'BACKPRESSURE'};
  inFlight++;
  try{return {started:true,result:await task()};}
  finally{inFlight--;}
 }
 return Object.freeze({reserve,runBatch,stats:()=>Object.freeze({inFlight,maxInFlight,maxBatchBytes})});
}
root.MedControlT046ResourceGovernor=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
