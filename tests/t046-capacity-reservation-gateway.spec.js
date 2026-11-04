'use strict';
const {test,expect}=require('@playwright/test');
const {createCapacityReservationGateway}=require('./helpers/t046-capacity-reservation-gateway.cjs');
test('T-046 reservation gateway does not acknowledge failed durable reservation',async()=>{
 let attempts=0,capacityChecks=0;
 const gateway=createCapacityReservationGateway({
  coordinator:{ensureAvailable:async bytes=>{expect(bytes).toBe(10);capacityChecks++;}},
  ledger:{reserve:async()=>{attempts++;return {reserved:attempts>=2,idempotent:false};}}
 });
 expect(await gateway.reserve('r1',10)).toEqual({reserved:true,idempotent:false});
 expect(capacityChecks).toBe(2);
 const denied=createCapacityReservationGateway({
  coordinator:{ensureAvailable:async()=>{}},
  ledger:{reserve:async()=>({reserved:false,idempotent:false})}
 });
 await expect(denied.reserve('r2',10)).rejects.toThrow('not committed');
 const unconfirmed=createCapacityReservationGateway({
  coordinator:{ensureAvailable:async()=>{throw Error('Provider did not confirm');}},
  ledger:{reserve:async()=>{throw Error('Must not reserve');}}
 });
 await expect(unconfirmed.reserve('r3',10)).rejects.toThrow('Provider did not confirm');
});
