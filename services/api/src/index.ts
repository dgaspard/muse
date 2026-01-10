/* Minimal Express API for prototype
 * - Exposes a /health route for quick checks
 * - Intentionally simple; business logic to be added later
 *
 * Project constraints (acknowledged):
 * - Do NOT modify files under /contracts without explicit instruction.
 * - Do NOT modify tests to make failures pass.
 * - Prefer explicit, readable code over abstractions.
 * - Add TODO comments instead of guessing behavior.
 * - Assume this project may be used in regulated environments; favor explicit checks and clear logs.
 *
 * TODO: Follow these constraints when adding routes, middleware, or integrations.
 */
import express, { Request, Response } from 'express'

const app = express()

// Parse JSON request bodies for future endpoints
app.use(express.json())

const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000

// Health check endpoint used by monitoring and smoke tests
app.get('/health', (_req: Request, res: Response) => {
  // Keep the response intentionally small and stable
  res.json({ ok: true, service: 'muse-api' })
})

// Simple ping route useful during manual checks
app.get('/ping', (_req: Request, res: Response) => res.send('pong'))

// Future routes should be organized into routers, for example:
// import usersRouter from './routes/users'
// app.use('/users', usersRouter)
// Place further business logic and database integrations inside those route handlers or dedicated services.

app.listen(port, () => {
  // Keep the log explicit for developers running the container
  console.log(`muse-api listening on port ${port}`)
})
