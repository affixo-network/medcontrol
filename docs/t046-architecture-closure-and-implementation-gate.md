# MedControl Modular-3 — T-046 / A01: integrated 500-million-event storage architecture

**Architecture decision record, 2026-11-05.** Scope: existing `modular-3.000` branch only. This is the unified engineering design; it is **not** evidence that the managed infrastructure or the 500M acceptance run exists. Existing patient records, Modular-2, production, Supabase and approved Russian translations are not modified by this document.

## 1. Product contract and ownership

A personal logical vault shall support **500,000,000 distinct durable encrypted medical events**, with no arbitrary lifetime cap and no requirement to keep the entire archive on the device. MedControl, not the patient, operates provisioning, synchronization, recovery, quotas, replicas and lifecycle management. Normal PC target: SSD and **8 GiB installed RAM**, not 8 GiB free. RAM use is bounded by active work, never proportional to archive size. Offline login, four sections and active-course operation must remain possible.

A successful **local save** means a durable atomic local commit; **independently protected** means primary and independently operated recovery domain both verified. These statuses must never be conflated. When offline and local durable space is exhausted, a new write must not be falsely acknowledged. Previously committed data remains intact; MedControl automatically retries or provisions when connectivity returns. No medical history is silently erased.

## 2. Fixed topology and trust boundaries

```text
Medical UI (Input / Medication / Dashboard / Archive)
           | versioned Vault API; no storage-specific UI code
           v
Local coordinator (one fenced writer per vault/device)
           | AES-GCM encryption + HMAC index/manifest commitments
           v
LOCAL ATOMIC STORE (IndexedDB transaction)
  events | positions | opaque tokens | immutable segments
  authenticated manifests | generation head | replica intents
           |
           v
Encrypted outbox / resumable transfer (idempotency key)
           |
           v
MANAGED PRIMARY ARCHIVE (service-operated, encrypted objects)
  immutable segment objects + manifest objects + conditional vault head
           |
           +----> independent recovery domain (different failure boundary)
           |
           v
Verified dual-domain receipt + authenticated recovery catalog
```

Client retains encryption keys; service sees ciphertext, bounded routing metadata and opaque identifiers only. Backend authorization isolates vaults and prevents unauthorized reads, writes or replay. The managed primary and recovery domain are **separate failure domains**, not two folders in one IndexedDB database. A coordination service serializes cross-device head advancement; browser Web Locks alone are not cross-device fencing.

## 3. One versioned Vault API

`openVault(vaultId, credentials) -> session`; `append(events, idempotencyKey) -> {localReceipt, protectionState}`; `getByPosition(position)`; `queryIndex({opaqueToken, cursor, limit})`; `getArchivePage(cursor,limit)`; `sync({workBudget})`; `getProtectionStatus()`; `restore({authenticatedCheckpoint})`; `migrateFromLegacy({readOnlySource})`.

Each call has a bounded work budget, explicit error classification, and cancellable/resumable progress. No public method silently truncates a result. `append` may return a **local** receipt while remote protection is pending, but must never describe that receipt as independently backed up. A remote receipt is attached only after both storage domains have been read back and verified.

## 4. Data formats, identities and cryptography

Event: `{vaultId, eventId, logicalSequence, type, timestamp, schemaVersion, keyVersion, ciphertext, nonce, opaqueIndexTokens}`. `eventId` is stable across retries; `logicalSequence` is monotonically assigned under the writer fence; timestamps never substitute for ordering. Corrections append a new event referencing the original; historical facts remain immutable.

AEAD associated data binds `vaultId, eventId, type, schemaVersion, keyVersion` and, in the final wire format, sequence. The per-vault key hierarchy separates event encryption, index-token derivation, manifest authentication and key-wrapping. Nonces must be unique under their encryption key. Key material never enters logs, indexes or the storage provider. Key rotation is versioned and does not require deleting earlier encrypted events. Device-loss recovery requires an independently specified and security-reviewed client-controlled recovery envelope; **this protocol is not yet implemented**.

