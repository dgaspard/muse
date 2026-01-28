import { Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { 
  getProjectPaths, 
  getEpicPaths, 
  getFeaturePaths, 
  getStoryPaths,
  getPromptPath
} from './utils/projectPaths'

/**
 * Safely sanitize a string for use in filenames and YAML content
 * Prevents ReDoS by using simple, bounded operations instead of complex regex
 */
function sanitizeString(input: string, maxLength: number = 200): string {
  if (typeof input !== 'string') {
    return ''
  }
  // Limit length first to prevent excessive processing
  const truncated = input.substring(0, maxLength)
  // Use simple character-by-character filtering instead of regex
  let result = ''
  for (let i = 0; i < truncated.length; i++) {
    const char = truncated[i]
    // Only allow safe characters
    if ((char >= 'a' && char <= 'z') || 
        (char >= 'A' && char <= 'Z') || 
        (char >= '0' && char <= '9') || 
        char === ' ' || char === '-' || char === '_') {
      result += char
    }
  }
  return result
}

/**
 * Escape quotes safely without regex
 */
function escapeQuotes(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  // Use split/join which is safer than regex
  return input.split('"').join('\\"')
}

/**
 * Create a safe slug for filenames
 * Completely regex-free to prevent any ReDoS vulnerabilities
 */
function createSlug(input: string, maxLength: number = 50): string {
  const sanitized = sanitizeString(input, 100)
  const lower = sanitized.toLowerCase()
  // Replace spaces with hyphens and remove duplicate hyphens
  let slug = ''
  let lastWasHyphen = false
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i]
    if (char === ' ' || char === '-' || char === '_') {
      if (!lastWasHyphen && slug.length > 0) {
        slug += '-'
        lastWasHyphen = true
      }
    } else {
      slug += char
      lastWasHyphen = false
    }
  }
  // Remove leading/trailing hyphens without regex
  let startIndex = 0
  let endIndex = slug.length
  while (startIndex < endIndex && slug[startIndex] === '-') {
    startIndex++
  }
  while (endIndex > startIndex && slug[endIndex - 1] === '-') {
    endIndex--
  }
  slug = slug.substring(startIndex, endIndex)
  return slug.substring(0, maxLength)
}

/**
 * Epic request interface
 */
interface EpicRequest {
  epic_id: string;
  title: string;
  objective: string;
  success_criteria?: string[];
  governance_references?: string[];
}

/**
 * Feature request interface
 */
interface FeatureRequest {
  feature_id: string;
  title: string;
  description: string;
  acceptance_criteria?: string[];
  governance_references?: string[];
}

/**
 * Story request interface
 */
interface StoryRequest {
  story_id: string;
  title: string;
  role: string;
  capability: string;
  benefit: string;
  acceptance_criteria?: string[];
  governance_references?: string[];
  created_at?: string;
}

/**
 * Prompt request interface
 */
interface PromptRequest {
  prompt_id: string;
  story_id: string;
  role?: string;
  task?: string;
  template?: string;
  content?: string;
  generated_at?: string;
}

/**
 * Materialization request body
 */
interface MaterializeRequestBody {
  projectId: string; // Required: project identifier
  feature: FeatureRequest;
  epic: EpicRequest;
  stories?: StoryRequest[];
  prompts?: PromptRequest[];
}
/**
 * POST /features/:featureId/materialize
 * Materialize feature, stories, and prompts to /docs/projects/{projectId}/ per EPIC-003 governance.
 * Creates hierarchical directory structure with YAML files for epics, features, stories and markdown for prompts.
 */
