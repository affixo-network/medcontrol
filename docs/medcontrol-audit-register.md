# MedControl — Audit Register

This register tracks technical findings for the MedControl **Input** section and related modules.

Status values: `Open`, `Confirmed`, `Fixed`, `Deferred`, `Rejected`.

| ID | Source | Severity | Area | Finding | Status | Decision / fix | Verification |
|---|---|---|---|---|---|---|---|
| INPUT-001 | Static audit | High | `js/storage.js` / `getState()` | Invalid or corrupted JSON in `localStorage` is caught silently; `getState()` then creates and saves a new default state, which can overwrite the only stored copy without warning. | Open | Review before fixing. Do not change code automatically. | Pending |
| INPUT-002 | Static audit | Medium | `js/storage.js` / `saveState()` | `localStorage.setItem()` has no error handling. Quota/security/storage failures can abort an action without a controlled user-facing error path. | Open | Review before fixing. Do not change code automatically. | Pending |
| INPUT-003 | Static audit | Medium | `js/medications.js` / `saveMedicationEdit()` | Saving an edit always writes an `edited` history event, even when the calculated change set is empty. This can create blank/no-op history rows and unnecessary history growth. | Open | Confirm expected product behavior before fixing. | Pending |
| INPUT-004 | Static audit | Deferred | `js/medications.js` / `resetMedControlData()` | Current reset uses `makeDefaultState()`, so it resets settings together with medications and intake logs. Final reset scope is intentionally deferred until Intake, Board, and Control are complete. | Deferred | Revisit when reset requirements are finalized. | Pending |

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
