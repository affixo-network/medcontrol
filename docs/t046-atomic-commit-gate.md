# T-046 atomic commit gate (isolated prototype)

Status: design and test gate only. No production integration.

An IndexedDB transaction must atomically write an immutable encrypted segment, its manifest generation, and the current-head pointer. A rejected or aborted transaction must leave all three unchanged.

Preconditions: authenticate the segment and manifest; require the new manifest to reference the segment; require the previous manifest to be verified; reject gaps, overlaps, mismatched vault IDs, duplicate event IDs and stale generations. A plain SHA-256 digest alone is not an authenticity guarantee.

Concurrent writers: compare the expected head inside the same readwrite transaction, not in an earlier read transaction. Never acknowledge success before transaction completion.

Recovery: reopen the database after simulated interruption; check the head, manifest, referenced segments and complete sequence range. Reject a head whose referenced objects are missing. Preserve the last verified generation.

Required isolated tests: successful commit; duplicate retry; two competing writers; stale writer; transaction abort; interrupted reopen; missing referenced segment; corrupted manifest; segment from another vault; generation gap. No live medical records may be used.

This gate does not solve physical capacity, independent recovery copies, browser eviction, or 500-million-event verification.
