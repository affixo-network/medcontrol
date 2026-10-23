# Import into an existing protected MedControl installation

The empty-install import is working as designed but cannot transfer Modular-2
records into an installation that already contains the old Modular-3 rehearsal.
Do not remove that guard or ask the user to delete data or change browser profiles.

Design: after verifying both the existing local password and the transfer-file
password, show the incoming and existing counts for explicit confirmation. Save
the entire previous ciphertext and credential in an immutable local backup before
using the existing verified session transaction to activate the imported state.
Keep the current credential unchanged. Expose preserved backups as encrypted JSON
downloads compatible with the existing importer. Preserve every imported field.

Alternatives rejected: overwrite without backup (data loss); browser-profile
workaround (already failed for the user); merging clinical histories (ambiguous
identifiers and altered semantics). Existing first-install import stays unchanged.
The user explicitly instructed execution without further experiments or questions.

- [x] Add browser tests reproducing the blocked existing-install transfer.
- [x] Implement read-only preview, confirmed transactional activation, immutable
  encrypted backup, and encrypted backup download in `modular3-copy-migration.js`.
- [x] Connect the existing entry form with a separate file-password field,
  explicit counts/confirmation, success receipt, and preserved-backup download.
- [x] Verify wrong passwords, cancellation, malformed input, stale preview,
  storage faults, repeated imports, offline restart, and real four-page rendering.
- [ ] Local suites and independent review passed (95 browser checks); publish
  only on `modular-3.000`; verify CI and Preview commit. No live data/backend access.

Actual user data remain unverified until the user imports their file and the
reported seven courses, 35 intake events, history and archive are checked.

Follow-up evidence: the existing vault actually reports 8 courses/36 events and
shows seven archived source courses. Input-only visibility was insufficient to
infer missing records. Add read-only full-source inclusion comparison to the
existing readiness action, checking all source fields and duplicate cardinality;
skip activation if source records are already included, retaining local extras.
Verify exact matches, changed facts, missing metadata, object key order, duplicate
history and equal-timestamp chronology, read-only UI behavior and no-op import before publishing.
