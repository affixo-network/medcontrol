'use strict';
const base=require('./playwright.modular3.config.cjs');
module.exports={...base,
 testMatch:['modular3-boundary-checks.spec.js','modular3-copy-migration.spec.js','modular3-production-crypto-primitives.spec.js','modular3-production-static-cache.spec.js'],
 workers:2,
};
