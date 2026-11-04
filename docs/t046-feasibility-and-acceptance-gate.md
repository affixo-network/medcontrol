# T-046 — feasibility proof and architecture acceptance gate

Status: OPEN / NOT APPROVED. This document records a design blocker, not a request for user administration or a relaxation of the 500M goal.
Branch: modular-3.000. No production, patient data, or Modular-2 changes.

## Contract as stated by product owner
1. At least 500,000,000 distinct, authentic, recoverable encrypted medical events per personal vault.
2. Any device, including phones, regardless of its free persistent capacity.
3. No mandatory external storage, third-party service, subscription, manual cleanup, device upgrade or other storage organization by the user.
4. Automatic allocation, indexing, encryption, recovery, and bounded RAM.
5. Offline active-course operations and preservation of all historical medical events.
6. No false success, data destruction or hidden capacity truncation.

## Feasibility theorem
The complete set above has no implementable solution under finite local storage and no other persistent resource.

Proof: Consider a supported device with zero bytes available for additional persistent application data, or with less space than one authenticated event. Choose two possible distinct future medical events that must remain independently recoverable. The device has the same persistent storage state after both if no external persistent resource is permitted. A recovery algorithm cannot distinguish which event was entered. Hence it cannot recover both correctly. This contradicts (1), (2), (3), and (5). Encryption, compression, sharding, deduplication, caching, scheduling and role assignment cannot create distinguishable durable states without persistent capacity. The contradiction already holds for one additional event; 500M makes it larger.

For a stronger information-theoretic statement, n independent events with b bits of irreducible information have 2^(n*b) possible histories, requiring at least n*b bits of distinguishable durable state somewhere, excluding indexes, encryption overhead and redundancy. No lossless encoding can guarantee compression of all possible histories below this bound.

## Concrete capacity envelope (not a measurement)
500,000,000 events x 256 B = 128,000,000,000 B (~119.2 GiB).
500,000,000 events x 512 B = 256,000,000,000 B (~238.4 GiB).
500,000,000 events x 1024 B = 512,000,000,000 B (~476.8 GiB).
These are illustrative average physical event sizes; real encrypted event size, indexes, integrity manifests, temporary migration space and independent recovery copies must be measured and added. Never use these scenarios as certified production capacity.

## Architecture options and exact guarantees
A. Strict local-only / no outside capacity:
   Automatic resource governor, encrypted immutable segments, atomic indexes, bounded memory, lossless compaction and recovery. Can guarantee correctness and no arbitrary *software* event cap within physical limits. CANNOT guarantee 500M on every device.
B. Provider-operated transparent managed capacity:
   The product, not the user, provisions and manages encrypted storage and independent recovery copies; client retains offline working set and sync journal. Could support a 500M *logical* vault regardless of phone capacity when service is available, subject to a sustainable capacity guarantee, key custody, recovery, connectivity and operating cost. CANNOT guarantee unlimited offline writes on a full device, or zero external infrastructure.
C. Hybrid provider-managed capacity plus bounded offline journal:
   Same as B with explicit preallocated offline headroom. Can guarantee a defined offline write budget while reserved capacity remains. CANNOT guarantee indefinite offline write capacity on all devices.
D. Lossy compression, discarding history, pretending writes succeeded, requiring user to delete apps, or shifting storage setup to user: REJECTED.

## Design decision gate
Do not mark T-046 architecture approved or capacity READY while claiming all six contract clauses simultaneously. Engineering must either establish an additional durable capacity source supplied automatically by MedControl, or prove a different physically realizable mechanism. A code test cannot overturn the proof.

No silent reinterpretation: the product owner's requirements remain unchanged; this file explicitly identifies the conflicting subset rather than pretending an unimplemented subsystem solves it.

## Findings from repository inspection (2026-11-04)
- js/modular3-t046-journal.js: isolated AES-GCM event journal with atomic event/token index and append-only semantics; not a complete storage tier manager.
- js/modular3-indexed-events.js: experimental IndexedDB atomic indexed store; supports replacing envelopes, so it is not itself an immutable medical event history.
- tests/t046-windows-profile.spec.js: synthetic ciphertext placeholders, not real encrypted medical records; does not prove the product contract.
- docs/t046-protected-500m-architecture.md: preliminary design, explicitly states unresolved feasibility gate.
- The new journal test workflow is not evidence of 500M scale or automatic storage provisioning.

## Work allowed before architecture approval
- Analyze event schema and measure actual encrypted bytes/event and index amplification in isolated fixtures.
- Specify transaction/recovery invariants and audit failure modes without modifying real medical data.
- Evaluate device/browser storage guarantees and provider-managed alternatives without binding the user to a service.
- Do not execute multi-million synthetic tests as evidence of product readiness.
- Do not connect experimental stores to the existing medical vault until architecture and recovery gates are approved.
