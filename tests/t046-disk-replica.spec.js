'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createDiskReplica}=require('./helpers/t046-disk-replica.cjs');
test('T-046 disk replica retains immutable objects and CAS head after reopen',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'medcontrol-t046-'));
 try{
  const id='a'.repeat(64),mid='b'.repeat(64),vaultId='vault_test12345678';
  const first=createDiskReplica(directory);
  await first.putSegment(id,{segment:{commitment:id},tag:'original'});
  await first.putManifest(mid,{manifest:{commitment:mid,vaultId,generation:1},tag:'signed'});
  expect(await first.compareAndSwapHead(0,null,{vaultId,generation:1,commitment:mid})).toBe(true);
  const reopened=createDiskReplica(directory);
  expect((await reopened.getSegment(id)).tag).toBe('original');
  expect((await reopened.getManifest(mid)).tag).toBe('signed');
  expect(await reopened.getHead()).toEqual({vaultId,generation:1,commitment:mid});
  expect(await reopened.compareAndSwapHead(0,null,{vaultId,generation:1,commitment:mid})).toBe(false);
  await expect(reopened.putSegment(id,{segment:{commitment:id},tag:'tampered'})).rejects.toThrow('Immutable conflict');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
