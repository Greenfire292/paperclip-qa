# Windows Local Build/Run Runbook

Issue: [DON-47](/DON/issues/DON-47)
Packaging conventions reference: [DON-45](/DON/issues/DON-45)

## Purpose
Provide a one-command and one-click Windows local run path for engineering and QA to launch the vertical-slice runtime consistently.

## One-click / one-command entry points
- PowerShell: `./scripts/windows/run-local-vertical-slice.ps1`
- Command Prompt or Explorer double-click: `scripts\\windows\\run-local-vertical-slice.cmd`

Both paths:
- ensure local QA dependencies are installed when missing
- start a local static server on `http://127.0.0.1:4173`
- open the runtime in the default browser (unless `-NoBrowser` is passed)

## Prerequisites
- Windows 10/11
- Node.js 20+
- npm (included with Node.js)

## Fresh machine workflow
1. Open PowerShell in repo root.
2. Run:
   - `./scripts/windows/run-local-vertical-slice.ps1`
3. Wait for "Starting local vertical-slice server".
4. Verify runtime opens and is interactive in browser.

Expected behavior:
- Initial run may take longer due to `npm install` in `qa/`.
- Server remains in foreground until `Ctrl+C`.

## Optional flags
- `-Port <n>`: override default port (`4173`)
- `-NoInstall`: fail if dependencies are missing (CI/sandbox-safe mode)
- `-NoBrowser`: start server without opening a browser

Examples:
- `./scripts/windows/run-local-vertical-slice.ps1 -Port 4280`
- `./scripts/windows/run-local-vertical-slice.ps1 -NoBrowser`

## Expected local artifacts
The local run path is non-packaging and does not emit installer artifacts.
For packaged artifacts and naming/version conventions, use [DON-45](/DON/issues/DON-45):
- `crownforge-windows-steam-<version>.zip`
- `crownforge-windows-steam-<version>.manifest.json`
- `crownforge-windows-local-installer-<version>.zip`

## Independent verification record
Verified in this workspace by static analysis and script path validation:
- launcher scripts present and executable by PowerShell/`cmd`
- local serving target aligns with QA runtime server behavior (`127.0.0.1:4173`)

Note: runtime launch was not fully executed in this Linux heartbeat because DON-47 targets a Windows launch path.

## Troubleshooting
### `Node.js is required`
Install Node.js 20+ and reopen the shell.

### `qa/node_modules is missing and -NoInstall was set`
Run once without `-NoInstall` so dependencies can be installed.

### Port already in use (`EADDRINUSE`)
Rerun with a different port:
- `./scripts/windows/run-local-vertical-slice.ps1 -Port 4280`

### Browser opens but page does not load
- Confirm this script window is still running.
- Check firewall prompts for local loopback access.
- Retry with `-NoBrowser` and open URL manually.
