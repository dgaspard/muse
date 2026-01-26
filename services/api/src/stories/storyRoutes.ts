import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { FeatureToStoryAgent } from './FeatureToStoryAgent'
import { getDocumentStore } from '../storage/documentStoreFactory'

const router = Router()

// Rate limit for expensive story derivation operations
const storyDerivationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 story derivations per windowMs
  message: 'Too many story derivation requests from this IP, please try again later.',
})

/**
 * POST /api/stories/derive-from-documents
 * 
 * Derive user stories from feature and governance documents stored in MinIO.
 * 
 * Body:
 * {
 *   "featureDocumentId": "4c989d68ea38...",
 *   "governanceDocumentId": "5d123a45fb29...",
 *   "projectId": "myproject",
 *   "epicId": "myproject-epic-01" // optional
 * }
 */
router.post('/derive-from-documents', storyDerivationLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { featureDocumentId, governanceDocumentId, projectId, epicId } = req.body

    // Validation
    if (!featureDocumentId || typeof featureDocumentId !== 'string') {
      res.status(400).json({ error: 'featureDocumentId is required' })
      return
    }
    if (!governanceDocumentId || typeof governanceDocumentId !== 'string') {
      res.status(400).json({ error: 'governanceDocumentId is required' })
      return
    }
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required' })
      return
    }

    console.log(`[storyRoutes] Deriving stories from documents: feature=${featureDocumentId}, governance=${governanceDocumentId}, project=${projectId}`)

    // Get document store (MinIO/S3 or filesystem based on env)
    const documentStore = getDocumentStore()

    // Derive stories
    const agent = new FeatureToStoryAgent()
    const stories = await agent.deriveStoriesFromDocuments(
      featureDocumentId,
      governanceDocumentId,
      projectId,
      epicId,
      documentStore,
    )

    console.log(`[storyRoutes] Successfully generated ${stories.length} stories`)

    res.json({
      success: true,
      storiesGenerated: stories.length,
      stories,
    })
  } catch (error) {
    console.error('[storyRoutes] Error deriving stories from documents:', error)
    const err = error as Error
    res.status(500).json({
      error: 'Failed to derive stories',
      message: err.message,
    })
  }
})

export default router
