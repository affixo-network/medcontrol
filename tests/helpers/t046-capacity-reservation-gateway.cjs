/* T-046 isolated reservation gateway: no physical provider configured. */
'use strict';
function createCapacityReservationGateway({coordinator,ledger}){
 if(!coordinator||typeof coordinator.ensureAvailable!=='function'||!ledger||typeof ledger.reserve!=='function')
  throw Error('Missing reservation gateway dependencies');
 async function reserve(requestId,bytes){
  if(typeof requestId!=='string'||!requestId||!Number.isSafeInteger(bytes)||bytes<1)
   throw Error('Invalid reservation request');
  // Capacity confirmation does not constitute a persisted reservation.
  await coordinator.ensureAvailable(bytes);
  let result=await ledger.reserve(requestId,bytes);
  if(result.reserved)return result;
  // Another writer may have consumed the measured capacity. Recheck once.
  await coordinator.ensureAvailable(bytes);
  result=await ledger.reserve(requestId,bytes);
  if(!result.reserved)throw Error('Capacity reservation not committed');
  return result;
 }
 return Object.freeze({reserve});
}
module.exports={createCapacityReservationGateway};
