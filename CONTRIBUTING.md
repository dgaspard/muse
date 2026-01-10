# Contributing to Muse

Thank you for contributing!

This file summarizes project expectations and the minimal workflow we
expect contributors to follow.

## Project constraints (apply to humans & AI agents)

- **Do NOT modify files under `/contracts`** without explicit instruction.
- **Do NOT modify tests to make failures pass.** Fix the code or add tests
  that reflect intended behavior.
- **Prefer explicit, readable code** over clever abstractions.
- **Add TODO comments** instead of guessing behavior or business rules (for
  example: `// TODO: implement X when spec provided`).
- **Assume regulated environments:** keep checks explicit, logs clear, and
  changes auditable.

> If in doubt about behavior or requirements, open an issue rather than guessing.

## Getting started (local dev)

- Copy `.env.example` → `.env` and adjust as needed.
- Start the stack: `docker compose up --build` (recommended).
- Health endpoints:
  - API: `http://localhost:4000/health`
  - Pipeline: `http://localhost:8000/health`
  - Worker: `http://localhost:4100/health`
- Smoke tests: `bash ./scripts/smoke_test.sh` (CI also runs this on push).

## Making changes / PR checklist

- Keep PRs small and focused.
- Include a short description and manual verification steps (endpoints to
  call, env vars to set).
- Run `./scripts/smoke_test.sh` before opening a PR; fix any failing
  checks.
- Add tests for new behavior where appropriate; do not change existing
  tests to force them to pass.
- Use `// TODO:` comments for behavior that cannot be implemented yet and
  reference an issue if possible.
- Document public API changes in `docs/` or the relevant service folder.

## Contact

- If you're unsure, open an issue describing the change and a suggested
  implementation.

Thank you — your clear, auditable contributions help keep this prototype
maintainable and safe for future regulated use.
