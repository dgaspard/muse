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
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import os from 'os'
import {
  DocumentAlreadyExistsError,
  FileSystemDocumentStore,
  type DocumentStore,
  S3DocumentStore,
} from './storage/documentStore'
import { ConverterRegistry } from './conversion/documentToMarkdownConverter'
import { MusePipelineOrchestrator } from './orchestration/MusePipelineOrchestrator'
import storyRoutes from './stories/storyRoutes'

const app = express()

// Initialize converter registry for Markdown generation
const converterRegistry = new ConverterRegistry()

// Parse JSON request bodies for future endpoints
app.use(express.json())
// Allow cross-origin requests in prototype mode (no auth)
app.use(cors())

// Rate limiting to protect against DoS attacks on expensive operations
// General API rate limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
})

// Stricter rate limit for expensive operations (uploads, conversions, pipeline)
const expensiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 expensive operations per windowMs
  message: 'Too many upload/conversion requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply general rate limiting to all routes
app.use(generalLimiter)

const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000

const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000'
const minioAccessKey = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || 'minioadmin'
const minioSecretKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || 'minioadmin'
const minioBucket = process.env.MINIO_BUCKET || 'muse-uploads'

const documentStore: DocumentStore = (() => {
  const driver = (process.env.DOCUMENT_STORE_DRIVER || 's3').toLowerCase()
  if (driver === 'filesystem' || driver === 'fs') {
    const rootDir = process.env.DOCUMENT_STORE_DIR || path.join(process.cwd(), 'storage', 'documents')
    return new FileSystemDocumentStore({ rootDir })
  }

  return new S3DocumentStore({
    endpoint: minioEndpoint,
    accessKey: minioAccessKey,
    secretKey: minioSecretKey,
    bucket: minioBucket,
  })
})()

// Health check endpoint used by monitoring and smoke tests
app.get('/health', (_req: Request, res: Response) => {
  // Keep the response intentionally small and stable
  res.json({ ok: true, service: 'muse-api' })
})

// Simple ping route useful during manual checks
app.get('/ping', (_req: Request, res: Response) => res.send('pong'))

// Register story routes
app.use('/api/stories', storyRoutes)

// Configure multer to write uploads to disk to avoid buffering large files in memory.
// Files will be streamed from disk into MinIO and removed after upload.
const uploadDir = path.join(os.tmpdir(), 'muse-uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
// Guard against path traversal by ensuring we only read/remove files inside our temp upload dir.
// This function validates that uploaded files remain within the designated upload directory,
// preventing path traversal attacks (satisfies CodeQL js/path-injection).
const resolveUploadPath = (filePath: string): string => {
  const resolved = path.resolve(filePath)
  const uploadRoot = path.resolve(uploadDir) + path.sep
  if (!resolved.startsWith(uploadRoot)) {
    throw new Error('invalid upload path')
  }
  return resolved
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage })

// POST /uploads
// Accepts multipart/form-data with fields: projectId (string), file (file)
app.post('/uploads', expensiveOperationLimiter, upload.single('file'), async (req: Request, res: Response) => {
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
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      fs.unlinkSync(resolveUploadPath(file.path))
      return res.status(400).json({ ok: false, error: 'unsupported file type' })
    }

    // Read the file buffer from disk
    // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
    const buffer = await fs.promises.readFile(resolveUploadPath(file.path))

    // Use buffer-based upload (safe for containerized environments)
    const metadata = await documentStore.saveOriginalFromBuffer(buffer, {
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      projectId,
    })

    // Remove temp file after successful upload
    try {
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      fs.unlinkSync(resolveUploadPath(file.path))
    } catch (err) {
      // Non-fatal cleanup error
      console.warn('Failed to remove temp upload file', err)
    }

    // Log project/document association (do NOT log file contents)
    console.log(
      `[uploads] project=${projectId} document=${metadata.documentId} sha256=${metadata.checksumSha256} object=${metadata.originalObjectKey}`,
    )

    return res.json({
      ok: true,
      documentId: metadata.documentId,
      checksumSha256: metadata.checksumSha256,
      objectName: metadata.originalObjectKey,
      location: metadata.storageUri,
      metadata,
    })
  } catch (err) {
    if (err instanceof DocumentAlreadyExistsError) {
      return res.status(409).json({ ok: false, error: 'document already exists', documentId: err.documentId })
    }
    console.error('Upload failed', err)
    return res.status(500).json({ ok: false, error: 'upload failed' })
  }
})

// GET /documents/:documentId/metadata
// Read-only metadata retrieval.
app.get('/documents/:documentId/metadata', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const metadata = await documentStore.getMetadata(documentId)
    return res.json({ ok: true, metadata })
  } catch (err) {
    console.error('Get metadata failed', err)
    return res.status(404).json({ ok: false, error: 'document not found' })
  }
})

