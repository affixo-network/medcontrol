/* Optional locale bootstrap for an already unlocked MedControl page.
 * Never reads patient records, changes the selected language, or writes storage.
 * Unavailable catalogs leave the built-in RU/EN UI untouched.
 */
(function (root) {
  'use strict';
  async function install(options) {
    const { language, fallback, fetcher, loadScript, register } = options || {};
    if (!language || language === 'ru' || language === 'en') return false;
    if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(language) ||
        typeof fetcher !== 'function' || typeof loadScript !== 'function' ||
        typeof register !== 'function' || !fallback) return false;
    try {
      const response = await fetcher('locales/source-ru.json', { cache: 'no-store' });
      if (!response.ok) return false;
      const source = await response.json();
      for (const path of [
        'js/modular3-public-catalog-loader.js',
        'js/modular3-legacy-locale-adapter.js',
        'js/modular3-locale-preparation.js',
        'js/modular3-locale-activation.js'
      ]) await loadScript(path);
      return await root.MedControlLocaleActivation.activate(language, {
        source, fallback, fetcher,
        loader: root.MedControlCatalogLoader,
        adapter: root.MedControlLegacyLocaleAdapter,
        prepare: root.MedControlLocalePreparation,
        register
      });
    } catch (_) {
      return false;
    }
  }
  const api = Object.freeze({ install });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedControlLocaleBootstrap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
