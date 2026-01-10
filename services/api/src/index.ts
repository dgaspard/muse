/* Minimal Express API for prototype
 * - Exposes a /health route for quick checks
 * - Intentionally simple; business logic to be added later
 */
import express from 'express'

const app = express()
const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000

app.get('/health', (req, res) => {
  res.json({status: 'ok', service: 'api'})
})

app.get('/ping', (req, res) => res.send('pong'))

app.listen(port, () => {
  // Keep the log explicit for developers running the container
  console.log(`API listening on port ${port}`)
})
