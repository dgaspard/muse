# Muse (prototype)

Muse converts governance and compliance documents into Markdown,
user stories, TODOs, and AI prompts.

This is an intentionally minimal prototype scaffold.

Security and authentication are deferred — everything runs locally with Docker
Compose.

Quick start

1. Copy `.env.example` to `.env` and edit values if needed.
2. Run: `docker-compose up --build`
3. Health endpoints:

   - Web: [http://localhost:3000/](http://localhost:3000/)
   - API: [http://localhost:4000/health](http://localhost:4000/health)
   - Pipeline (FastAPI): [http://localhost:8000/health](http://localhost:8000/health)
   - Worker: [http://localhost:4100/health](http://localhost:4100/health)

Integration E2E upload test

- Run locally: `npm run e2e-upload` or `bash ./scripts/e2e_upload.sh`. This script brings up a minimal stack (minio, api, web), posts a sample file to `http://localhost:3000/api/uploads`, asserts an HTTP 200 and `"ok": true` in the JSON response, and then tears the stack down. Docker and Docker Compose are required; the script uses ports 3000, 4000, and 9000.

- CI: A GitHub Actions workflow `.github/workflows/integration.yml` runs this script on pull requests and can also be triggered manually from the Actions UI.

Structure

- apps/web — Next.js frontend (minimal)
- services/api — Node.js API (Express) with health route
- services/workers — Node.js worker process (minimal health server)
- services/pipeline — Python FastAPI service (document conversion placeholder)
- contracts/, docs/, backlog/, prompts/ — placeholders for future artifacts

Before implementing features, refer to:

- `/contracts/product-vision.md`
- `/contracts/user-story-format.md`
- `/contracts/ai-prompt-format-spec.md`
- `/contracts/ai-constraints-policy.md`
- `/architecture/muse-architecture.md`
- `/examples/muse-end-to-end-example.md`

Guidelines

- Prefer clarity over cleverness; code is intentionally explicit and commented.
- Keep business logic out of this scaffold; add it to services as needed.

Project constraints (apply to contributors):

- **Do NOT modify files under `/contracts`** without explicit instruction.
- **Do NOT modify tests to make failures pass.** Fix code or add tests that
  reflect intended behavior.
- **Prefer explicit, readable code** and add `// TODO:` comments instead of
  guessing behavior.
- **Assume regulated environments;** favor explicit checks, clear logs, and
  auditability.

If anything is unclear, open an issue and pick sensible defaults.
