'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('offline release gate reports independently verified blockers',()=>{
 const storage=fs.readFileSync(path.join(root,'js/storage.js'),'utf8');
 const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
 const shell=fs.readFileSync(path.join(root,'tests/modular3-offline-access.js'),'utf8');
 const checks={
  productionEncrypted: !/localStorage\.setItem\(STORAGE_KEY\s*,\s*JSON\.stringify\(state\)\)/.test(storage),
  realOfflineAuth: !guard.includes("import('https://esm.sh/@supabase/supabase-js@2')"),
  realOfflineNavigation: !shell.includes('Offline prototype section:')
 };
 const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 assert.ok(blockers.length>0,'If all blockers are cleared, replace this audit with production E2E release validation');
 console.log('OFFLINE_RELEASE_GATE '+JSON.stringify({ready:false,checks,blockers}));
});
