# Muse (prototype)

Muse converts governance/compliance documents into Markdown, user stories, TODO.md, and AI prompts.

This is an intentionally minimal prototype scaffold. Security and auth are deferred — everything runs locally with Docker Compose.

Quick start

1. Copy `.env.example` to `.env` and edit values if needed.
2. Run: `docker-compose up --build`
3. Health endpoints:
   - Web: http://localhost:3000/
   - API: http://localhost:4000/health
   - Pipeline (FastAPI): http://localhost:8000/health
   - Worker: http://localhost:4100/health

Structure

- apps/web — Next.js frontend (minimal)
- services/api — Node.js API (Express) with health route
- services/workers — Node.js worker process (minimal health server)
- services/pipeline — Python FastAPI service (document conversion placeholder)
- contracts/, docs/, backlog/, prompts/ — placeholders for future artifacts

Guidelines

- Prefer clarity over cleverness; code is intentionally explicit and commented.
- Keep business logic out of this scaffold; add it to services as needed.

If anything is unclear, open an issue and pick sensible defaults.
