/* Public locale preparation only. Does not access protected state or activate UI. */
(function (root) {
  'use strict';
  async function prepare(language, options) {
    const { source, fallback, fetcher, loader, adapter } = options || {};
    if (!loader || !adapter || !source || !fallback || typeof fallback !== 'object') {
      throw new Error('Locale preparation requires explicit public inputs');
    }
    const catalog = await loader.loadCatalog(language, source, fetcher);
    const labels = adapter.adaptCatalog(catalog, fallback);
    return Object.freeze({
      language: catalog.language,
      labels: Object.freeze(labels)
    });
  }
  const api = Object.freeze({ prepare });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedControlLocalePreparation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
