/* T-046 isolated capacity reservations, not an actual provider capacity allocator. */
'use strict';
function createCapacityLedger(pool,vaultId){
 if(!pool||typeof pool.connect!=='function'||!vaultId)throw Error('Missing ledger prerequisites');
 async function reserve(requestId,bytes){
  if(typeof requestId!=='string'||!requestId||!Number.isSafeInteger(bytes)||bytes<1)throw Error('Invalid reservation');
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const existing=await client.query('SELECT bytes FROM t046_replica_reservations WHERE vault_id=$1 AND request_id=$2',[vaultId,requestId]);
   if(existing.rowCount){
    await client.query('COMMIT');
    return {reserved:Number(existing.rows[0].bytes)===bytes,idempotent:true};
   }
   const updated=await client.query('UPDATE t046_replica_capacity SET reserved_bytes=reserved_bytes+$2 WHERE vault_id=$1 AND limit_bytes-reserved_bytes >= $2 RETURNING reserved_bytes,limit_bytes',[vaultId,bytes]);
   if(!updated.rowCount){await client.query('ROLLBACK');return {reserved:false,idempotent:false};}
   await client.query('INSERT INTO t046_replica_reservations(vault_id,request_id,bytes) VALUES($1,$2,$3)',[vaultId,requestId,bytes]);
   await client.query('COMMIT');
   return {reserved:true,idempotent:false};
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }
 async function available(){
  const result=await pool.query('SELECT limit_bytes-reserved_bytes AS available FROM t046_replica_capacity WHERE vault_id=$1',[vaultId]);
  if(!result.rowCount)throw Error('Capacity not provisioned');
  return Number(result.rows[0].available);
 }
 return Object.freeze({reserve,available});
}
module.exports={createCapacityLedger};
