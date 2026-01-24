# Copilot instructions — Muse (prototype)

Purpose
- Help AI coding agents be productive immediately: where to find files, how to run services locally, and which patterns to follow for small, incremental changes.

Quick start (what to run)
- Copy `.env.example` → `.env` and adjust as needed.
- Start everything locally (recommended):
  - docker-compose up --build
- Health endpoints (verify services):
  - Web: http://localhost:3000/
  - API health: http://localhost:4000/health — implemented in `services/api/src/index.ts`
  - Worker health: http://localhost:4100/health — implemented in `services/workers/src/worker.ts`

Big picture
- Minimal monorepo workspace; Node services run in separate containers (see `docker-compose.yml`).
- Primary components:
  - `apps/web` — Next.js frontend (link to API health links)
  - `services/api` — Node (TypeScript) API (Express) — starter routes in `src/index.ts`
  - `services/workers` — Node worker process (simulated heartbeat + health endpoint)
- Data & infra in compose: Postgres, Redis, MinIO (local dev only).

Project-specific conventions
- Keep services explicit and small — prefer readable, commented code over clever abstractions.
- TypeScript for Node apps; use `ts-node-dev` for dev and `tsc` + `node` for production images.
- Placeholders for business logic exist; do not implement domain rules unless asked.

Where to add features / common tasks (examples)
- Add API routes in `services/api/src/` and export them via `src/index.ts`.
- Add background job handlers in `services/workers/src/worker.ts` (queue integration later).
- Add OpenAPI/contract files to `contracts/` and document in `docs/`.

Testing & debugging
- Use Docker Compose logs to inspect service output: `docker compose logs -f api`.
- For quick iteration, run Node services locally with `npm run dev` in the service folder.

Smoke tests
- A simple smoke test script is available at `scripts/smoke_test.sh`.
  - Run locally: `bash ./scripts/smoke_test.sh` or `npm run smoke` from the repo root.
  - The workflow `.github/workflows/smoke.yml` runs these smoke tests on push and via manual dispatch.
  - The script checks `/health` for API, worker, verifies the web UI returns HTTP 200, and validates backend dependencies:
    - Postgres readiness via `docker compose exec postgres pg_isready`
    - Redis reachability via `docker compose exec redis redis-cli PING`
    - MinIO readiness via `http://localhost:9000/minio/health/ready`
  - These checks are intentionally lightweight and implemented using tools available in the official service images (pg_isready, redis-cli).

PR guidance
- Keep PRs small and focused; add unit tests where applicable (but tests are optional for prototype scaffolding).
- Describe manual verification steps (e.g., endpoints to call, env vars to set).

Notes for agents
- This is an explicit, intentionally small prototype — favor clear, minimally invasive changes.
- Prefer adding README notes or comments in code when introducing non-obvious choices.

Project constraints (for AI agents and human contributors):
- **Do NOT modify files under `/contracts`** without explicit instruction.
- **Do NOT modify tests to make failures pass.** Fix code or add tests that reflect intended behavior.
- **Prefer explicit, readable code** over abstractions; add `// TODO:` comments rather than guessing behavior.
- **Assume regulated environments:** favor explicit checks, clear logs, and auditability.
- When uncertain about behavior or requirements, **open an issue** rather than guessing.

Contact/owner
- This is a prototype scaffold. If unsure, open an issue describing the change and include a suggested implementation.

# EPIC-003: Artifact Materialization

Retrieve and materialize artifacts (don't regenerate):

- GET /mcp/epics, /mcp/features, /mcp/stories, /mcp/prompts
- POST /mcp/validate-lineage
- POST /mcp/materialize
- POST /mcp/commit
