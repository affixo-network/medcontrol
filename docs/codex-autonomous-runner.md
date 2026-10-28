# MedControl — continuous Codex runner (deployment specification)

## Status
**Not deployed.** This document specifies the runner and its safety gates. An hourly ChatGPT automation is not a continuous Codex executor.

## Required architecture
1. A dedicated persistent runner (self-hosted or other approved compute) executes an agent loop; GitHub-hosted Actions runners are finite and not a 24/7 daemon.
2. Codex CLI authenticates using a separately provisioned, least-privilege credential stored only in the runner's secret store. Never commit or log tokens.
3. Work queue: GitHub issues with explicit `codex-ready` label, one issue at a time, with a lock preventing concurrent modifications.
4. For each issue: read the latest `modular-3.000` commit, analyze scope, edit only an isolated working tree of that same branch, run local tests, and prepare a reviewable patch/commit. Never change production, Supabase, Microsoft or patient data.
5. Execute the existing `Modular 3 Browser E2E` Playwright workflow for code changes; record workflow run ID and actual conclusion before claiming a pass.
6. Append to issue #13: timestamp, issue, original commit, diff summary, test output, new commit, CI run link, next blocker. Stop and alert on security-sensitive changes, missing credentials, unexpected branch, CI failure or paid-resource request.
7. Restart on crashes, enforce execution timeouts and backoff, and cap compute/token usage; continuous execution cannot be promised at zero cost without verifying quotas.

## Prerequisites to activate
- An accessible persistent compute environment with an installed Codex CLI.
- Approved Codex authentication and repository write permissions.
- A test-only workflow with explicit permissions and verified cost/quota limits.
- A successful end-to-end trial: issue -> Codex change -> tests -> journal -> next issue.

No secret, compute service, or autonomous write permission is created by this document.