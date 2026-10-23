# Modular-3 complete interface transfer

Working branch: `modular-3.000`. Baseline: `f24413219947766a79b12250bf18f4c606a3b944`.

The protected entry now opens the existing Modular-2 Input, Intake, Dashboard and Archive implementation. It retains the original forms, scheduling rules, correction policy and course history. It does not use the separate rehearsal workspace as the application interface. `?rehearsal=1` explicitly selects that earlier workspace for isolated migration regressions.

## Persistence and startup

- The local password unlocks the vault before application modules render medical data. Protected startup does not create a cloud client or verify a cloud session.
- Existing write handlers and their wrappers await encrypted persistence before closing dialogs or refreshing the interface. Synchronous `saveState` still rejects protected writes.
- `saveStateAsync` compares changed state fields against their read baseline. A stale edit cannot replace a newer change, and unrelated encrypted draft updates are preserved.
- Automatic startup repairs run in order. Course reconciliation uses the session transaction queue and skips unchanged snapshots.
- Draft autosave coalesces rapid input and flushes before confirmation/navigation/logout. Creating a course clears its draft in the same encrypted transaction.
- A failed draft flush preserves Input; Logout still locks the vault. A new cycle retains the complete previous cycle in an encrypted backup.
- Static cache revision: `medcontrol-static-modular3-v14`. No medical records or credentials are stored in Cache Storage.

## Verification

All browser checks use isolated browser contexts and synthetic records. No live data or Production operations are involved.

| Suite | Passed |
| --- | ---: |
| `tests/modular3-complete-interface.cjs` — original UI, delayed encryption, write faults, offline restart, draft recovery, archived-course repeat refusal, immediate archive, reset and logout | 18 |
| `tests/modular3-transfer-e2e.cjs` — encrypted handoff and prior migration regressions | 28 |
| `playwright.modular3-transfer.config.cjs` — boundaries, migration, cryptographic primitives, static caching and existing-install import | 56 |
| Loader and auth integration Node tests | 9 |
| `tests/modular3-entry-startup.cjs` — interrupted dependency loading, persistent failure, visible login feedback | 13 |

Both temporal-guard checks and the Modular-2 interface/localization baseline also pass. The layout baseline allows only the protected version label to change; asynchronous medication handler changes are covered by the original-interface browser suite.

The `Modular-3 Encrypted Transfer E2E` workflow runs these suites on pushes to this branch. It neither deploys Production nor accesses Supabase.

## Next scope

The language catalogs remain RU and EN. The 95-language work follows transfer verification and is not part of this change. Production and its real user data remain outside the scope of these checks.

## Entry startup recovery

The entry page enables login controls only after all protected modules and their handlers have initialized. Missing modules are retried in dependency order without recreating an existing protected session. A persistent failure displays a retry button instead of reporting successful startup based only on Cache Storage. Login also distinguishes an empty password and a vault absent from the current origin; neither case creates or deletes data.

## Transfer when a protected test vault already exists

The original first-install importer still refuses an existing vault. The entry
form now offers a separate, explicit path for that situation. `Локальный пароль`
verifies the current vault; `Пароль файла переноса` decrypts the selected file.
The confirmation reports both sets of counts. Cancellation writes nothing and
locks the preview session, including after a previous successful import.

After confirmation, the complete previous encrypted vault and credential are
saved and read back under a unique `medcontrol_modular3_preserved_before_import_v1/`
key before the existing verified session transaction activates the imported state.
The local credential is unchanged. Unknown metadata and all source history arrays
are preserved. Storage failure or a stale preview cannot silently replace the
current data. An identical repeat import performs no writes.

The preserved copies are available as encrypted JSON downloads from the entry
page, without exposing medical contents. A downloaded previous copy can be
imported again with the password that originally protected it; restoration also
preserves the state it replaces. These copies are retained if activation fails.
They consume additional local storage; insufficient space aborts activation.

The existing-install browser scenarios include a synthetic 7-course/35-event transfer,
preservation and restoration of the prior vault, separate passwords, cancellation,
write faults, stale previews, repeat import, untouched plaintext source, malformed
input, and full-interface offline reopening. These synthetic checks cannot establish
that the user's actual local records were imported. The user subsequently supplied
the local comparison and offline confirmation recorded below.

## Verify a source file against an already populated vault

The Input page alone cannot establish that courses are absent: archived courses
are displayed separately. The user's confirmation showed eight local courses and
36 events versus seven courses and 35 events in the export. Do not infer a missing
transfer or activate an older file from those counts alone.

With a selected encrypted file and both passwords entered, `Проверить готовность
переноса` now performs a read-only comparison. Every source field is checked;
arrays preserve the source sequence, allowing additional local entries
and preserving duplicate cardinality. JSON object property order is irrelevant;
history order, including equal-timestamp status changes, must be retained. The
report lists matched source course/event counts, additional local counts, and the
number of top-level source fields whose contents differ. It makes no storage
writes, requests no activation confirmation, and locks the preview session afterward.

If every source field is already included, even the import action skips activation
and backup creation, reports the actual larger local counts, and retains all extras.
Equal counts with altered actual times or missing history/metadata do not pass.
The user must run this comparison locally: CI uses synthetic records and cannot
read the user's browser storage or their downloaded transfer file.

On an existing installation, checking without a selected transfer file now gives
an explicit file-selection instruction and focuses the file input. It does not
fall through to legacy initialization inspection (`protected_account_exists`).
The instruction explains that a page refresh clears the browser's file selection.


## Confirmed transfer and first approved behavior change

The user reported that read-only comparison matched all 7 source courses and all
35 source intake events, with zero differing file fields and one additional local
course/event. They also confirmed unlocking the existing vault and opening all
four sections, including Archive, without internet. This confirmation comes from
the user's browser; automated tests remain isolated and synthetic.

The first requested functional change after that transfer removes the seven-day
archive delay in protected Modular-3. Before the final scheduled Taken event is
recorded, a dialog explains how to repeat the medication by changing course dates.
Cancel/Escape writes nothing; Change dates opens the original editor under its
existing direct-edit policy. Confirmation uses the original Taken handler. The
same encrypted transaction saves the factual event, completion, archive status
and course history. A failed write leaves the dialog open for retry.

Archive permits viewing history and the existing explicit cycle reset only.
There are no repeat, date-edit or intake-correction actions in Archive. Changing
course dates remains available before the final Taken confirmation. The repeat
handler also refuses already archived courses. Previous course records and factual
intake history are retained.

`tests/modular3-final-intake.spec.js` adds 11 browser checks covering cancellation,
Escape, duplicate confirmation, actual date saving, delayed encryption, rollback
and retry, read-only Archive, archived-course repeat refusal, weekday and explicit-date schedules,
disabled times, offline confirmation and encrypted restart. The original Modular-2
branch, six baseline interface/core files and cloud services are unchanged.
