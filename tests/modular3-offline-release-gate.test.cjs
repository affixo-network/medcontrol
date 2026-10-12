'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('offline release blocked until production storage encryption and real offline auth are integrated',()=>{
 const storage=fs.readFileSync(path.join(root,'js/storage.js'),'utf8');
 const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
 const shell=fs.readFileSync(path.join(root,'tests/modular3-offline-access.js'),'utf8');
 const plaintext=storage.includes('localStorage.setItem(STORAGE_KEY,JSON.stringify(state))');
 const onlineAuth=guard.includes("import('https://esm.sh/@supabase/supabase-js@2')");
 const placeholder=shell.includes('Offline prototype section:');
 const readiness={productionEncrypted:!plaintext,realOfflineAuth:!onlineAuth,realOfflineNavigation:!placeholder};
 assert.equal(readiness.productionEncrypted&&readiness.realOfflineAuth&&readiness.realOfflineNavigation,false,'Offline production must not be declared ready without all gates');
 console.log('OFFLINE_RELEASE_GATE '+JSON.stringify(readiness));
});
