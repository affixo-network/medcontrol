const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',
 testMatch:['t046-windows-profile.spec.js'],
 workers:1,retries:0,timeout:120000,
 use:{browserName:'chromium',headless:true,trace:'off'},
 webServer:{
  command:'node tools/t046-http-server.cjs',
  url:'http://127.0.0.1:8765/t046-indexed-test.html',
  reuseExistingServer:false,timeout:30000
 }
});