Immutable segment: bounded contiguous sequence range, <=1,024 events and <=64 MiB canonical encoded payload; content commitment plus authenticated tag. Manifest: generation, predecessor commitment, ordered segment descriptors, event range, schema/key versions and authenticated commitment. Global head: generation, commitment, last sequence and fencing epoch. All identifiers are namespace-scoped to the vault.

## 5. Atomic local write protocol

**Prepare:** validate schema and idempotency key; calculate bounded batch; obtain a local writer lock; encrypt outside the IndexedDB write transaction; create and authenticate segments and manifest; request a capacity reservation for *actual serialized bytes plus index and transactional overhead*.

**Commit:** open exactly one readwrite transaction spanning `events, positions, tokens, segments, manifests, heads, replicaJobs`; compare the predecessor head/fence; reject duplicate event IDs and inconsistent positions; insert immutable ciphertext, indexes, segments, manifest and durable outbox intent; advance head; commit.

**Acknowledge:** return `LOCAL_DURABLE` only after the transaction completes. Any exception, quota error, browser termination or constraint conflict must leave no partially published generation. After ambiguous termination, query idempotency key and authenticated head before retrying; never create a second medical event.

**Recovery:** use the atomic outbox intents as the authoritative source of work; resume by generation cursor and bounded pages. Reconstruct indexes only from authenticated immutable events. No unbounded scan on startup.

The existing isolated `js/modular3-t046-unified-store.js` is the candidate implementation for the local transaction, **not yet the production Vault API**.

## 6. Managed archive and cross-device consistency

Primary object API:
- `putImmutable(vaultId, commitment, ciphertext) -> receipt`: create-if-absent; same commitment with different bytes is a hard error.
- `getImmutable(vaultId, commitment, byteRange?)`: authenticated retrieval.
- `compareAndSwapHead(vaultId, expectedGeneration, expectedCommitment, fencingEpoch, newHead)`: atomic conditional update.
- `getHead(vaultId)`, `listRecoveryCheckpoints(vaultId,cursor,limit)`.

Coordinator issues monotonically increasing fencing epochs, checks access and idempotency, rejects stale devices and publishes a generation only after referenced objects are durable. Concurrent devices never independently assign the same global sequence. Offline devices append to a **local pending branch of intents**, not a falsely finalized global head; reconciliation assigns canonical sequence while preserving each event identity and user-visible medical fact. Conflicts require deterministic domain rules or explicit user action; no last-writer-wins deletion of history.

Independent recovery domain stores the authenticated ciphertext objects, manifests and a recovery checkpoint in a separate operational failure boundary. Receipt state machine:
`LOCAL_DURABLE -> PRIMARY_VERIFIED -> DUAL_VERIFIED`; on failure `RETRY_PENDING` or `RECOVERY_REQUIRED`, never an invented success. A verified checkpoint includes exact generation, commitment, event count/range, object inventory and independent-domain readback evidence.

## 7. Automatic capacity service: exact control loop

A service-owned capacity controller maintains per-vault `requiredBytes, committedBytes, reservedBytes, replicationBytes, recoveryReserveBytes, growthForecastBytes`. It measures actual ciphertext and index amplification, monitors primary **and** independent-domain headroom, forecasts incoming growth, and provisions storage shards before high-watermark admission. New shard allocation, placement, retries, alerts, balancing and billing are internal operator responsibilities; none are delegated to the patient.

`reserve(vaultId, generation, serializedBytes, indexBytes, twoDomainReplicaBytes, transactionPeakBytes, forecastWindow) -> signedReservation` must confirm independently available resources and an expiry/fence. Reservations are idempotent and bound to the generation. Commit admission rejects an absent, expired or insufficient reservation; a successful local save remains separately identified from remote protection. The controller maintains safe headroom for compaction, migration and restoration. It never purges the only recoverable encrypted copy. Browser quota estimates are **advisory**, not proof of allocated capacity.

