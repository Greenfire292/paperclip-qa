#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${ARTIFACT_DIR}/screenshots" "${ARTIFACT_DIR}/videos" "${ARTIFACT_DIR}/traces" "${ARTIFACT_DIR}/html-report" "${ARTIFACT_DIR}/test-results"

echo "Waiting for target app: ${BASE_URL}"
for i in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/index.html" >/dev/null 2>&1 || curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
    echo "Target app is reachable"
    break
  fi
  echo "Still waiting... (${i}/60)"
  sleep 2
done

npm test
