# T-046 — independent durable replica acceptance contract (draft)

Status: **not approved; not connected to production**. Applies to the experimental 500,000,000-event design only.

## Failure domains and custody
The IndexedDB primary and another object store, directory, browser profile, or partition on the same device are **not independent backups**. A replica qualifies only when its loss and availability are not tied to loss of the primary device, browser profile, filesystem, account session, or local power. A remote service is a candidate only after its operator, retention, funding, key custody, recovery access, and offline policy have been established and tested. No external provider is selected or enabled by this document.

## Write acknowledgement protocol
1. Encrypt each event locally with a unique nonce and authenticated encryption. Never upload plaintext medical content or raw keys.
2. Construct a content-addressed immutable segment, authenticated manifest, and monotonic generation. Bind all authenticated metadata to the vault ID and protocol version.
3. Commit the primary atomically and verify the resulting head. Distinguish **local durability confirmed** from **independent replica confirmed** in internal state; never conflate the two.
4. Upload ciphertext segments first to the independent replica, verify content integrity and authentication, then upload the manifest, then conditionally advance the replica head using the expected generation. An acknowledgement requires read-after-write verification of the new head and referenced objects, not merely an HTTP success code.
5. On offline/unavailable replica: keep confirmed local records, queue bounded retry work with backpressure, and report the true protection state. Do not silently discard history, automatically reset, or falsely claim independent backup. The product must not silently block medically necessary local use solely because the network is absent.
6. When local capacity cannot safely accept another event, reject **before** reporting successful recording, preserve previously confirmed history, and expose an actionable recovery status. Automatic provisioning may occur only against an approved, funded and operational provider.

## Recovery
- Authenticate and validate the replica head, generation chain, manifest, each segment and its ciphertext authentication before exposing restored data.
- Never overwrite a verified newer local generation with an older replica. Forks, gaps, revoked keys, lost keys, and mismatched vault IDs are fail-closed incidents requiring a defined recovery procedure.
- Recovery must be restartable, bounded-memory, and idempotent; copy only verified immutable objects, then atomically publish a verified head.
- Never delete the sole valid copy, including during reset races. A user-confirmed full reset has its own explicit destructive protocol and must not be conflated with routine garbage collection.

## Required acceptance tests before approval
- Simulated complete primary-device loss and recovery from a genuinely separate failure domain, with authenticated key recovery.
- Interrupted upload at each phase; stale and competing writers; replica fork; corrupted and missing segments; replay; wrong vault and wrong key; revoked credentials.
- Offline operation for extended periods; reconnect and catch-up; storage exhaustion; quota changes; provider outage; payment or service termination; automatic capacity expansion.
- Sustained representative 500M-event storage and indexed retrieval under bounded RAM on an 8GB-installed machine with other applications active, with measured latency, disk usage, cost, and recovery time.
- Long-running durability, backup retention, disaster recovery, and recovery drills across device replacement and software upgrades.

## Open approval blockers
- Independent provider(s), geographic and legal data residency, funding and service continuity.
- Key derivation, escrow/recovery, revocation, rotation, and user-controlled recovery guarantees.
- Realistic total storage and bandwidth for 500M encrypted events; per-device feasibility and a resource-allocation policy.
- Tested local/remote acknowledgement semantics and privacy-preserving synchronization.

**No 500M-event guarantee or commercial-readiness claim is justified until these blockers are resolved and the acceptance tests pass.**
