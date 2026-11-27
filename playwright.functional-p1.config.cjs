const {defineConfig}=require('@playwright/test');
const port=process.env.MEDCONTROL_P1_PORT||'18876',tag=process.env.MEDCONTROL_P1_TAG||'browser';
process.env.MEDCONTROL_P1_PORT=port;
module.exports=defineConfig({testDir:'./tests',testMatch:['modular3-functional-p1-*.spec.js'],fullyParallel:true,workers:3,retries:0,timeout:120000,outputDir:'../'+tag+'-results',reporter:[['list'],['json',{outputFile:'../'+tag+'-results.json'}]],use:{browserName:'chromium',headless:true,timezoneId:'Asia/Yerevan',locale:'de-DE',serviceWorkers:'block',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']},trace:'retain-on-failure'},webServer:{command:'python3 -m http.server '+port+' --bind 127.0.0.1',url:'http://127.0.0.1:'+port+'/input.html',reuseExistingServer:false,timeout:30000}});
