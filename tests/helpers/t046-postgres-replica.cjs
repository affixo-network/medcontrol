/* T-046 PostgreSQL-backed replica adapter, isolated from the medical vault.
 * Requires schema in tests/helpers/t046-postgres-replica.sql and a pg-compatible pool.
 * Transactions and row locking provide cross-process CAS; deployment is not configured.
 */
'use strict';
function createPostgresReplica(pool,vaultId){
 if(!pool||typeof pool.connect!=='function'||typeof vaultId!=='string'||!vaultId)throw Error('PostgreSQL pool and vault required');
 const hash=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
 async function transaction(fn){
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }
 async function immutable(kind,id,value){
  if(!hash(id)||!value||value[kind==='segment'?'segment':'manifest']?.commitment!==id)throw Error('Invalid object');
  return transaction(async client=>{
   const payload=JSON.stringify(value);
   const result=await client.query(
    'INSERT INTO t046_replica_objects(vault_id,kind,commitment,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING RETURNING commitment',
    [vaultId,kind,id,payload]);
   if(result.rowCount===1)return;
   const current=await client.query('SELECT payload FROM t046_replica_objects WHERE vault_id=$1 AND kind=$2 AND commitment=$3',[vaultId,kind,id]);
   if(current.rowCount!==1||JSON.stringify(current.rows[0].payload)!==JSON.stringify(JSON.parse(payload)))throw Error('Immutable conflict');
  });
 }
 async function get(kind,id){
  if(!hash(id))throw Error('Invalid commitment');
  const result=await pool.query('SELECT payload FROM t046_replica_objects WHERE vault_id=$1 AND kind=$2 AND commitment=$3',[vaultId,kind,id]);
  return result.rows[0]?.payload||null;
 }
 return Object.freeze({
  putSegment:(id,value)=>immutable('segment',id,value),
  getSegment:id=>get('segment',id),
  putManifest:(id,value)=>immutable('manifest',id,value),
  getManifest:id=>get('manifest',id),
  getHead:async()=>{
   const result=await pool.query('SELECT generation,commitment FROM t046_replica_heads WHERE vault_id=$1',[vaultId]);
   return result.rows[0]?{vaultId,generation:Number(result.rows[0].generation),commitment:result.rows[0].commitment}:null;
  },
  compareAndSwapHead:(expectedGeneration,previousCommitment,next)=>transaction(async client=>{
   if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||!next||
      next.vaultId!==vaultId||next.generation!==expectedGeneration+1||!hash(next.commitment))return false;
   // Serializes even the first generation, when no head row exists.
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[vaultId]);
   const current=await client.query('SELECT generation,commitment FROM t046_replica_heads WHERE vault_id=$1 FOR UPDATE',[vaultId]);
   const row=current.rows[0];
   if(Number(row?.generation||0)!==expectedGeneration||(row?.commitment||null)!==previousCommitment)return false;
   const manifest=await client.query('SELECT payload FROM t046_replica_objects WHERE vault_id=$1 AND kind=$2 AND commitment=$3',[vaultId,'manifest',next.commitment]);
   if(manifest.rowCount!==1||manifest.rows[0].payload.manifest?.vaultId!==vaultId||
      manifest.rows[0].payload.manifest?.generation!==next.generation)return false;
   await client.query('INSERT INTO t046_replica_heads(vault_id,generation,commitment) VALUES($1,$2,$3) ON CONFLICT(vault_id) DO UPDATE SET generation=EXCLUDED.generation,commitment=EXCLUDED.commitment',[vaultId,next.generation,next.commitment]);
   return true;
  })
 });
}
module.exports={createPostgresReplica};
