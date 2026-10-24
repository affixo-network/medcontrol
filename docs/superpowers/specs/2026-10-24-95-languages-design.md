# Protected Modular-3: 95 interface languages

Extend the completed UI in modular-3.000, preserving the four-section lifecycle, local password, encryption-before-acknowledgement, offline restart, and read-only Archive with explicit reset. No Production, Supabase, Microsoft, branch changes, record deletion, or runtime translation services.

Use the existing tr()/TRANSLATIONS interface and an explicit 95-locale manifest, native language names, BCP-47 locale matching, and RTL for Arabic/Hebrew/Persian/Urdu. Keep Russian and English canonical. UI catalogs are static assets cached before offline readiness; language selection is saved via the existing encrypted settings boundary. Entry selection is available before unlock without exposing medical data.

Approach: extend the existing catalog and replace UI-only literal text with translation calls. Preserve all user-entered values and existing stored history. Do not translate arbitrary medical text nodes or input values. Do not count English fallback or locale aliases as completed translations. Preparation may use public UI text only; no vault, password, or user record is sent externally. Generated translations require coverage/placeholder checks and functional tests; automation does not establish native-speaker editorial approval.

The exact prior 95-locale list was not found in repository or personal context. Implementation call: choose 95 distinct commonly supported language locales, retaining the existing nine and Armenian; document the manifest. Automatic device detection must not override a saved manual selection.
