# QA Capture Setup

This directory contains the Playwright smoke-test setup for DON-33.

Local Node runtime
1. cd qa
2. npm install
3. npx playwright install chromium
4. npm run preflight
5. npm test

What `npm run preflight` checks
- Node/npm availability
- whether Chromium can actually launch
- whether Docker is available for the sidecar fallback
- whether the local static server path is usable

Important runtime requirements
- A capture-capable runtime must be able to launch Playwright Chromium.
- If Chromium fails with missing shared libraries such as `libglib-2.0.so.0`, this worker cannot produce screenshot/video evidence.
- If no external `BASE_URL` is provided, the local fallback now uses a Node static server via `npm run serve` and no longer depends on Python.

Local serving behavior
- Without `BASE_URL`, Playwright starts a local static server for `../` at `http://127.0.0.1:4173`.
- With `BASE_URL` set, Playwright skips local serving and targets the provided environment.

Examples
- `npm test`
- `BASE_URL=http://127.0.0.1:4173 ARTIFACT_DIR=/tmp/don33-captures npm test`

Artifacts
- screenshots: `../artifacts/qa-captures/screenshots/`
- videos/traces/test output: `../artifacts/qa-captures/test-results/`
- HTML report: `../artifacts/qa-captures/html-report/index.html`

Docker sidecar execution
1. docker compose -f docker-compose.qa-capture.yml --profile qa up --build --abort-on-container-exit qa-capture
2. docker compose -f docker-compose.qa-capture.yml down

Use the Docker sidecar only in a runtime that actually has Docker enabled.
