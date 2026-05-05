# Daily Build + Smoke Runbook

Issue: [DON-28](/DON/issues/DON-28)

## Workflow
- File: `.github/workflows/daily-build-and-smoke.yml`
- Triggers:
  - push to `main`
  - pull requests
  - daily schedule at `07:00 UTC`
  - manual dispatch
- Job order:
  1. `gameplay-unit-tests`
  2. `qa-smoke`
  3. `daily-build-bundle`

## Artifact policy
- QA smoke artifacts uploaded as `qa-captures-<run_number>`
- Daily build bundle uploaded as `daily-build-<run_number>`
- Retention: `14` days
- Artifact versioning key: GitHub run number + immutable run ID in CI logs

## Smoke gate requirements
The smoke gate is considered passing only when all of the following are true:
- app shell loads (`01-homepage.spec.js`)
- one encounter cycle completes with combat evidence (`03-combat-resolution.spec.js`)
- scene transition from shop/placement path is stable (`02-shop-and-placement.spec.js`)

## Known reliability guard
Default artifact writes can fail with `EACCES` on constrained workers. The workflow forces a writable artifact root before running Playwright:
- `ARTIFACT_DIR=${{ github.workspace }}/artifacts/qa-captures`
- pre-create required subdirectories
- apply user write permissions

## Build-break escalation path (tested)
Use this path whenever `qa-smoke` or `daily-build-bundle` fails.

1. Incident declaration
- Open or update issue under `DON` with run URL and failing job name.
- Set severity:
  - `high` for `main` or scheduled daily failures
  - `medium` for pull request-only failures

2. Immediate ownership and notification
- DevOps Engineer takes incident ownership.
- Mention:
  - release-manager for release-impact status
  - qa-lead for smoke evidence review
  - lead-programmer when gameplay/unit tests fail

3. Stabilization actions
- Re-run failed job once to classify transient vs deterministic failure.
- If artifact permissions are involved, verify writable path setup step output.
- If test-level failure persists, capture HTML report + trace bundle and attach to incident issue.

4. Roll-forward or rollback decision
- If fix is infra-only (pipeline config/scripts), roll forward and re-run.
- If fix touches gameplay code, hand off to responsible programmer and keep pipeline task in `blocked` until patch lands.

5. Closeout
- Post root cause, fix, and prevention note in the incident thread.
- Link final green run proving recovery.

## One-time escalation test evidence
Validated once during DON-28 execution:
- failing path reproduced: default smoke run hit `EACCES` on `artifacts/qa-captures/*`
- mitigation verified: `ARTIFACT_DIR=/tmp/don-qa-captures npm test` passed (`3/3`)
