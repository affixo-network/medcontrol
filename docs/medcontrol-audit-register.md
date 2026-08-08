# MedControl — Audit Register

This register tracks technical findings for the MedControl **Input** section and related modules.

Status values: `Open`, `Confirmed`, `Fixed`, `Deferred`, `Rejected`.

| ID | Source | Severity | Area | Finding | Status | Decision / fix | Verification |
|---|---|---|---|---|---|---|---|
| INPUT-001 | Static audit | High | `js/storage.js` / `getState()` | Invalid or corrupted JSON in `localStorage` is caught silently; `getState()` then creates and saves a new default state, which can overwrite the only stored copy without warning. | Fixed | Preserve the corrupted raw payload under a separate backup key before recovery. If backup storage itself fails, abort recovery instead of overwriting the original state. Commit `2080b8aaa223d1a631c29ece93962a495d1bdc71`. | Verified manually on 2026-08-09: safety copy created and confirmed; primary storage intentionally corrupted; MedControl detected the parse failure and logged that corrupted storage was preserved before recovery; primary storage restored from safety copy; JSON parse succeeded afterward with 10 medication records intact. |
| INPUT-002 | Static audit | Medium | `js/storage.js` / `saveState()` | `localStorage.setItem()` has no error handling. Quota/security/storage failures can abort an action without a controlled user-facing error path. | Fixed | Wrap storage writes in `try/catch`, return success/failure, log the error, and show a user-facing message while leaving the previous stored data unchanged. Commit `04978a562b0bd5c9d3871c686d75227aedb4a4a5`. | Verified manually on 2026-08-09 with simulated `QuotaExceededError`: user warning displayed; `saveState()` returned `false`; console logged the storage failure; temporary `Storage.prototype.setItem` override was restored immediately. |
| INPUT-003 | Static audit | Medium | `js/medications.js` / `saveMedicationEdit()` | Saving an edit always writes an `edited` history event, even when the calculated change set is empty. This can create blank/no-op history rows and unnecessary history growth. | Fixed | Added normalized comparison of editable medication fields before invoking the original save flow. No-op saves now close the dialog without `saveState()` or a new history entry. Commit `bc23a7f92938ca0a58d8736d745bff306b13ac39` (guard) plus prior loader commit `e90aba49f96c2867aba860a8b57e3139d0373e3f`. | Verified manually twice on 2026-08-09 using test medication `INPUT-003.1`; no additional `Изменено` rows were created. |
| INPUT-004 | Static audit | Deferred | `js/medications.js` / `resetMedControlData()` | Current reset uses `makeDefaultState()`, so it resets settings together with medications and intake logs. Final reset scope is intentionally deferred until Intake, Board, and Control are complete. | Deferred | Revisit when reset requirements are finalized. | Pending |
| INPUT-005 | Static audit | Medium | `js/history.js` / `rowHistoryHtml()` | When an edited history row uses `contentUnit = other` or `intakeUnit = other`, the label formatter reads the custom unit only from `entry.snapshot`. Edited rows store values in `entry.changes`, so the journal can display `—` instead of the edited custom unit. | Confirmed | Fix the formatter to resolve `contentUnitOther` / `intakeUnitOther` from the same history source (`snapshot` for created rows, `changes` for edited rows), with a safe fallback. | Pending |

## Checked areas with no confirmed defect in this pass

- Cancelled medication guards exist in `toggleMedicationMode`, `openEditMedication`, and `saveMedicationEdit`.
- `cancelMedication` sets `cancelled = true` and `active = false`, and records a cancellation history event.
- The Input renderer separates active/passive medications from cancelled medications and exposes only History in the archive row.
- Reset availability in the renderer requires zero non-cancelled medications and at least one cancelled medication.
- Medication values rendered in the active list and archive are HTML-escaped.

## Audit policy

- Audit first; no automatic code changes.
- Critical/High confirmed data-integrity or page-breaking defects are fixed before proceeding.
- Medium/Low findings may be deferred when they do not block connected sections.
- Every fix requires a dedicated test and commit reference.
