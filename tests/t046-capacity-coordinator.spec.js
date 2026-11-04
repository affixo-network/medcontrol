'use strict';
const {test,expect}=require('@playwright/test');
const {createCapacityCoordinator}=require('./helpers/t046-capacity-coordinator.cjs');
test('T-046 provider coordinator rejects unconfirmed allocation and accepts measured growth',async()=>{
 let physical=50,accounted=50,requestCount=0;
 const ledger={
  reconcileMeasuredCapacity:async measure=>{accounted=await measure();return {updated:true};},
  available:async()=>accounted
 };
 const provider={
  measureBytes:async()=>physical,
  ensureBytes:async()=>{requestCount++;}
 };
 const coordinator=createCapacityCoordinator({ledger,provider});
 await expect(coordinator.ensureAvailable(100)).rejects.toThrow('did not confirm');
 expect(requestCount).toBe(1);
 provider.ensureBytes=async()=>{physical=200;requestCount++;};
 const confirmed=await coordinator.ensureAvailable(100);
 expect(confirmed).toEqual({availableBytes:200,provisioned:true});
 expect(requestCount).toBe(2);
});
