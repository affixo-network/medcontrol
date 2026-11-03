# T-046 — Indexed event schema and query contract (design v1)

**Status:** design only. No storage schema migration, no production switch, no medical-data mutation.

## Key distinction
Encrypted event content and queryable index metadata are different. An IndexedDB index cannot search inside AES-GCM ciphertext. Indexing time, course, medication or status in cleartext would leak sensitive medical metadata. The current `records` store has only an owner/id index; it does **not** yet support efficient history queries by time/course/status.

## Proposed privacy-preserving structure
- Vault namespace: randomly generated opaque owner identifier.
- Event payload: AES-256-GCM ciphertext bound to owner and immutable event ID.
- Event ID: sortable opaque identifier generated without encoding patient, medicine, status, or timestamp.
- Queryable fields: *no plaintext medicine, course, status, or timestamps in IndexedDB indexes*.
- Per-vault secret query tokens: deterministic keyed tokens (e.g. HMAC-SHA-256) derived from a dedicated, domain-separated query key; token input is canonicalized `(field, value)`. This supports exact equality filtering, not confidential range filtering.
- Time-range queries: require a separate privacy-reviewed strategy, e.g. bounded time-bucket tokens with explicit granularity and leakage assessment. Do **not** add plaintext timestamp indexes by default.
- Record index rows: `(owner, token, eventId)` references stored alongside ciphertext in the **same IndexedDB readwrite transaction**, so record/index cannot diverge after a crash.
- Revision/replace: atomically remove old token references and insert new ones, with ciphertext compare-and-swap inside the same transaction.
- Cursor: `(token, eventId)`, page size <=500, stable deterministic order. No full-result accumulation in application memory.
- Event deletion and archival must preserve existing approved semantics and require explicit authorization; no deletion mechanism is introduced by this design.

## Index cost and 100M sizing
Let N=100,000,000, k=index tokens per event, R=measured encrypted event bytes, I=measured bytes per index entry, and H=measured IndexedDB/SSD overhead. Then:
`disk >= N * (R + k * I) + H + backup_headroom`.
Do not publish a disk capacity claim until R, I, H, and backup headroom are measured on representative records and a target SSD. k must be bounded by schema.

Memory budget is independent of N: resident page <=500 events plus bounded encryption and index buffers. Verify with browser process measurements, not only JavaScript heap figures.

## Acceptance tests before schema adoption
1. A token for one vault cannot query another vault.
2. Index rows never contain raw medication/course/status/time values.
3. A new record and its tokens commit or roll back together.
4. A stale replacement cannot change either ciphertext or index.
5. Page boundaries never duplicate or omit records for a stable snapshot.
6. Changes during pagination have a documented consistency model (snapshot or revision-bound cursor).
7. Restore validates index consistency or rebuilds indexes from decrypted records in bounded batches.
8. Offline and cross-tab tests pass on the unchanged `modular-3.000` branch.

## Decision gate
Do not implement indexes or certify 100M until exact query patterns, acceptable metadata leakage, key derivation and rotation, time-range semantics, and disk budget are reviewed. Existing encrypted records remain untouched.
