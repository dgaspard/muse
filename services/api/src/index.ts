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
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { uploadObject, objectUrl } from './storage/minioClient'

const app = express()

// Parse JSON request bodies for future endpoints
app.use(express.json())
// Allow cross-origin requests in prototype mode (no auth)
app.use(cors())

const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000

// Health check endpoint used by monitoring and smoke tests
app.get('/health', (_req: Request, res: Response) => {
  // Keep the response intentionally small and stable
  res.json({ ok: true, service: 'muse-api' })
})

// Simple ping route useful during manual checks
app.get('/ping', (_req: Request, res: Response) => res.send('pong'))

// Configure multer to write uploads to disk to avoid buffering large files in memory.
// Files will be streamed from disk into MinIO and removed after upload.
const uploadDir = path.join(os.tmpdir(), 'muse-uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage })

// POST /uploads
// Accepts multipart/form-data with fields: projectId (string), file (file)
app.post('/uploads', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const projectId = (req.body && req.body.projectId) || undefined
    const file = req.file

    if (!projectId) {
      return res.status(400).json({ ok: false, error: 'projectId is required' })
    }
    if (!file) {
      return res.status(400).json({ ok: false, error: 'file is required' })
    }

    // Basic validation of file extension
    const allowed = ['.docx', '.pdf', '.txt']
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowed.includes(ext)) {
      // Remove temp file before returning
      fs.unlinkSync(file.path)
      return res.status(400).json({ ok: false, error: 'unsupported file type' })
    }

    const documentId = uuidv4()
    const objectName = `${projectId}/${documentId}-${file.originalname}`

    // Upload to MinIO (streams from disk)
    await uploadObject(objectName, file.path, file.mimetype)

    // Remove temp file after successful upload
    try {
      fs.unlinkSync(file.path)
    } catch (err) {
      // Non-fatal cleanup error
      console.warn('Failed to remove temp upload file', err)
    }

    // Log project/document association (do NOT log file contents)
    console.log(`[uploads] project=${projectId} document=${documentId} object=${objectName}`)

    return res.json({ ok: true, documentId, objectName, location: objectUrl(objectName) })
  } catch (err) {
    console.error('Upload failed', err)
    return res.status(500).json({ ok: false, error: 'upload failed' })
  }
})

// Future routes should be organized into routers, for example:
// import usersRouter from './routes/users'
// app.use('/users', usersRouter)
// Place further business logic and database integrations inside those route handlers or dedicated services.

app.listen(port, () => {
  // Keep the log explicit for developers running the container
  console.log(`muse-api listening on port ${port}`)
})
