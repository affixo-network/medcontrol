/* Public UI catalog reader. Deliberately not wired into the protected application. */
(function (root) {
  'use strict';
  const SLOT = /⟦\d+⟧/g;
  function slots(value) { return (value.match(SLOT) || []).sort().join('|'); }
  function validateCatalog(catalog, source, language) {
    if (!catalog || catalog.language !== language || !catalog.messages ||
        typeof catalog.messages !== 'object' || Array.isArray(catalog.messages)) {
      throw new Error('Invalid language catalog');
    }
    const keys = Object.keys(source);
    if (keys.length !== 639 || Object.keys(catalog.messages).length !== keys.length ||
        Object.keys(catalog.messages).some(key => !Object.prototype.hasOwnProperty.call(source, key))) {
      throw new Error('Unexpected catalog size');
    }
    for (const key of keys) {
      const item = catalog.messages[key];
      if (typeof item !== 'string' || !item.trim() || /MC\s*\d{4}/i.test(item) ||
          /ZXQ[A-Z]+(?:QXZ|QX|Q)?/i.test(item) || slots(item) !== slots(source[key].source)) {
        throw new Error('Invalid translation entry: ' + key);
      }
    }
    return Object.freeze({ ...catalog, messages: Object.freeze({ ...catalog.messages }) });
  }
  async function loadCatalog(language, source, fetcher) {
    if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(language)) throw new Error('Invalid locale');
    const response = await (fetcher || root.fetch.bind(root))('locales/catalogs/' + language + '.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catalog unavailable: ' + language);
    return validateCatalog(await response.json(), source, language);
  }
  const api = Object.freeze({ validateCatalog, loadCatalog });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedControlCatalogLoader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
