# Codex audit brief — MedControl / Input

Audit the current Input module on branch `codex-input-audit`, based on `modular-1.000`.

## Goal
Find reproducible technical defects in the medication Input workflow without changing production/user data.

## Scope
- medication creation and validation
- medication editing and no-op edits
- custom content/intake units (`other` fields)
- daily / weekdays / explicit-dates schedules
- start/end date consistency
- active/passive transitions
- cancellation and cancelled-record protection
- row history correctness: only fields actually changed should appear in an `edited` event
- legacy history compatibility
- reset/archive-related interactions only where Input code directly participates

## Known status
- INPUT-001: fixed/verified
- INPUT-002: fixed/verified
- INPUT-003: fixed/verified
- INPUT-004: deferred; inspect weekday schedule start/end-date model, do not assume a product decision
- INPUT-005: fixed/verified (custom unit history)
- INPUT-006: fixed/verified (unchanged schedule must not appear in edited history)

## Safety rules
1. Do not merge to `modular-1.000`.
2. Do not modify production data or Supabase records.
3. Prefer static/code-level findings first.
4. Do not change behavior merely for style/refactoring.
5. For every finding provide: ID candidate, severity, exact file/function, reproduction path, expected vs actual, root cause, minimal safe fix.
6. Separate confirmed defects from product/design questions.
7. Pay special attention to interactions between `js/medications.js`, `js/history.js`, `js/medication-edit-noop-guard.js`, `js/schedule.js`, state persistence, and script load order.

## Output
Return a concise prioritized audit report. Do not implement fixes unless explicitly requested after review.