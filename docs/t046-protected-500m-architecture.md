# T-046 — Protected 500-million-event storage architecture (design baseline)

Status: ARCHITECTURE SPECIFIED; NOT IMPLEMENTED OR CAPACITY-CERTIFIED.
Scope: modular-3.000 only. No changes to the Modular-2 baseline, approved Russian locale, production, Supabase, or existing medical records.

## Product contract
- The user performs medical actions, never manual storage administration.
- Target: at least 500,000,000 durable, encrypted medical events per personal logical vault; no arbitrary lifetime/course/event caps.
- Resource-aware execution on phones and PCs; no minimum 8 GB RAM/SSD requirement.
- Active courses and required schedules remain usable offline. Every acknowledged medical write must be durable and recoverable.
- No compulsory third-party account, external-storage setup, subscription, manual cleanup, or silent loss of records.
- Capacity is a verifiable acceptance requirement, not a claim of physically unlimited storage on every device. No implementation may claim universal capacity before proving a viable capacity-provisioning mechanism, including for devices with insufficient local space. This is an unresolved feasibility gate, not delegated to the user.

## Roles and boundaries
1. Vault coordinator: schedules bounded tasks, prioritizes medical writes, owns a single-writer lease/fencing token per vault.
2. Event journal: immutable encrypted append-only event envelopes with unique IDs, monotonically ordered logical sequence, authenticated metadata and correction-as-new-event semantics.
3. Crypto: per-vault key hierarchy, AEAD authenticated encryption, unique nonces, explicit format/key versions; no plaintext medical data in indexes or logs.
4. Indexer: privacy-preserving token/time/course indexes updated atomically with journal commits, rebuilt from authenticated journal after damage.
5. Segment manager: partitions events into bounded independently verifiable segments; manifest records ranges, hashes, versions and state.
6. Resource governor: bounded batches, backpressure, adaptive scheduling and cache; memory use must not grow with total event count.
7. Recovery manager: transactional manifest transitions, restart-safe replay, checksum/AEAD verification, interrupted migration recovery.
8. Auditor: checks journal-index consistency, duplicate IDs, missing ranges, write acknowledgments and restoration without modifying medical facts.

## Write protocol
Validate -> obtain fenced write lease -> assign id/sequence -> encrypt/authenticate -> atomically commit event, index entries, and commit marker -> verify transaction completion -> acknowledge to UI. Never acknowledge before durable commit. On ambiguous completion, resolve by idempotency key, not duplicate the medical event. Corrections append an event and preserve prior history.

## Read and archive protocol
Read only bounded index pages; decrypt only requested records. Active-course queries never scan the entire archive. Background segment compaction may reorganize encrypted physical representation, but must preserve every logical event and correction. Old copies may be discarded only after the replacement is durably verified and recoverable; never discard the sole valid copy during a transition. Any storage tiering must be automatic and invisible in ordinary operation.

## Compatibility and migration
Existing protected vault is read-only to the migration source. Copy -> authenticate/verify all counts and event identities -> atomically activate new manifest -> retain recovery path until verified. Do not change existing patient data in place. Keep offline access and all four sections functional.

## Non-negotiable feasibility boundary
500M events consume nonzero physical storage; finite devices have variable capacity. Role scheduling, encryption and compression alone cannot guarantee storage of 500M distinct events on *every* device without capacity provisioning. This requirement remains an open engineering gate. No claim of unconditional 500M capacity or universal offline retention may be made until implementation and physical resource evidence establish it. Do not shift capacity management to the user, silently delete data, or misrepresent a failed write as saved.

## Acceptance tests (required before status READY)
A. Real encrypted medical events (not synthetic ciphertext labels), authenticated on read.
B. Journal/index atomicity, stale-writer rejection, concurrent tabs, idempotent retry, correction history.
C. Crash/power-loss/restart at every commit and manifest transition; no acknowledged loss.
D. Offline login, four sections, active course actions and archive history.
E. Adaptive bounded RAM and latency on representative low-memory phone and PC profiles.
F. 500M unique encrypted events, exact count and range verification, random indexed reads, restart/recovery and sustained writes; capture bytes/event and storage capacity.
G. Migration of existing vault without source modification and verified restoration.
H. Explicit test of insufficient-capacity devices; no fake success and no unapproved data deletion. The universal-device capacity guarantee cannot pass until an automatic provisioned solution exists.

## Immediate implementation sequence
1. Implement append-only authenticated event journal and atomic index protocol in isolated T-046 storage, without connecting existing medical data.
2. Add deterministic failure-injection, bounded-memory and recovery tests.
3. Implement and verify migration adapter; connect only after all safety gates pass.
4. Run progressively larger *real encrypted* scale tests, culminating in 500M; do not substitute the current synthetic D-drive probe for acceptance.
