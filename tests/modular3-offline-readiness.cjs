/* Modular 3 offline readiness audit. Read-only, no changes to auth or user data. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const guard=fs.readFileSync(path.join(root,'js/auth-guard.js'),'utf8');
const html=['input','action','dashboard','archive'];
const groups={};
for(const match of guard.matchAll(/\b(input|action|dashboard|archive):\[([^\n]+)\]/g)){
 groups[match[1]]=match[2];
}
const unique=new Set();
for(const page of html){
 const source=fs.readFileSync(path.join(root,page+'.html'),'utf8');
 assert.match(source,/js\/auth-guard\.js/);
 const list=groups[page];assert.ok(list,'missing dependency list '+page);
 for(const match of list.matchAll(/'([^']+\.js(?:\?[^']*)?)'/g)){
  const file=match[1].split('?')[0];unique.add(file);
  assert.ok(fs.existsSync(path.join(root,file)),'missing offline script '+file);
 }
}
assert.match(guard,/import\('https:\/\/esm\.sh\/@supabase\/supabase-js@2'\)/);
assert.match(guard,/goToLogin\('session_check_failed'\)/);
assert.match(guard,/fetch\('\/'\+targetPage\+'\.html\?deployment_check=/);
assert.match(guard,/document\.createElement\('script'\)/);
const report={checkedPages:html,uniqueLocalScripts:unique.size,allLocalScriptsPresent:true,offlineBlockers:['Supabase Auth verification requires network','Supabase JS imported from esm.sh','No offline entrypoint/service-worker cache','Deployment check uses network but has graceful fallback'],productionModified:false};
console.log(JSON.stringify(report,null,2));
