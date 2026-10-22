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
- Static cache revision: `medcontrol-static-modular3-v9`. No medical records or credentials are stored in Cache Storage.

## Verification

All browser checks use isolated browser contexts and synthetic records. No live data or Production operations are involved.

| Suite | Passed |
| --- | ---: |
| `tests/modular3-complete-interface.cjs` — original UI, delayed encryption, write faults, offline restart, draft recovery, course repeat, seven-day archive, reset and logout | 18 |
| `tests/modular3-transfer-e2e.cjs` — encrypted handoff and prior migration regressions | 28 |
| `playwright.modular3-transfer.config.cjs` — boundaries, migration, cryptographic primitives and static caching | 22 |
| Loader and auth integration Node tests | 9 |

Both temporal-guard checks and the Modular-2 interface/localization baseline also pass. The layout baseline allows only the protected version label to change; asynchronous medication handler changes are covered by the original-interface browser suite.

The `Modular-3 Encrypted Transfer E2E` workflow runs these suites on pushes to this branch. It neither deploys Production nor accesses Supabase.

## Next scope

The language catalogs remain RU and EN. The 95-language work follows transfer verification and is not part of this change. Production and its real user data remain outside the scope of these checks.
