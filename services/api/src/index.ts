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
import { FeatureGenerationAgent } from './semantic/FeatureGenerationAgent'
import { UserStoryGenerationAgent } from './semantic/UserStoryGenerationAgent'
import { registerMCPTools, initializeMCPServer } from './mcp'

const app = express()

// Initialize converter registry for Markdown generation
const converterRegistry = new ConverterRegistry()

// Parse JSON request bodies for future endpoints
// Increased limit to 50MB to handle large governance documents
app.use(express.json({ limit: '50mb' }))
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

// Initialize MCP tool server for EPIC-003
initializeMCPServer().catch((err) => {
  console.error('[MCP] Initialization failed', err)
})

// Register MCP tools as HTTP endpoints for Copilot access
const mcpTools = registerMCPTools()

// MCP Tool endpoints (read-only: artifact retrieval)
app.get('/mcp/epics', async (_req: Request, res: Response) => {
  try {
    const result = await mcpTools['list_derived_epics'].handler()
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/epics/:epicId', async (req: Request, res: Response) => {
  try {
    const result = await mcpTools['get_derived_epic'].handler({ epic_id: req.params.epicId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/features', async (req: Request, res: Response) => {
  try {
    const epicId = req.query.epic_id as string | undefined
    const result = await mcpTools['list_derived_features'].handler({ epic_id: epicId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/features/:featureId', async (req: Request, res: Response) => {
  try {
    const result = await mcpTools['get_derived_feature'].handler({ feature_id: req.params.featureId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/stories', async (req: Request, res: Response) => {
  try {
    const featureId = req.query.feature_id as string | undefined
    const epicId = req.query.epic_id as string | undefined
    const result = await mcpTools['list_derived_user_stories'].handler({ feature_id: featureId, epic_id: epicId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/stories/:storyId', async (req: Request, res: Response) => {
  try {
    const result = await mcpTools['get_derived_user_story'].handler({ story_id: req.params.storyId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/prompts', async (req: Request, res: Response) => {
  try {
    const storyId = req.query.story_id as string | undefined
    const result = await mcpTools['list_derived_prompts'].handler({ story_id: storyId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.get('/mcp/prompts/:promptId', async (req: Request, res: Response) => {
  try {
    const result = await mcpTools['get_derived_prompt'].handler({ prompt_id: req.params.promptId })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.post('/mcp/validate-lineage', async (req: Request, res: Response) => {
  try {
    const { epic_id } = req.body
    if (!epic_id) {
      return res.status(400).json({ success: false, error: 'epic_id is required' })
    }
    const result = await mcpTools['validate_artifact_lineage'].handler({ epic_id })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

// MCP Tool endpoints (write: materialization and GitHub integration)
app.post('/mcp/materialize', expensiveOperationLimiter, async (_req: Request, res: Response) => {
  try {
    const result = await mcpTools['materialize_artifacts'].handler()
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

app.post('/mcp/commit', expensiveOperationLimiter, async (req: Request, res: Response) => {
  try {
    const { branch_name, pr_title, pr_body, labels, reviewers } = req.body

    if (!branch_name || !pr_title || !pr_body) {
      return res.status(400).json({
        success: false,
        error: 'branch_name, pr_title, and pr_body are required',
      })
    }

    const result = await mcpTools['commit_artifacts_to_github'].handler({
      branch_name,
      pr_title,
      pr_body,
      labels,
      reviewers,
    })

    return res.json(result)
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message })
  }
})

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
      `[pipeline] project=${projectId} document=${pipelineOutput.document.document_id} epic=${pipelineOutput.epics[0]?.epic_id} features=${pipelineOutput.features.length} stories=${pipelineOutput.stories.length} validation=${pipelineOutput.validation.isValid}`,
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
    const { feature, epic, governanceContent, projectId } = req.body

    console.log(`[UserStories] Request for feature=${featureId}`)
    console.log(`[UserStories] epic=${epic?.epic_id}`)
    console.log(`[UserStories] projectId=${projectId}`)

    // Validate inputs
    if (!feature || typeof feature !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'feature object is required in request body',
      })
    }

    if (!epic || typeof epic !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'epic object is required in request body',
      })
    }

    if (!governanceContent || typeof governanceContent !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'governanceContent string is required in request body',
      })
    }

    if (!projectId) {
      return res.status(400).json({
        ok: false,
        error: 'projectId is required in request body',
      })
    }

    console.log(`[UserStories] Generating user stories using UserStoryGenerationAgent`)

    // Use UserStoryGenerationAgent with strict prompt
    const agent = new UserStoryGenerationAgent()
    const stories = await agent.run(feature, epic, governanceContent)

    console.log(`[UserStories] Generated ${stories.length} stories for feature=${featureId}`)

    return res.json({
      ok: true,
      featureId,
      stories,
    })
  } catch (err) {
    console.error('[UserStories] Story generation failed', err)
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

// POST /stories/:storyId/generate-prompt
// Generate implementation PR prompt from a user story
// Returns interpolated prompt template with story data
app.post('/stories/:storyId/generate-prompt', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params
    const {
      story,
      feature,
      epic,
      governanceMarkdown,
      repoUrl,
      defaultBranch,
    } = req.body

    // Validate inputs
    if (!story || typeof story !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'story object is required',
      })
    }

    // Read prompt template
    // Resolve prompt template path within prompts/Epic_001_* directory
    const promptTemplatePath = path.join(
      process.cwd(),
      '..',
      '..',
      'prompts',
      'Epic_001_Create_Epics_Features_Stories_AIPrompts',
      'Prompt-muse-User-Story-Implementation-PR.md'
    )

    if (!fs.existsSync(promptTemplatePath)) {
      return res.status(404).json({
        ok: false,
        error: 'Prompt template not found',
      })
    }

    const template = fs.readFileSync(promptTemplatePath, 'utf-8')

    // Extract acceptance criteria from story
    const acceptanceCriteria = Array.isArray(story.acceptance_criteria)
      ? story.acceptance_criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
      : 'N/A'

    // Format governance references
    const governanceReferences = Array.isArray(story.governance_references)
      ? story.governance_references
          .map((ref: unknown) => {
            if (typeof ref === 'object' && ref !== null) {
              const r = ref as Record<string, unknown>
              return `- ${r.filename} (#${r.document_id})`
            }
            return `- ${ref}`
          })
          .join('\n')
      : 'N/A'

    // Extract governance excerpt (first 2000 chars)
    const governanceExcerpt = governanceMarkdown
      ? governanceMarkdown.slice(0, 2000) + (governanceMarkdown.length > 2000 ? '\n\n[... content truncated ...]' : '')
      : 'No governance context provided'

    // Normalize user story role (prevent reserved 'system' value)
    let normalizedRole = story.role || 'user'
    if (normalizedRole.toLowerCase() === 'system') {
      normalizedRole = 'authorized system service'
    }

    // Interpolate template variables
    const variables: Record<string, string> = {
      repo_url: repoUrl || 'https://github.com/dgaspard/muse',
      default_branch: defaultBranch || 'main',
      current_branch: `muse/${storyId}-implementation`,
      user_story_id: story.story_id || storyId,
      user_story_title: story.title || 'Untitled Story',
      user_story_role: normalizedRole,
      user_story_capability: story.capability || 'N/A',
      user_story_benefit: story.benefit || 'N/A',
      acceptance_criteria: acceptanceCriteria,
      feature_id: feature?.feature_id || 'N/A',
      feature_title: feature?.title || 'N/A',
      epic_id: epic?.epic_id || 'N/A',
      epic_title: epic?.title || 'N/A',
      governance_references: governanceReferences,
      governance_markdown_excerpt: governanceExcerpt,
      languages: 'TypeScript',
      frameworks: 'Next.js, Express.js',
      test_frameworks: 'Vitest, Jest',
    }

    // Replace all {{variable}} placeholders
    let interpolated = template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      interpolated = interpolated.replace(placeholder, value)
    }

    console.log(`[Prompt] Generated implementation prompt for story=${storyId}`)

    return res.json({
      ok: true,
      storyId,
      prompt: interpolated,
    })
  } catch (err) {
    console.error('[Prompt] Prompt generation failed', err)
    return res.status(500).json({
      ok: false,
      error: 'prompt generation failed',
      details: (err as Error).message,
    })
  }
})

// POST /epics/:epicId/generate-features
// On-demand feature generation from an approved Epic
// Request body must include epic and governance summaries
app.post('/epics/:epicId/generate-features', async (req: Request, res: Response) => {
  try {
    const { epicId } = req.params
    const { epic, summaries } = req.body

    if (!epic) {
      return res.status(400).json({
        ok: false,
        error: 'epic object is required in request body',
      })
    }

    if (!summaries || !Array.isArray(summaries)) {
      return res.status(400).json({
        ok: false,
        error: 'summaries array is required in request body',
      })
    }

    if (epic.epic_id !== epicId) {
      return res.status(400).json({
        ok: false,
        error: 'epic.epic_id does not match URL parameter epicId',
      })
    }

    console.log(`[FeatureGeneration] Generating features for epic=${epicId} from ${summaries.length} summaries`)

    const agent = new FeatureGenerationAgent()
    const features = await agent.run(epic, summaries)

    console.log(
      `[FeatureGeneration] Generated ${features.length} features for epic=${epicId}`,
    )

    return res.json({
      ok: true,
      epic_id: epicId,
      feature_count: features.length,
      features,
    })
  } catch (error) {
    console.error('[FeatureGeneration] Error generating features:', error)
    return res.status(500).json({
      ok: false,
      error: 'feature generation failed',
      details: (error as Error).message,
    })
  }
})

// POST /features/:featureId/add-to-backlog
// Add a feature with its stories and prompts to the EPIC backlog file
app.post('/features/:featureId/add-to-backlog', expensiveOperationLimiter, async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params
    const { feature, epic, stories, prompts } = req.body

    if (!feature || !epic) {
      return res.status(400).json({
        ok: false,
        error: 'feature and epic objects are required',
      })
    }

    // Validate epic_id format
    const epicId = epic.epic_id
    if (!epicId || typeof epicId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'epic.epic_id is required and must be a string',
      })
    }

    // Construct backlog file path
    // In container, __dirname is /app/dist → resolve to /app/backlog
    const backlogDir = path.resolve(__dirname, '../backlog')
    const epicFileName = `${epicId}: ${epic.title}.md`
    const epicFilePath = path.join(backlogDir, epicFileName)

    // Ensure backlog directory exists
    await fs.promises.mkdir(backlogDir, { recursive: true })

    // Check if epic file exists
    let epicContent = ''
    const epicFileExists = fs.existsSync(epicFilePath)

    if (!epicFileExists) {
      // Create new epic file
      epicContent = `# ${epic.title}

**Epic ID:** ${epicId}

## Objective
${epic.objective || 'TBD'}

## Success Criteria
${(epic.success_criteria || []).map((c: string) => `- ${c}`).join('\n') || '- TBD'}

## Features

`
    } else {
      // Read existing epic file
      epicContent = await fs.promises.readFile(epicFilePath, 'utf-8')
    }

    // Format feature section
    const featureSection = `### Feature: ${feature.title}

**Feature ID:** ${feature.feature_id}

**Description:** ${feature.description}

**Acceptance Criteria:**
${(feature.acceptance_criteria || []).map((c: string) => `- ${c}`).join('\n') || '- TBD'}

`

    // Format stories section if available, with acceptance criteria
    let storiesSection = ''
    if (stories && Array.isArray(stories) && stories.length > 0) {
      storiesSection = `**User Stories:**
${stories.map((story: any) => {
  const criteria = Array.isArray(story.acceptance_criteria) && story.acceptance_criteria.length
    ? `  - Acceptance Criteria:\n${story.acceptance_criteria.map((c: string) => `    - ${c}`).join('\n')}`
    : '  - Acceptance Criteria:\n    - TBD'
  return `- **${story.story_id}**: As a ${story.role}, I want ${story.capability}, so that ${story.benefit}.\n${criteria}`
}).join('\n')}

`
    }

    // Format prompts section if available, include prompt content block
    let promptsSection = ''
    if (prompts && Array.isArray(prompts) && prompts.length > 0) {
      promptsSection = `**AI Prompts:**
${prompts.map((prompt: any) => {
  const role = prompt.role ? `\n  - Role: ${prompt.role}` : ''
  const generated = prompt.generated_at ? `\n  - Generated: ${prompt.generated_at}` : ''
  const content = prompt.content ? `\n  - Content:\n\n\n${'```'}\n${prompt.content}\n${'```'}` : ''
  return `- **${prompt.prompt_id}** (Story: ${prompt.story_id})\n  - Task: ${prompt.task}${role}${generated}${content}`
}).join('\n')}

`
    }

    // Append feature to epic file
    const newFeatureContent = featureSection + storiesSection + promptsSection

    if (epicFileExists && !epicContent.includes(feature.feature_id)) {
      // Check if there's a Features section, if not add one
      if (!epicContent.includes('## Features')) {
        epicContent += '\n## Features\n\n'
      }
      epicContent += newFeatureContent
    } else if (!epicFileExists) {
      epicContent += newFeatureContent
    } else {
      return res.status(409).json({
        ok: false,
        error: `Feature ${feature.feature_id} already exists in ${epicFileName}`,
      })
    }

    // Write back to file
    await fs.promises.writeFile(epicFilePath, epicContent, 'utf-8')

    console.log(`[backlog] added feature ${featureId} to ${epicFileName}`)

    return res.json({
      ok: true,
      message: `Feature added to backlog`,
      epicFile: epicFileName,
      filePath: path.relative(process.cwd(), epicFilePath),
    })
  } catch (err) {
    console.error('Failed to add feature to backlog:', err)
    return res.status(500).json({
      ok: false,
      error: 'Failed to add feature to backlog',
      details: (err as Error).message,
    })
  }
})

app.listen(port, () => {
  // Keep the log explicit for developers running the container
  console.log(`muse-api listening on port ${port}`)
})

