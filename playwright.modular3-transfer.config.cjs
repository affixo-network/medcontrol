'use strict';
const base=require('./playwright.modular3.config.cjs');
module.exports={...base,
 testMatch:['modular3-entry-display-locale.spec.js','modular3-entry-history-locale.spec.js','modular3-entry-hints.spec.js','modular3-entry-empty-ui.spec.js','modular3-entry-auxiliary-visibility.spec.js','modular3-entry-unification.spec.js','modular3-protected-workspace.spec.js','modular3-final-intake.spec.js','modular3-existing-import.spec.js','modular3-boundary-checks.spec.js','modular3-copy-migration.spec.js','modular3-production-crypto-primitives.spec.js','modular3-production-static-cache.spec.js'],
 workers:2,
};
