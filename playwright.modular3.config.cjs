const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests',
  testMatch:['modular3-browser.spec.js','modular3-real-modules.spec.js','modular3-deep-logic.spec.js','modular3-ui-actions.spec.js','modular3-cloud-recovery.spec.js','modular3-offline-proof.spec.js','modular3-offline-access.spec.js'],
  timeout:45000,
  retries:0,
  use:{browserName:'chromium',headless:true,trace:'retain-on-failure'},
  webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765/input.html',reuseExistingServer:!process.env.CI,timeout:30000}
});