// GET /documents/:documentId
// Streams the original bytes back to the caller.
app.get('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const { stream, metadata } = await documentStore.getOriginal(documentId)

    res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream')
    res.setHeader('Content-Length', String(metadata.sizeBytes))
    res.setHeader('X-Document-Id', metadata.documentId)
    res.setHeader('X-Checksum-Sha256', metadata.checksumSha256)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${metadata.originalFilename.replace(/"/g, '')}"`,
    )

    return stream.pipe(res)
  } catch (err) {
    console.error('Get document failed', err)
    return res.status(404).json({ ok: false, error: 'document not found' })
  }
})

// Future routes should be organized into routers, for example:
// import usersRouter from './routes/users'
// app.use('/users', usersRouter)
// Place further business logic and database integrations inside those route handlers or dedicated services.

// POST /convert/:documentId
// Converts an immutable original document to Markdown with YAML front matter.
// The generated Markdown includes traceability metadata linking it to the source document.
app.post('/convert/:documentId', expensiveOperationLimiter, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params

    // Retrieve the immutable original document
    const { stream, metadata } = await documentStore.getOriginal(documentId)

    // Find a converter that supports the document's MIME type
    let converter
    try {
      converter = converterRegistry.findConverter(metadata.mimeType)
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: `Conversion not supported for ${metadata.mimeType}`,
        documentId,
      })
    }

    // Convert the document to Markdown
    const markdownOutput = await converter.convert(stream, metadata.mimeType, {
      documentId: metadata.documentId,
      checksumSha256: metadata.checksumSha256,
      originalFilename: metadata.originalFilename,
    })

    // Log the conversion
    console.log(
      `[convert] document=${documentId} filename=${markdownOutput.suggestedFilename} source_checksum=${markdownOutput.metadata.source_checksum}`,
    )

    // Return the Markdown with metadata
    return res.json({
      ok: true,
      documentId,
      markdownContent: markdownOutput.content,
      metadata: markdownOutput.metadata,
      suggestedFilename: markdownOutput.suggestedFilename,
    })
  } catch (err) {
    console.error('Conversion failed', err)
    return res.status(500).json({ ok: false, error: 'conversion failed' })
  }
})

// GET /convert/supported-formats
// Returns list of MIME types that can be converted to Markdown
app.get('/convert/supported-formats', (_req: Request, res: Response) => {
  const supportedMimeTypes = converterRegistry.getSupportedMimeTypes()
  return res.json({
    ok: true,
    supportedFormats: supportedMimeTypes,
  })
})

// POST /pipeline/execute
// Executes the full Muse governance-to-delivery pipeline (MUSE-008)
// Accepts multipart/form-data with fields: projectId (string), file (file)
// Returns Epic, Features, and User Stories derived from the governance document
app.post('/pipeline/execute', expensiveOperationLimiter, upload.single('file'), async (req: Request, res: Response) => {
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
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      fs.unlinkSync(resolveUploadPath(file.path))
      return res.status(400).json({ ok: false, error: 'unsupported file type' })
    }

    // Find a converter that supports the document's MIME type
    let converter
    try {
      converter = converterRegistry.findConverter(file.mimetype)
    } catch (err) {
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      fs.unlinkSync(resolveUploadPath(file.path))
      return res.status(400).json({
        ok: false,
        error: `Conversion not supported for ${file.mimetype}`,
      })
    }

    // Execute the full pipeline
    const orchestrator = new MusePipelineOrchestrator(documentStore, converter, process.cwd())
    let pipelineOutput
    try {
      // Read file to buffer for safe container handling
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      const fileBuffer = await fs.promises.readFile(resolveUploadPath(file.path))
      pipelineOutput = await orchestrator.executePipeline(fileBuffer, {
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        projectId,
      })
    } catch (err) {
      const errorMessage = (err as Error).message
      console.error('Pipeline execution failed', err)
      
      // Check if this was a validation error (MUSE-QA-002 gating)
      if (errorMessage.includes('validation failed')) {
        console.log('[pipeline] Validation gating: content quality check failed')
        // Remove temp file before returning
        try {
          // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
          fs.unlinkSync(resolveUploadPath(file.path))
        } catch (e) {
          console.warn('Failed to remove temp upload file', e)
        }
        
        return res.status(422).json({
          ok: false,
          error: 'governance content validation failed',
          details: errorMessage,
          validationBlockedPipeline: true,
        })
      }
      
      // Remove temp file before returning error
      try {
        // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
        fs.unlinkSync(resolveUploadPath(file.path))
      } catch (e) {
        console.warn('Failed to remove temp upload file', e)
      }
      
      return res.status(500).json({
        ok: false,
        error: 'pipeline execution failed',
        details: errorMessage,
      })
    }

    // Remove temp file after successful execution
    try {
      // lgtm[js/path-injection] - resolveUploadPath validates path is within upload dir
      fs.unlinkSync(resolveUploadPath(file.path))
    } catch (err) {
      console.warn('Failed to remove temp upload file', err)
    }

    console.log(
      `[pipeline] project=${projectId} document=${pipelineOutput.document.document_id} epic=${pipelineOutput.epic.epic_id} features=${pipelineOutput.features.length} stories=${pipelineOutput.stories.length} validation=${pipelineOutput.validation.isValid}`,
    )

    return res.json({
      ok: true,
      ...pipelineOutput,
    })
  } catch (err) {
    console.error('Pipeline execution failed', err)
    return res.status(500).json({ ok: false, error: 'pipeline execution failed', details: (err as Error).message })
  }
})

// POST /features/:featureId/stories
// Derive user stories from a specific feature on-demand (MinIO-based)
// Requires: featurePath and governancePath in request body
app.post('/features/:featureId/stories', expensiveOperationLimiter, async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params
    const { featurePath, governancePath, projectId, epicId } = req.body

    console.log(`[stories] Request for feature=${featureId}`)
    console.log(`[stories] featurePath=${featurePath}`)
    console.log(`[stories] governancePath=${governancePath}`)
    console.log(`[stories] projectId=${projectId}`)
    console.log(`[stories] epicId=${epicId}`)

    if (!featurePath || !governancePath) {
      return res.status(400).json({
        ok: false,
        error: 'featurePath and governancePath are required',
      })
    }

    if (!projectId) {
      return res.status(400).json({
        ok: false,
        error: 'projectId is required',
      })
    }

    // Import MinIO-based story agent
    const { FeatureToStoryAgent } = await import('./stories/FeatureToStoryAgent')
    const { getDocumentStore } = await import('./storage/documentStoreFactory')
    
    const absoluteFeaturePath = path.isAbsolute(featurePath) ? featurePath : path.join(process.cwd(), featurePath)
    const absoluteGovernancePath = path.isAbsolute(governancePath) ? governancePath : path.join(process.cwd(), governancePath)
    
    console.log(`[stories] Storing feature in MinIO: ${absoluteFeaturePath}`)
    
    // Store feature and governance in MinIO first
    const documentStore = getDocumentStore()
    const featureStats = await fs.promises.stat(absoluteFeaturePath)
    const governanceStats = await fs.promises.stat(absoluteGovernancePath)
    
    const featureDoc = await documentStore.saveOriginalFromPath(absoluteFeaturePath, {
      originalFilename: path.basename(featurePath),
      mimeType: 'text/markdown',
      sizeBytes: featureStats.size,
      projectId,
    })
    
    const governanceDoc = await documentStore.saveOriginalFromPath(absoluteGovernancePath, {
      originalFilename: path.basename(governancePath),
      mimeType: 'text/markdown',
      sizeBytes: governanceStats.size,
      projectId,
    })
    
    console.log(`[stories] Feature document ID: ${featureDoc.documentId}`)
    console.log(`[stories] Governance document ID: ${governanceDoc.documentId}`)
    console.log(`[stories] Calling MinIO-based story derivation...`)
    
    // Use MinIO-based story derivation
    const storyAgent = new FeatureToStoryAgent()
    const stories = await storyAgent.deriveStoriesFromDocuments(
      featureDoc.documentId,
      governanceDoc.documentId,
      projectId,
      epicId,
      documentStore
    )

    console.log(`[stories] Total stories generated: ${stories.length}`)

    return res.json({
      ok: true,
      featureId,
      stories,
    })
  } catch (err) {
    console.error('Story generation failed', err)
    return res.status(500).json({
      ok: false,
      error: 'story generation failed',
      details: (err as Error).message,
    })
  }
})

// DELETE /features/:featureId/stories
// Delete generated stories for a feature
app.delete('/features/:featureId/stories', expensiveOperationLimiter, async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params
    const { storyPath } = req.body

    if (!storyPath) {
      return res.status(400).json({
        ok: false,
        error: 'storyPath is required',
      })
    }

    const fullPath = path.join(process.cwd(), storyPath)
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      console.log(`[stories] deleted stories for feature=${featureId}`)
      return res.json({
        ok: true,
        message: 'stories deleted',
      })
    } else {
      return res.status(404).json({
        ok: false,
        error: 'story file not found',
      })
    }
  } catch (err) {
    console.error('Story deletion failed', err)
    return res.status(500).json({
      ok: false,
      error: 'story deletion failed',
      details: (err as Error).message,
    })
  }
})

app.listen(port, () => {
  // Keep the log explicit for developers running the container
  console.log(`muse-api listening on port ${port}`)
})
