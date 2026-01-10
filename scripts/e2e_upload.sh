#!/usr/bin/env bash
set -euo pipefail

# Lightweight e2e CI script - brings up the required services and runs a sample upload
# Usage: bash ./scripts/e2e_upload.sh

PROJECT_ID=${PROJECT_ID:-ci-test}
UPLOAD_FILE=${UPLOAD_FILE:-/tmp/muse_e2e_test.pdf}
TIMEOUT=${TIMEOUT:-60}

echo "Preparing test file: $UPLOAD_FILE"
echo "ci-e2e" > "$UPLOAD_FILE"

echo "Starting minimal stack (minio, api, web)"
docker compose up -d --build minio api web

echo "Waiting for API health..."
start=
start_time=$(date +%s)
while true; do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    echo "API is healthy"
    break
  fi
  now=$(date +%s)
  if [ $((now - start_time)) -gt $TIMEOUT ]; then
    echo "Timed out waiting for API health" >&2
    docker compose logs api --no-log-prefix --tail 200 || true
    docker compose down -v || true
    exit 1
  fi
  sleep 1
done

echo "Waiting for web to be reachable..."
start_time=$(date +%s)
while true; do
  if curl -sf http://localhost:3000/ >/dev/null 2>&1; then
    echo "Web is reachable"
    break
  fi
  now=$(date +%s)
  if [ $((now - start_time)) -gt $TIMEOUT ]; then
    echo "Timed out waiting for web" >&2
    docker compose logs web --no-log-prefix --tail 200 || true
    docker compose down -v || true
    exit 1
  fi
  sleep 1
done

# Perform upload via the web proxy
TMP_RESP=$(mktemp)
HTTP_STATUS=$(curl -sS -w "HTTP_STATUS:%{http_code}\n" -F "projectId=$PROJECT_ID" -F "file=@$UPLOAD_FILE" http://localhost:3000/api/uploads -o "$TMP_RESP" | tr -d '\r')

echo "Upload response:"
cat "$TMP_RESP"
echo "$HTTP_STATUS"

if ! echo "$HTTP_STATUS" | grep -q "HTTP_STATUS:200"; then
  echo "Upload failed (non-200): $HTTP_STATUS" >&2
  docker compose logs web --no-log-prefix --tail 200 || true
  docker compose logs api --no-log-prefix --tail 200 || true
  docker compose logs minio --no-log-prefix --tail 200 || true
  docker compose down -v || true
  exit 2
fi

# Basic JSON check for { "ok": true }
if ! grep -q '"ok"\s*:\s*true' "$TMP_RESP"; then
  echo "Upload returned 200 but response did not include \"ok\": true" >&2
  docker compose logs web --no-log-prefix --tail 200 || true
  docker compose logs api --no-log-prefix --tail 200 || true
  docker compose logs minio --no-log-prefix --tail 200 || true
  docker compose down -v || true
  exit 3
fi

echo "Upload succeeded and returned ok: true"

echo "Tearing down stack"
docker compose down -v

exit 0
