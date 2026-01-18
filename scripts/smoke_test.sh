#!/usr/bin/env bash
set -euo pipefail

# Project constraints (acknowledged):
# - Do NOT modify files under /contracts without explicit instruction.
# - Do NOT modify tests to make failures pass.
# - Prefer explicit, readable code over abstractions.
# - Add TODO comments instead of guessing behavior.
# - Assume this project may be used in regulated environments; keep checks explicit and auditable.
#
# NOTE: Smoke tests are strict by design; if a check fails, fix the service or the test (do not mute failures).

# Enhanced smoke test for Muse prototype services.
# - Expects services to be reachable on localhost using ports defined in .env
# - Verifies service health endpoints AND backend dependencies (Postgres, Redis, MinIO)
# - Exits non-zero if any check fails

check_api() {
  local url="$1"
  local name="$2"
  echo "Checking $name at $url"
  response=$(curl -sS --max-time 5 "$url" || true)
  # Expect JSON: {"ok": true, "service": "muse-api"}
  if echo "$response" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true' && echo "$response" | grep -qE '"service"[[:space:]]*:[[:space:]]*"muse-api"'; then
    echo "OK: $name"
  else
    echo "FAIL: $name"
    echo "Response: $response"
    exit 1
  fi
}

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

check_api "http://localhost:4000/health" "api"
check "http://localhost:4100/health" "worker"

# Web UI: HTTP 200
echo "Checking web at http://localhost:3000/"
if curl -sS --head --fail --silent http://localhost:3000/ >/dev/null; then
  echo "OK: web"
else
  echo "FAIL: web"
  exit 1
fi

# Backend dependency checks (run these using docker compose exec so we target the correct containers)
# Postgres: use pg_isready inside the postgres container
echo "Checking Postgres readiness via docker compose exec postgres pg_isready"
if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-muse}" >/dev/null 2>&1; then
  echo "OK: postgres is ready"
else
  echo "FAIL: postgres is not ready"
  docker compose logs postgres --no-log-prefix --tail 50 || true
  exit 1
fi

# Redis: use redis-cli PING
echo "Checking Redis via docker compose exec redis redis-cli PING"
if docker compose exec -T redis redis-cli PING 2>/dev/null | grep -q PONG; then
  echo "OK: redis"
else
  echo "FAIL: redis"
  docker compose logs redis --no-log-prefix --tail 50 || true
  exit 1
fi

# MinIO: check the ready endpoint
echo "Checking MinIO at http://localhost:9000/minio/health/ready"
if curl -sS --fail --max-time 5 http://localhost:9000/minio/health/ready >/dev/null; then
  echo "OK: minio"
else
  echo "FAIL: minio"
  docker compose logs minio --no-log-prefix --tail 50 || true
  exit 1
fi

echo "All smoke tests passed, including backend dependency checks. ✅"
