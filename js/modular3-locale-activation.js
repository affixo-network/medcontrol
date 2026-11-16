/* Opt-in public catalog activation. Never touches protected state or medical data. */
(function (root) {
  'use strict';
  async function activate(language, options) {
    const { source, fallback, fetcher, loader, adapter, prepare, register } = options || {};
    if (!prepare || typeof prepare.prepare !== 'function' || typeof register !== 'function') {
      throw new Error('Locale activation dependencies missing');
    }
    const prepared = await prepare.prepare(language, { source, fallback, fetcher, loader, adapter });
    const registered = await register(prepared);
    if (registered !== false && prepared.correctionMessages) {
      const previous = root.MedControlCorrectionCatalogs || {};
      root.MedControlCorrectionCatalogs = Object.freeze({
        ...previous,
        [language]: Object.freeze({ messages: prepared.correctionMessages })
      });
    }
    if (registered !== false && source && prepared.correctionMessages) {
      // Full validated catalog for exact static UI strings, not patient content.
      // Ambiguous duplicate Russian source strings are excluded unless translations agree.
      const mapped = Object.create(null);
      const ambiguous = new Set();
      for (const [id, entry] of Object.entries(source)) {
        const russian = entry && entry.source;
        const translated = prepared.correctionMessages[id];
        if (typeof russian !== 'string' || !russian.trim() ||
            typeof translated !== 'string' || !translated.trim() || ambiguous.has(russian)) continue;
        if (Object.prototype.hasOwnProperty.call(mapped, russian) && mapped[russian] !== translated) {
          delete mapped[russian];
          ambiguous.add(russian);
        } else mapped[russian] = translated;
      }
      const previous = root.MedControlProtectedUiCatalogs || {};
      root.MedControlProtectedUiCatalogs = Object.freeze({
        ...previous, [language]: Object.freeze({ ...mapped })
      });
    }
    return registered;
  }
  const api = Object.freeze({ activate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedControlLocaleActivation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
