/* Opt-in public catalog activation. Never touches protected state or medical data. */
(function (root) {
  'use strict';
  async function activate(language, options) {
    const { source, fallback, fetcher, loader, adapter, prepare, register } = options || {};
    if (!prepare || typeof prepare.prepare !== 'function' || typeof register !== 'function') {
      throw new Error('Locale activation dependencies missing');
    }
    const prepared = await prepare.prepare(language, { source, fallback, fetcher, loader, adapter });
    return register(prepared);
  }
  const api = Object.freeze({ activate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedControlLocaleActivation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
