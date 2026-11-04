# T-046 — automatic capacity orchestration: engineering design candidate

Status: CANDIDATE ONLY. Not approved, implemented, tested or commercially guaranteed.
Scope: affixo-network/medcontrol, modular-3.000. No modification to production, legacy vault, Supabase, patient records, Modular-2 or approved locales.

## Objective and non-delegation
The user performs medical actions only. MedControl owns automatic capacity provisioning, encryption, placement, resource scheduling, integrity checking, archival, recovery, and ordinary synchronization. The user must not be instructed to clean up device storage, select a provider, manage backups, or purchase a storage subscription to operate the product.

The personal logical vault targets 500,000,000 recoverable, distinct encrypted medical events. This is not a claim that a small phone can physically store all 500M locally. Full device-independent logical capacity needs MedControl-operated durable infrastructure; any proposal without it cannot satisfy the requirement.

## Proposed physical layout
1. Local encrypted active set: active courses, current schedule, critical metadata, recent history and a bounded offline write journal. Indexes are scoped to the active set.
2. Durable canonical event archive managed by MedControl: append-only authenticated encrypted event segments and privacy-preserving indexes. Medical plaintext never leaves the client. A server must not require decryption keys to store or retrieve segments.
3. Independent recovery copy: separately fault-isolated encrypted segments, versioned manifests and recovery checkpoints. A copy in the same device/browser profile is not an independent backup.
4. Local read-through cache: verified encrypted pages of historical events, evictable only after durable canonical and recovery copies have been verified. Cache eviction must never delete the sole valid copy.
5. Manifest: vault ID, monotonic journal sequence, segment ranges, content hashes, authenticated format/key versions, index generation, replication acknowledgments and recovery state. Manifest updates use compare-and-swap/fencing and immutable generations.

## Client-side components and responsibilities
- Medical UI: no storage management controls or infrastructure jargon.
- Admission controller: ensures idempotency keys, ordered writes, durable local commit before acknowledgement.
- Vault coordinator: one active writer per vault; fencing generation protects against stale tabs/devices.
- Crypto worker: AEAD encrypts each event; derives domain-separated encryption and HMAC index keys from the vault key hierarchy. Unique IV/nonce per encryption; keys never sent to storage services.
- Resource governor: adaptive bounded pages/batches, limited concurrent work, foreground write priority, no full-history materialization.
- Segment builder: immutable bounded-size encrypted segments, per-event IDs and authenticated content; manifests and segment hashes checked before publish.
- Replication coordinator: sends encrypted segments, verifies canonical and independent recovery durability, advances manifest, then marks upload complete.
- Retrieval coordinator: indexed range queries, verifies segment authenticity and decrypts only requested events.
- Recovery coordinator: resumes interrupted uploads, deduplicates retried writes, reconciles manifest generations and rebuilds derived indexes without altering the immutable event log.
- Capacity planner: forecasts storage growth, reserves provider-managed capacity, scales shards and replicas before exhaustion; never asks the patient to allocate storage.

## Commit state machine
LOCAL_PREPARED -> LOCAL_COMMITTED -> UPLOAD_PENDING -> CANONICAL_DURABLE -> RECOVERY_DURABLE -> MANIFEST_PUBLISHED -> CACHE_ELIGIBLE.

Only LOCAL_COMMITTED may be acknowledged as an offline *local* write. Acknowledgement of globally protected/replicated archival status requires RECOVERY_DURABLE and MANIFEST_PUBLISHED. Do not conflate these guarantees. Never discard a local event until it is recoverable from verified durable independent copies.

On offline device restart, the encrypted local journal is replayed idempotently. Once connectivity returns, background replication resumes automatically. No automatic deletion of medical history, and no user-initiated technical workflow.

## Privacy, isolation and durability
Per-vault encryption keys, domain-separated index keys, authenticated event IDs and course references. No patient identifiers in storage object paths or plaintext telemetry. Separate logical tenants and explicit authorization checks on every archive read/write. Replicas must be failure-domain independent; periodically verify recovery by restoring sample segments and checking hashes/AEAD. Key recovery design must be specified and independently tested before claiming device-loss recovery. Never claim 'end-to-end encrypted' without verifying that infrastructure cannot access plaintext or keys.

## Resource accounting
500M * measured encrypted bytes/event + index amplification + manifest overhead + replication factor + migration headroom. Reserve capacity automatically at the MedControl service layer, with monitoring of durable object count, bytes, failure rates and restoration integrity. The 500M logical target is an architectural sizing requirement, not evidence of actual provider capacity or financing. Provider operating cost is a product responsibility; the project has not authorized paid services or production changes.

## Exact offline boundary
Finite local storage cannot guarantee an unlimited number of new writes while disconnected. Offline medical actions must be designed around a bounded encrypted local journal and resource reservation. A universal 'any device, 500M writes while indefinitely offline with no free space' guarantee is impossible. This remains an explicit product-contract conflict. No storage coordinator can remove it by scheduling. Do not silently weaken the owner's requirement.

## Architecture acceptance blockers
A. Product owner requirement 'no compulsory external service' must be distinguished from 'no external service management by the user'. This candidate uses provider-operated infrastructure and therefore is NOT a fully local-only solution.
B. A MedControl-operated durable capacity service and its failure domains, access controls, encryption/key recovery, provisioning and operating budget are not implemented or authorized.
C. No proven offline minimum available space exists for all devices; universal unlimited offline writes cannot be certified.
D. No measured real encrypted event size or demonstrated 500M-event throughput, indexed retrieval and full recovery.
E. Existing journal is isolated and lacks production migration, replica coordinator, manifest and recovery.
F. No end-to-end verification of patient data preservation and all four sections.

## Proposed implementation sequence (not permission to deploy)
1. Model real encrypted event schema and measure byte budget, bounded memory and index amplification in isolated fixtures.
2. Specify segment/manifest format, deterministic idempotency and state machine, including crash points.
3. Build isolated local segment manager and recovery fault-injection tests without touching legacy data.
4. Design provider-operated storage interface with an in-memory or filesystem test double; no real cloud connection.
5. Verify automatic replication, recovery, integrity and bounded offline behavior against fault-injection.
6. Obtain explicit approval before any infrastructure cost, Supabase changes, deployment or migration.
7. Test realistic capacity and recovery progressively; certify 500M only after measured full-system proof.

## Decision status
This design removes storage administration from the user but does NOT resolve the universal finite-device/offline-capacity contradiction. It is a candidate for engineering evaluation, not a completed architecture and not eligible for approval as an unconditional guarantee.