export const materializeFeatureHandler = async (req: Request<unknown, unknown, MaterializeRequestBody>, res: Response) => {
  try {
    const { projectId, feature, epic, stories, prompts } = req.body

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'projectId is required and must be a string',
      })
    }

    if (!feature || !epic) {
      return res.status(400).json({
        ok: false,
        error: 'feature and epic objects are required',
      })
    }

    const epicId = epic.epic_id
    if (!epicId || typeof epicId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'epic.epic_id is required and must be a string',
      })
    }

    const featureId = feature.feature_id
    if (!featureId || typeof featureId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'feature.feature_id is required and must be a string',
      })
    }

    // Get repo root (assume we're in /app/dist/materialize-endpoint.js)
    const repoRoot = path.resolve(__dirname, '..')

    // Create hierarchical directory structure using new path utilities
    const projectPaths = getProjectPaths(repoRoot, projectId)
    const epicPaths = getEpicPaths(repoRoot, projectId, epicId)
    const featurePaths = getFeaturePaths(repoRoot, projectId, epicId, featureId)

    // Ensure all base directories exist
    await Promise.all([
      fs.promises.mkdir(projectPaths.governance, { recursive: true }),
      fs.promises.mkdir(epicPaths.epicRoot, { recursive: true }),
      fs.promises.mkdir(featurePaths.featureRoot, { recursive: true }),
    ])

    const materialized = {
      epicFile: null as string | null,
      featureFile: null as string | null,
      storyFiles: [] as string[],
      promptFiles: [] as string[],
    }

    // 1. Write epic YAML to /docs/projects/{projectId}/epics/{epicId}/epic.yaml
    const epicYaml = `id: ${epicId}
title: "${escapeQuotes(epic.title || '')}"
objective: "${escapeQuotes(epic.objective || '')}"
success_criteria:
${(epic.success_criteria || []).map((c: string) => `  - "${escapeQuotes(c)}"`).join('\n') || '  - []'}
governance_references:
${(epic.governance_references || []).map((r: string) => `  - "${escapeQuotes(r)}"`).join('\n') || '  - []'}
created_at: "${new Date().toISOString()}"
`
    await fs.promises.writeFile(epicPaths.epicFile, epicYaml, 'utf-8')
    materialized.epicFile = path.relative(repoRoot, epicPaths.epicFile)

    // 2. Write feature YAML to /docs/projects/{projectId}/epics/{epicId}/features/{featureId}/feature.yaml
    const featureYaml = `id: ${featureId}
title: "${escapeQuotes(feature.title || '')}"
epic_id: ${epicId}
description: "${escapeQuotes(feature.description || '')}"
acceptance_criteria:
${(feature.acceptance_criteria || []).map((c: string) => `  - "${escapeQuotes(c)}"`).join('\n') || '  - []'}
governance_references:
${(feature.governance_references || []).map((r: string) => `  - "${escapeQuotes(r)}"`).join('\n') || '  - []'}
user_story_ids:
${(stories && stories.length > 0 ? stories.map((s: StoryRequest) => `  - ${s.story_id}`).join('\n') : '  - []')}
created_at: "${new Date().toISOString()}"
`
    await fs.promises.writeFile(featurePaths.featureFile, featureYaml, 'utf-8')
    materialized.featureFile = path.relative(repoRoot, featurePaths.featureFile)

    // 3. Write each user story YAML to /docs/projects/{projectId}/epics/{epicId}/features/{featureId}/userstories/{storyId}/story.yaml
    if (stories && Array.isArray(stories) && stories.length > 0) {
      for (const story of stories) {
        const storyPaths = getStoryPaths(repoRoot, projectId, epicId, featureId, story.story_id)
        await fs.promises.mkdir(storyPaths.storyRoot, { recursive: true })

        const storyYaml = `id: ${story.story_id}
title: "${escapeQuotes(story.title || '')}"
epic_id: ${epicId}
feature_id: ${featureId}
role: "${escapeQuotes(story.role || '')}"
capability: "${escapeQuotes(story.capability || '')}"
benefit: "${escapeQuotes(story.benefit || '')}"
acceptance_criteria:
${(story.acceptance_criteria || []).map((c: string) => `  - "${escapeQuotes(c)}"`).join('\n') || '  - []'}
governance_references:
${(story.governance_references || []).map((r: string) => `  - "${escapeQuotes(r)}"`).join('\n') || '  - []'}
created_at: "${story.created_at || new Date().toISOString()}"
`
        await fs.promises.writeFile(storyPaths.storyFile, storyYaml, 'utf-8')
        materialized.storyFiles.push(path.relative(repoRoot, storyPaths.storyFile))
      }
    }

    // 4. Write each AI prompt markdown to /docs/projects/{projectId}/epics/{epicId}/features/{featureId}/userstories/{storyId}/aiprompts/{promptId}.md
    if (prompts && Array.isArray(prompts) && prompts.length > 0) {
      for (const prompt of prompts) {
        // Find the story ID from the prompt
        const storyId = prompt.story_id
        if (!storyId) {
          console.warn(`[materialize] Prompt ${prompt.prompt_id} has no story_id, skipping`)
          continue
        }

        const promptPath = getPromptPath(repoRoot, projectId, epicId, featureId, storyId, prompt.prompt_id)
        const promptDir = path.dirname(promptPath)
        await fs.promises.mkdir(promptDir, { recursive: true })

        const promptMarkdown = `# AI Prompt: ${prompt.prompt_id}

**Story ID:** ${storyId}
**Role:** ${prompt.role || 'N/A'}
**Task:** ${prompt.task || 'N/A'}
**Template:** ${prompt.template || 'custom'}
**Generated:** ${prompt.generated_at || new Date().toISOString()}

## Prompt Content

\`\`\`
${prompt.content || ''}
\`\`\`

---
*This prompt was generated at ${prompt.generated_at || new Date().toISOString()} and is immutable at retrieval time.*
`
        await fs.promises.writeFile(promptPath, promptMarkdown, 'utf-8')
        materialized.promptFiles.push(path.relative(repoRoot, promptPath))
      }
    }

    console.log(`[materialize] project=${projectId} epic=${epicId} feature=${featureId} stories=${stories?.length || 0} prompts=${prompts?.length || 0}`)

    return res.json({
      ok: true,
      message: `Artifacts materialized to /docs/projects/${projectId}/ per EPIC-003`,
      materialized,
    })
  } catch (err) {
    console.error('Failed to materialize artifacts:', err)
    return res.status(500).json({
      ok: false,
      error: 'Failed to materialize artifacts',
      details: (err as Error).message,
    })
  }
}
