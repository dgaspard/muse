#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for Muse prototype services.
# - Expects services to be reachable on localhost using ports defined in .env
# - Exits non-zero if any check fails

check() {
  local url="$1"
  local name="$2"
  echo "Checking $name at $url"
  response=$(curl -sS --max-time 5 "$url" || true)
  if echo "$response" | grep -q '"status".*"ok"'; then
    echo "OK: $name"
  else
    echo "FAIL: $name"
    echo "Response: $response"
    exit 1
  fi
}

check "http://localhost:4000/health" "api"
check "http://localhost:8000/health" "pipeline"
check "http://localhost:4100/health" "worker"
# For the web UI, a simple 200 check is sufficient
echo "Checking web at http://localhost:3000/"
if curl -sS --head --fail --silent http://localhost:3000/ >/dev/null; then
  echo "OK: web"
else
  echo "FAIL: web"
  exit 1
fi

echo "All smoke tests passed. ✅"
