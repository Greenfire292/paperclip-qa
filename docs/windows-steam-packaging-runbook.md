# Windows Steam Packaging Runbook

Issue: [DON-45](/DON/issues/DON-45)

## Scope
This runbook defines a repeatable Windows packaging path for vertical-slice artifacts used for:
- Steam depot upload preparation
- local QA installation smoke validation

## CI workflow
- File: `.github/workflows/windows-steam-package.yml`
- Triggers:
  - push to `main`
  - pull requests
  - manual dispatch
- Job order:
  1. `tests` (unit + smoke gate)
  2. `package-windows` (PowerShell packaging on `windows-latest`)

## Build inputs and scripts
- Steam candidate packager: `scripts/windows/package-steam.ps1`
- Local installer bundle creator: `scripts/windows/create-local-installer.ps1`

Included payload paths:
- `index.html`
- `src/`
- `config/`
- `docs/`
- `prototype.js`
- `combatResolver.js`
- `ui_event_pipeline.js`

## Artifact naming and versioning
Package version format:
- `0.1.<github_run_number>+<short_sha>`

Produced artifacts:
- `crownforge-windows-steam-<version>.zip`
- `crownforge-windows-steam-<version>.manifest.json`
- `crownforge-windows-local-installer-<version>.ps1`
- `crownforge-windows-local-installer-<version>.zip`

Provenance fields are embedded in the manifest:
- commit SHA
- run number
- run ID
- UTC packaging timestamp

## Retention policy
- QA smoke captures: `14` days
- Windows packaging artifacts: `30` days

Rationale:
- smoke evidence is short-lived verification data
- packaging artifacts require longer retention for release verification and rollback support

## Local QA install validation
1. Download `crownforge-windows-local-installer-<version>.zip` from workflow artifacts.
2. Unzip on a Windows QA machine.
3. Run PowerShell installer:
   - `./crownforge-windows-local-installer-<version>.ps1`
4. Validate install path default:
   - `C:\Program Files\CrownforgePrototype`
5. Perform smoke pass against installed contents.

## Rollback procedure
Use this when packaging workflow changes cause failures.

1. Freeze release promotion
- Mark the release candidate as blocked and notify release-manager + qa-lead.

2. Recover known-good artifact
- Select last successful artifact set from CI (`windows-package-<run_number>`).
- Verify manifest commit/run metadata before reuse.

3. Revert pipeline/scripts if required
- Revert `.github/workflows/windows-steam-package.yml` and/or `scripts/windows/*.ps1` to last known-good commit.
- Re-run workflow on `main`.

4. Validate recovery
- Confirm `tests` passes and Windows artifacts are uploaded.
- Confirm local installer bundle unpacks and installs on QA machine.

5. Close incident
- Record root cause, recovery commit, and preventive action in issue thread.

## Reproducibility guardrails
- version includes immutable CI run and commit identity
- package payload paths are explicitly enumerated
- manifest captures provenance for any artifact rehydration request
