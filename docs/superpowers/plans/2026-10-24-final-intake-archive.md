# Modular-3 final intake and immediate archive

Approved behavior: show the repeat-by-changing-dates hint BEFORE recording the
last scheduled Taken event. Cancellation writes nothing. Confirmation persists
the factual event, completed status, archive status and history in one verified
encrypted transaction, without a seven-day wait. Reuse the existing date editor
and retain all prior records. Archive permits history viewing and reset only. This is an explicitly requested
functional change after the Modular-2 transfer, confined to protected Modular-3.

- `modular3-final-intake.js` adds protected-only confirmation/transaction hooks,
  original date-editor navigation; Archive has no repeat/correction controls.
  Existing `input-qa-fixes.js` retains reconciliation and the repeat form; only
  protected mode skips the old seven-day delay.
- `auth-guard.js` installs those hooks after each page's layered handlers load.
- `storage.js` and `modular3-write-boundary.js` invoke the policy inside their
  existing transactions, preserving rollback and cancellation history.
- Reuse `modular3-course-lifecycle-browser.js` final-slot calculation with an
  optional active-time filter. Preserve weekday/date schedules and time scopes.
- No new branch, record deletion, Production, Supabase or Microsoft operations.

Verification: browser tests must first reproduce the missing prompt. Cover cancel,
date-editor choice, delayed encryption, storage failure/retry, immediate archive,
history, offline restart, nonfinal intake, actual final weekday/explicit date,
read-only Archive, archived-course repeat refusal and old data preservation. Run the
existing transfer/interface/startup/security suites, independent review, then
publish one functional commit on `modular-3.000` and verify CI/Preview.
