const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',
 testMatch:['t046-authenticated-commitment.spec.js','t046-authenticated-gateway.spec.js','t046-authenticated-atomic.spec.js','t046-authenticated-abort.spec.js','t046-authenticated-reopen.spec.js','t046-authenticated-corruption.spec.js','t046-authenticated-restore.spec.js','t046-replica-protocol.spec.js','t046-replica-interruption.spec.js','t046-replica-resume.spec.js','t046-replica-restart.spec.js','t046-replica-queue.spec.js','t046-replica-coordinator.spec.js','t046-replica-drain.spec.js','t046-replica-retry.spec.js','t046-replica-cross-tab.spec.js','t046-replica-backoff.spec.js','t046-replica-restart-queue.spec.js','t046-replica-process-restart.spec.js','t046-replica-stage-recovery.spec.js','t046-replica-conflict.spec.js','t046-immutable-replica.spec.js','t046-immutable-replica-reopen.spec.js','t046-immutable-replica-process-restart.spec.js','t046-immutable-replica-concurrent-restart.spec.js','t046-integrated-vault.spec.js','t046-integrated-replication.spec.js','t046-http-replica.spec.js','t046-replica-http-server.spec.js','t046-disk-replica.spec.js','t046-postgres-replica.spec.js','t046-resource-governor.spec.js','t046-capacity-remeasurement.spec.js'],
 timeout:45000,
 retries:0,
 use:{browserName:'chromium',headless:true,trace:'retain-on-failure'},
 webServer:{
  command:'python3 -m http.server 8765 --bind 127.0.0.1',
  url:'http://127.0.0.1:8765/t046-indexed-test.html',
  reuseExistingServer:!process.env.CI,
  timeout:30000
 }
});
