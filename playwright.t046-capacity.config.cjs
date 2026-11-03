const {defineConfig}=require('@playwright/test');
// Dedicated, explicitly opt-in capacity testing; excluded from routine CI.
// Run on a disposable browser profile and an SSD with sufficient free space.
module.exports=defineConfig({
 testDir:'./tests',
 testMatch:['t046-dedicated-capacity.spec.js'],
 workers:1,
 retries:0,
 timeout:0,
 use:{browserName:'chromium',headless:true,trace:'off',serviceWorkers:'allow'},
 webServer:{
  command:'python3 -m http.server 8765 --bind 127.0.0.1',
  url:'http://127.0.0.1:8765/t046-indexed-test.html',
  reuseExistingServer:false,
  timeout:30000
 }
});