Shard mapping is stable and extensible: `vaultId + segment commitment -> placement map`; no per-vault or per-device hard cap on number of shards. A 500M-event vault consists of many independently retrievable immutable segments. On-device cache contains active courses, required schedule windows and bounded archive pages; eviction is allowed **only for verified remotely recoverable cache copies**, never the last valid medical record.

The 10k-event measured IndexedDB samples (approximately 713/1009/1537 logical bytes per event for 0/1/4 tokens) are **sizing inputs, not capacity certification**. Capacity admission uses actual measurements, indexed overhead, replicated bytes and measured recovery peaks, not a fabricated universal byte multiplier.

## 8. Failure and recovery matrix

| Failure | Required behavior |
| --- | --- |
| Browser closes before transaction completion | No local success receipt; resume by idempotency lookup |
| Quota exhausted before/during local commit | Abort entire generation; preserve all earlier records |
| Two tabs race | One fenced writer succeeds; stale transaction aborts |
| Two devices race | Backend CAS/fencing rejects stale global head; reconcile without deleting events |
| Network outage | Local durable queue and active schedules continue within actual local capacity; automatic resume |
| Primary archive outage | Preserve local outbox; use recovery domain for authenticated reads when authorized |
| Recovery-domain outage | Do not report dual verification; retry independently |
| Tampered ciphertext, segment or manifest | Fail closed; recover from verified independent copy |
| Device loss | Restore encrypted archive with client-controlled key-recovery protocol |
| App/schema upgrade | Copy-on-write migration, verify counts and commitments, atomic activation, rollback checkpoint |
| Low RAM | Bounded segment batches, paginated indexes, foreground-priority work, no full-archive load |
| Full reset explicitly confirmed | Apply separate approved reset semantics; ordinary resource management never deletes medical history |

## 9. Compatibility and activation gates

Do **not** switch existing Modular-3 users to the new store merely because isolated Playwright tests pass. First implement an adapter behind the versioned Vault API; copy a disposable legacy vault into a new isolated store; compare all courses, event identities, corrections, timestamps and Archive entries; verify offline login and all four sections; exercise crash recovery and rollback. Existing source remains read-only during migration. Activation uses a verified atomic pointer switch; source recovery copy remains available until independent restoration passes. Real medical data is not touched during architectural development.

## 10. Acceptance and release decision

A01 architecture is **specified as one system** by this document. A01 implementation is **NOT READY** until:
1. Local Vault API, idempotency, encrypted index reads and atomic outbox are integrated and fault-injection tested.
2. Managed primary archive, global CAS/fencing, independent recovery domain and automatic capacity provisioning are actually implemented and operated.
3. Client-controlled device-loss key recovery and authorization are security-reviewed and tested.
4. Existing Modular-3 data migration, offline workflows, all four sections, concurrent devices and recovery are proven without medical-data loss.
5. **500,000,000 distinct real encrypted events** are durably written, counted, randomly read, authenticated and restored across the managed archive and independent recovery domain; memory, latency, disk, quota, reserve and operational cost evidence is recorded.
6. The product owner explicitly accepts the measured result.

No isolated green CI run substitutes for these gates. No deployment, purchase, production modification or medical-data migration is authorized by this architecture document.

## 11. Implementation mapping and one integrated execution order

- **Already present as isolated components:** encrypted journal; segment codec; authenticated commitments; manifest/head; replica intent queue; bounded resource governor; unified local IndexedDB transaction; selected Playwright regressions.
- **Missing system interfaces:** versioned Vault API adapter and safe legacy migration; primary archive service and object receipts; independent recovery adapter; cross-device CAS/fencing; operator capacity controller with real provisioning; key-recovery mechanism; full-system fault injection; measured 500M acceptance.
- **One delivery sequence, not separate product architectures:** (a) finish Vault API and safe disposable migration, (b) implement primary + independent archive and global coordinator as a coherent service, (c) attach capacity provisioning and recovery protocol, (d) execute integrated fault, offline, migration and 500M acceptance, (e) request owner approval.

**Stop rule:** no additional isolated helper modules or CI-only patches unless required to make one of these system interfaces operational. Each implementation change must demonstrably close an end-to-end gap.
