# T-046 — Immutable encrypted segments and manifest, protocol v0 (design)

Status: DESIGN CANDIDATE; not approved, integrated, or capacity-certified.
Branch: modular-3.000 only. Existing protected medical vault remains untouched.
Dependencies: docs/t046-protected-500m-architecture.md and docs/t046-automatic-capacity-orchestrator.md.

## 1. Data model and invariants
- Every medical action is an immutable event with stable event_id, vault_id, course_id, event_type, logical_sequence, occurred_at, recorded_at, schema_version, correction_of (nullable), and encrypted medical payload.
- Corrections are new events. No update or replacement of an acknowledged event.
- Unique event_id and idempotency_key within a vault; a retried operation returns the original committed result rather than writing a duplicate.
- Sequence assignment must be serialized/fenced across concurrent writers. Never rely on wall-clock timestamps for uniqueness or ordering.
- Medical plaintext and identifying metadata are authenticated and encrypted on the client; storage providers see only opaque vault/object identifiers and encrypted blobs.
- Encryption uses versioned AEAD with unique nonces. Key identifiers are opaque and do not expose the key. No nonce reuse under the same key.
- Every committed event must be reachable through a verified manifest and a recoverable canonical copy before archival cache eviction.
- No bounded-page query loads the complete archive into RAM.

## 2. Immutable segment object
Logical schema (field names and binary encoding are provisional):
{
  format: "mc.segment",
  version: 1,
  opaque_vault_id: <random opaque identifier>,
  segment_id: <content-addressed opaque identifier>,
  generation: <monotonic manifest generation>,
  first_sequence: <integer>,
  last_sequence: <integer>,
  event_count: <integer>,
  encryption_version: <integer>,
  key_epoch: <integer>,
  encrypted_event_frames: <bounded sequence of length-prefixed AEAD envelopes>,
  frame_index: <bounded offsets or encrypted searchable index>,
  integrity: <authenticated segment commitment>
}

Requirements:
- Frames carry authenticated event IDs, logical sequence, type and timestamps inside ciphertext; the outer index must not leak medical content.
- Frame boundaries are validated before decryption to prevent unbounded allocation and malformed-length attacks.
- The segment commitment covers header, frame order, index version, count, sequence range, and ciphertext bytes. Segment identity is deterministic from canonical serialized ciphertext bytes, never from untrusted external metadata.
- Segments are immutable after publication. A new generation references new segments; it does not overwrite an earlier generation in place.
- Segment sizing is adaptive but has a hard maximum allocation/batch bound derived from device memory, not a hard limit on lifetime event count.
- The maximum sequence must use an integer representation that supports at least 500M events safely; JS safe integer range suffices for this target, but format must allow future extension.

## 3. Versioned manifest
{
  format: "mc.manifest",
  version: 1,
  opaque_vault_id: <opaque>,
  generation: <monotonic>,
  predecessor_commitment: <authenticated hash of previous manifest>,
  committed_through_sequence: <integer>,
  segment_descriptors: <paged immutable descriptor tree root>,
  index_root: <authenticated paged index root>,
  canonical_replication_state: <verified durable generation>,
  recovery_replication_state: <verified independent durable generation>,
  key_epoch: <integer>,
  manifest_commitment: <authenticated hash or signature>
}

Manifest must not enumerate 500M events in a single in-memory object. It references a paged tree of segment descriptors and index pages. Each descriptor contains segment id, sequence range, event count, size, integrity commitment, format version and verified location identifiers. No plaintext medicine names, diagnoses, or patient identifiers.

## 4. Commit state machine
LOCAL_PREPARED -> LOCAL_COMMITTED -> UPLOAD_PENDING -> CANONICAL_DURABLE -> RECOVERY_DURABLE -> MANIFEST_PUBLISHED -> CACHE_ELIGIBLE.

Transitions are monotonic and idempotent. The local journal persists event_id, idempotency_key and the last durable transition. The manifest generation is published with compare-and-swap and a fencing token. Rejected stale writers reload the manifest and reconcile, never overwrite history. Acknowledging a local write is distinct from asserting remote recovery durability.

## 5. Recovery protocol
- Restart reads the last authenticated committed manifest, then replays pending local transitions by idempotency key.
- Unreferenced uploaded segments are treated as provisional; they may be reclaimed only after verified absence of any committed manifest reference and retention/recovery policy checks.
- Missing or damaged derived indexes are rebuilt from authenticated immutable segments.
- Missing canonical segments are restored from independently verified recovery copies, without rewriting medical event identities.
- If both copies are unavailable, the system must not invent data or report success. Preserve the last verified state and record the failure.
- Interrupted copy/migration never deletes the only verified source.

## 6. Bounded resource algorithm
The resource governor determines per-operation page size and segment target from measured free memory, write latency and browser/storage quota. It never materializes all events, all segment descriptors or the full index. Foreground medical writes outrank compaction. Adaptive changes must not change event IDs, sequence, encryption guarantees or correctness.

The archive capacity target is 500,000,000 events; there is no arbitrary software lifetime cap. Segment count and index tree depth grow with events. Provisioned physical storage and independent copies must be demonstrated separately.

## 7. Sizing calculation to complete from measured samples
Let N=500,000,000; E=measured mean encrypted bytes/event; I=measured mean index bytes/event; S=segment and manifest amortized bytes/event; R=independent durable replica factor; H=migration and failure-recovery headroom.

Required durable physical bytes >= N * (E + I + S) * R + H.
Also measure P95/P99 event sizes and worst-case admissible payloads. A mean-only capacity plan is insufficient. JSON serialized length is not equivalent to IndexedDB on-disk bytes; compare with measured browser profile usage. Do not treat 60 sample events as a statistically representative workload.

## 8. Required verification before architecture approval
1. Actual event schema mapped from existing MedControl, without editing the Russian reference or medical data.
2. Cryptographic framing, nonce strategy, authentication and index privacy reviewed.
3. Atomicity and recovery at every state transition, stale writer, duplicate retry, damaged segment and damaged index.
4. Bounded RAM and indexed query latency on low-resource devices.
5. Measured physical bytes/event, replica amplification, and realistic provider capacity plan.
6. Demonstrated 500M real encrypted events with integrity, random reads and full recovery.
7. Device-independent capacity and offline constraints resolved without assigning storage administration to users.

Status remains OPEN. This protocol defines how to build segments/manifests; it does not resolve the physical-capacity contradiction and does not certify T-046.
