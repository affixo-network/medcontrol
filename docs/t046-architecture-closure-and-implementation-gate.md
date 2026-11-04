# T-046 — architecture closure and implementation gate

Status: IMPLEMENTATION BASELINE PROPOSED; NOT PRODUCT-OWNER APPROVED; NOT CAPACITY CERTIFIED.
Branch: modular-3.000. This document does not authorize deployment, paid infrastructure, Supabase changes, production changes, medical-data migration or changes to Modular-2.

## Objective and stop rule
Deliver a personal logical vault supporting at least 500,000,000 distinct authenticated encrypted medical events, without arbitrary application event caps and without user-managed storage. Stop producing incremental architecture prototypes as a substitute for the integrated product. This document closes the choice of architecture pattern; implementation, real infrastructure and evidence remain open.

## Chosen candidate topology
1. Client: encrypted append-only journal, atomic privacy-preserving indexes, bounded offline queue, foreground-priority admission and automatic sync.
2. Canonical managed archive: immutable content-addressed encrypted segments and manifests, authenticated conditional generation head, per-vault authorization, automatic shard and capacity provisioning.
3. Independent recovery domain: separately operated/fault-isolated durable encrypted copy with verified restoration, retention, and operational monitoring.
4. Coordinator: single logical fenced writer per vault across devices, idempotent retry, conflict detection, monotonic generation and replay.
5. Key recovery: client-controlled cryptographic key hierarchy, rotation and device-loss recovery that does not expose plaintext or keys to storage providers. Specific key-recovery protocol is an unresolved security gate.
6. Capacity service: automatically forecast and reserve durable bytes for canonical plus independent recovery domains, indexes, migration headroom and write bursts; reserve before accepting a globally protected write. Service and budget are not provisioned.

## Safety invariants
- Never acknowledge a local write before a durable encrypted local commit.
- Never acknowledge independent protection before both domains and authenticated manifest/head readback are verified.
- Never evict the last independently recoverable copy.
- Immutable objects are keyed by authenticated commitment; same key with different bytes is rejected atomically.
- Conditional head updates are atomic and fenced in the durable backend; Web Locks alone do not provide cross-device exclusion.
- Acknowledged medical events and correction history are never silently truncated, replaced or deleted by resource management.
- A local full-capacity/offline condition cannot be solved by software alone. Preserve existing records, never report a failed new write as saved, and surface truthful status without transferring storage administration to the patient.

## Implementation work packages — no new architecture branches
I. Integrate the tested isolated journal, immutable segment/manifest protocol, queue and recovery state machine behind one versioned vault storage interface. Preserve the existing protected vault untouched.
II. Implement a durable provider-neutral archive adapter with atomic create-if-absent and head compare-and-swap, and an independent replica adapter. Simulators are for correctness only, not capacity proof.
III. Implement automatic capacity accounting, reservations, backpressure, encrypted range retrieval and bounded-memory cache eviction only after independent durability verification.
IV. Implement device-loss key recovery, authorization, revocation and cross-device fencing. Obtain security review before connecting patient data.
V. Run complete end-to-end migration and restore against disposable test vaults, then representative performance tests, and ultimately a measured 500M-event acceptance run against funded, operational, independent infrastructure.

## Final acceptance evidence (all mandatory)
- Real encrypted event bytes and physical storage/index amplification measured, including replication, retention and migration headroom.
- A provider-operated primary and genuinely independent recovery domain exist, are funded, monitored, and have verified access control, retention and restoration.
- 500M distinct encrypted events stored, counted, authenticated, randomly retrieved and restored with measured latency, RAM, disk usage, failure handling, recovery time and operating cost.
- Tests cover crash, power loss, offline and full local quota, provider outage, corrupt and missing objects, concurrent devices, key loss/rotation, upgrade and device replacement.
- Existing medical data preserved through migration; all four sections and offline login tested.
- No false success and no automatic destruction of medical history.
- Explicit owner approval after evidence; CI success of isolated prototypes is insufficient.

## Decision and physical feasibility
The user need not manage storage, accounts, backups or subscriptions. MedControl must manage infrastructure. However, zero free persistent capacity on a disconnected device cannot accept even one new durable event, and 500M independent events require nonzero physical capacity somewhere. This is a physical limitation, not a missing software optimization. No universal unconditional offline guarantee can be made without additional capacity. Do not silently redefine the owner's requirement or claim the blocker is solved.

## Next executable deliverable
Implement the unified versioned vault storage interface (work package I), reusing existing tested modules. Do not create another isolated micro-prototype merely to repeat concurrency/restart tests. Integration acceptance requires journal -> immutable segment -> replica queue -> authenticated manifest/head -> bounded read/recovery, all in a disposable vault with fault injection.
