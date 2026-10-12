'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('offline proof cannot silently replace production auth or expose production routes',()=>{
 const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
 const shell=fs.readFileSync(path.join(root,'tests/modular3-offline-access.js'),'utf8');
 const worker=fs.readFileSync(path.join(root,'tests/modular3-offline-sw.js'),'utf8');
 assert.match(guard,/createVerifiedSupabase\(/);
 assert.match(guard,/getSession\(/);
 assert.doesNotMatch(shell,/medcontrolNavigateTo|location\.assign|location\.replace|fetch\(/);
 assert.match(worker,/if\(!ASSETS\.includes\(url\.pathname\)\)return/);
 for(const page of ['input','action','dashboard','archive']){
  const html=fs.readFileSync(path.join(root,page+'.html'),'utf8');
  assert.match(html,/js\/auth-guard\.js/);
  assert.doesNotMatch(html,/modular3-offline-(access|auth|sw)/);
 }
});
test('offline password verifier does not imply encryption of medical records',()=>{
 const auth=fs.readFileSync(path.join(root,'tests/modular3-offline-auth.js'),'utf8');
 assert.match(auth,/PBKDF2/);
 assert.match(auth,/medcontrol_offline_proof_credential_v1/);
 assert.doesNotMatch(auth,/AES-GCM|encrypt\(/);
 const storage=fs.readFileSync(path.join(root,'js/storage.js'),'utf8');
 assert.match(storage,/localStorage/);
});
