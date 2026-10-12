/* MedControl modular-3 preparation: isolated script loader.
 * Not connected to production auth-guard or page entrypoints.
 * No authorization bypass, storage access, or network requests on import.
 */
(function (root) {
  'use strict';
  function createLoader(options) {
    const opts = options || {};
    const load = opts.load;
    if (typeof load !== 'function') throw new TypeError('A script loading function is required');
    const loaded = new Set();
    const pending = new Map();
    async function ensureScript(source) {
      if (typeof source !== 'string' || !source.trim()) throw new TypeError('Invalid script path');
      const key = source.split('?')[0];
      if (loaded.has(key)) return;
      if (pending.has(key)) return pending.get(key);
      const task = Promise.resolve().then(() => load(source)).then(() => {
        loaded.add(key);
        pending.delete(key);
      }, error => {
        pending.delete(key);
        throw error;
      });
      pending.set(key, task);
      return task;
    }
    async function ensureScripts(sources) {
      if (!Array.isArray(sources)) throw new TypeError('Script list must be an array');
      for (const source of sources) await ensureScript(source);
    }
    return Object.freeze({ ensureScript, ensureScripts, isLoaded: source => loaded.has(String(source).split('?')[0]) });
  }
  root.MedControlScriptLoader = Object.freeze({ createLoader });
})(typeof window !== 'undefined' ? window : globalThis);
