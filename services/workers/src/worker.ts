/* Minimal worker process for prototype
 * - Starts a small HTTP server for /health so Docker Compose can verify it's up
 * - Simulates a polling loop where jobs would be processed; left as a placeholder
 */
import express from 'express'

const app = express()
const port = process.env.WORKER_PORT ? Number(process.env.WORKER_PORT) : 4100

app.get('/health', (req, res) => res.json({status: 'ok', service: 'worker'}))

// Placeholder job loop (no business logic yet)
setInterval(() => {
  // In the real system this would poll a queue (Redis, Bull, etc.) and process jobs
  // We intentionally log a heartbeat so that container logs show the worker is running
  console.log('worker heartbeat')
}, 30_000)

app.listen(port, () => console.log(`Worker health server running on port ${port}`))
