# T-046 — architecture contract for 100,000,000 events

Status: design requirements, **not** performance certification.
Scope: opt-in copied sharded vault only. No changes to legacy data, production, or the approved Russian baseline.

## Acceptance envelope
- 100,000,000 medical events in a single personal vault.
- Ordinary personal computer with 8 GiB installed RAM, with other applications consuming part of it; design must not assume all 8 GiB are free.
- SSD storage. Actual disk capacity must be checked against measured encrypted bytes per event, index overhead, and backup headroom.
- Offline login, encrypted at-rest records, recovery after interruption, multi-tab conflict prevention, and verifiable backup/restore.
- Preserve the existing vault until a separately approved, fully tested cutover.

## Invariants
1. **No operation proportional to total event count in resident memory.** Read, search, write, export, import, and verification use bounded batches or cursors. A UI view never materializes the full event history.
2. **No full-table scan for ordinary navigation.** Indexed queries must support owner, event time, medication/course, and required status filters. Query plans and indexes must be reviewed before large-volume testing.
3. **Durable commits.** A reported successful write has completed its IndexedDB transaction; a crash must not silently corrupt an earlier committed record.
4. **Authenticated encryption.** Each event uses a unique nonce, authenticated record identity, and password-derived key. Never persist plaintext or raw key material.
5. **Versioned recovery.** Export and restore are resumable in bounded pages, detect missing, duplicated, reordered, foreign, or corrupted records, and verify a complete dataset before approval.
6. **Cross-tab consistency.** Concurrent updates must not silently overwrite newer encrypted medical records.
7. **Measured resource envelope.** Record wall time, per-operation latency, peak process memory where measurable, disk growth, and reload/recovery time. CI pass/fail alone is not a performance measurement.
8. **Isolation.** Synthetic load tests use a new owner namespace, never active patient data. Production and Supabase remain untouched.

## Findings from source inspection (2026-11-03)
- `modular3-shard-store.js`: IndexedDB composite owner/id key, bounded paging (1..500), atomic batch insert, conditional replacement. This is a foundation, not a complete 100M-event query architecture.
- `modular3-shard-vault.js`: per-record AES-GCM, bounded encrypted batches, paged read/export. The current facade lacks the secondary event-time/course/status indexes required for efficient real-world history queries.
- `modular3-copy-bridge.js`: `SOURCE.read()`, `entries(source)`, `collected`, and rebuilt arrays retain complete datasets in memory. **The bridge is suitable only for bounded legacy copies until rewritten as a streaming migration/verification pipeline.**
- The 1,200-event Playwright run validates functional correctness at that scale; it does not certify 100M events or the 8 GiB machine envelope.

## Engineering sequence
1. Specify event schema, indexed query patterns, disk budget and bounded-memory migration protocol.
2. Implement and test those architectural requirements with synthetic data.
3. Verify encryption, crash recovery, offline behavior, multi-tab updates, and complete streamed backup/restore.
4. Run progressively larger representative datasets; capture latency, peak memory, and bytes/event. Extrapolations are estimates, not acceptance.
5. Certify 100M events only after direct representative-scale evidence and target-hardware verification.

No production cutover is authorized by this document.
