const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:['t046-session-performance.spec.js'],
 workers:1,retries:0,timeout:120000,
 use:{browserName:'chromium',headless:true,trace:'retain-on-failure'},
 webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',
  url:'http://127.0.0.1:8765/t046-indexed-test.html',
  reuseExistingServer:!process.env.CI,timeout:30000}
});
