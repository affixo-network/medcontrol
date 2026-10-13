'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('production integration release gate: report exact missing connections and fail closed for commercial readiness',()=>{
 const storage=read('js/storage.js');
 const guard=read('js/auth-guard.js');
 const shell=read('tests/modular3-offline-access.js');
 const html=['input','action','dashboard','archive'].map(p=>read(p+'.html')).join('\n');
 const checks={
  productionEncrypted: !/localStorage\.setItem\(STORAGE_KEY\s*,\s*JSON\.stringify\(state\)\)/.test(storage),
  offlineAuthIntegrated: !guard.includes("import('https://esm.sh/@supabase/supabase-js@2')") && !guard.includes("goToLogin('session_check_failed')"),
  offlineServiceWorkerIntegrated: /navigator\.serviceWorker\.register\(/.test(guard+html),
  realPagesUseEncryptedBridge: /modular3-offline-encrypted-bridge\.js/.test(guard+html),
  testPrototypeFourSections: !shell.includes('Offline prototype section:')
 };
 const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 assert.ok(blockers.length>0,'If all blockers clear, replace this audit with a real production integration acceptance test');
 assert.equal(checks.productionEncrypted,false,'Do not claim production encryption while raw state is written to localStorage');
 assert.equal(checks.offlineAuthIntegrated,false,'Do not claim offline authorization while production redirects on network verification failure');
 assert.equal(checks.offlineServiceWorkerIntegrated,true,'Static caching registration must be integrated; offline auth and encryption remain blockers');
 assert.equal(checks.realPagesUseEncryptedBridge,false,'Do not claim encrypted bridge is integrated into the real four pages');
 console.log('MODULAR3_INTEGRATION_GATE '+JSON.stringify({ready:false,checks,blockers}));
});
