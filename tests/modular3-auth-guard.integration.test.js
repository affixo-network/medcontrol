'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const guard = fs.readFileSync(path.join(__dirname,'../js/auth-guard.js'),'utf8');
const loader = fs.readFileSync(path.join(__dirname,'../js/modular3-script-loader.js'),'utf8');

function harness(session) {
  const scripts=[];
  const redirects=[];
  const state={mounted:[],authCalls:0,rendered:0};
  const storage = session ? {'sb-lewdbjjaohqxbirzhrbm-auth-token':JSON.stringify(session)} : {};
  const doc={
    currentScript:{dataset:{page:'input'}},
    head:{appendChild(element) {
      if(element.tagName==='script') {
        scripts.push(element.src);
        if(element.src==='js/modular3-script-loader.js') vm.runInContext(loader,ctx);
        if(element.src==='js/navigation.js?v=force-majeure-20260918-2') ctx.mount=(page)=>state.mounted.push(page);
        queueMicrotask(()=>element.onload?.());
      }
    }},
    createElement(tag){return {tagName:tag,rel:'',as:'',href:'',src:'',async:true,onload:null,onerror:null};},
    getElementById(){return {innerHTML:''};},
    querySelector(){return null}
  };
  const ctx=vm.createContext({
    window:{location:{pathname:'/input.html',href:'https://medcontrol.test/input.html',replace:url=>redirects.push(url)},history:{pushState(){}},medcontrolCloudSnapshot:{queue(){},validState:()=>true,meaningfulState:()=>false,latest:async()=>({ok:true,snapshot:null})},__testImport:async()=>({createClient:()=>({auth:{getSession:async()=>{state.authCalls++;return {data:{session},error:null};}}})})},
    document:doc,localStorage:{getItem:key=>storage[key]||null},URL,URLSearchParams,Date,Promise,Set,Map,console,setTimeout,queueMicrotask
  });
  return {ctx,scripts,redirects,state};
}
async function waitFor(condition) {
  for(let i=0;i<200;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,1));}
  assert.fail('Timed out waiting for auth guard');
}
test('no session: redirects to login and does not load application scripts',async()=>{
  const h=harness(null);
  vm.runInContext(guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","window.__testImport()"),h.ctx);
  await waitFor(()=>h.redirects.length>0);
  assert.match(h.redirects[0],/auth-login\.html/);
  assert.equal(h.scripts.length,0);
  assert.equal(h.state.authCalls,1);
});
test('verified session: loads modular loader and mounts input with Supabase user',async()=>{
  const session={access_token:'test',refresh_token:'test',user:{id:'user-test'},expires_at:1};
  const h=harness(session);
  vm.runInContext(guard.replace("import('https://esm.sh/@supabase/supabase-js@2')","window.__testImport()"),h.ctx);
  await waitFor(()=>h.state.mounted.length>0);
  assert.equal(h.scripts[0],'js/modular3-script-loader.js');
  assert.equal(h.state.mounted[0],'input');
  assert.equal(h.ctx.window.medcontrolSupabaseUser.id,'user-test');
  assert.equal(h.redirects.length,0);
  assert.equal(h.state.authCalls,1);
});
test('guard still contains real Supabase verification and no auth bypass',()=>{
  assert.match(guard,/import\('https:\/\/esm\.sh\/@supabase\/supabase-js@2'\)/);
  assert.match(guard,/supabase\.auth\.getSession\(\)/);
  assert.match(guard,/if\(!attachVerifiedSupabase\(verified\)\)return/);
  assert.match(guard,/await loader\.ensureScripts\(list\)/);
});
