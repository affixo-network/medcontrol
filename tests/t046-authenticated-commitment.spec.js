'use strict';
const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('T-046 authenticated commitment rejects forgery and cross-vault replay',async({page})=>{
 await page.goto('http://127.0.0.1:8765/t046-indexed-test.html');
 await page.addScriptTag({path:path.resolve(__dirname,'../js/modular3-t046-authenticated-commitment.js')});
 const r=await page.evaluate(async()=>{
  const c=window.MedControlT046AuthenticatedCommitment;
  const key=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const other=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const vault='vault_0123456789abcdef',digest='a'.repeat(64);
  const tag=await c.sign(key,vault,'segment',digest);
  return {
   valid:await c.verify(key,vault,'segment',digest,tag),
   wrongKey:await c.verify(other,vault,'segment',digest,tag),
   wrongVault:await c.verify(key,'vault_abcdef0123456789','segment',digest,tag),
   wrongKind:await c.verify(key,vault,'manifest',digest,tag),
   changedDigest:await c.verify(key,vault,'segment','b'.repeat(64),tag)
  };
 });
 expect(r).toEqual({valid:true,wrongKey:false,wrongVault:false,wrongKind:false,changedDigest:false});
});
