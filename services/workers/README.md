# Workers

This folder contains a minimal worker process used for background jobs.

For the prototype:

- The worker exposes a small HTTP health endpoint at `/health` so Docker
  Compose and humans can verify it is running.
- A placeholder heartbeat logs every 30s to simulate activity.
- Future work: integrate Redis/Bull (or similar), implement job handlers,
  and add graceful shutdown and metrics.

Run locally for development:

1. Install dependencies: `npm install`
2. Start in dev mode: `npm run dev`

The actual job-processing code should live under `src/`.

Register job handlers under `src/` (for example, `src/jobs/`).
