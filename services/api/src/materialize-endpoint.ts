import { Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

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
  feature: FeatureRequest;
  epic: EpicRequest;
  stories?: StoryRequest[];
  prompts?: PromptRequest[];
}
/**
 * POST /features/:featureId/materialize
 * Materialize feature, stories, and prompts to /docs per EPIC-003 governance.
 * Creates individual YAML files for epics, features, stories and markdown for prompts.
 */
export const materializeFeatureHandler = async (req: Request<unknown, unknown, MaterializeRequestBody>, res: Response) => {
  try {
    const { feature, epic, stories, prompts } = req.body

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

    // Create docs directory structure per EPIC-003
    const docsDir = path.resolve(__dirname, '../docs')
    const epicsDir = path.join(docsDir, 'epics')
    const featuresDir = path.join(docsDir, 'features')
    const storiesDir = path.join(docsDir, 'stories')
    const promptsDir = path.join(docsDir, 'prompts')

    // Ensure all directories exist
    await Promise.all([
      fs.promises.mkdir(epicsDir, { recursive: true }),
      fs.promises.mkdir(featuresDir, { recursive: true }),
      fs.promises.mkdir(storiesDir, { recursive: true }),
      fs.promises.mkdir(promptsDir, { recursive: true }),
    ])

    const materialized = {
      epicFile: null as string | null,
      featureFile: null as string | null,
      storyFiles: [] as string[],
      promptFiles: [] as string[],
    }

    // 1. Write epic YAML to /docs/epics/{EPIC-ID}.yaml
    const epicYaml = `id: ${epicId}
title: "${(epic.title || '').replace(/"/g, '\\"')}"
objective: "${(epic.objective || '').replace(/"/g, '\\"')}"
success_criteria:
${(epic.success_criteria || []).map((c: string) => `  - "${c.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
governance_references:
${(epic.governance_references || []).map((r: string) => `  - "${r.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
created_at: "${new Date().toISOString()}"
`
    // Generate human-readable filename from epic title
    const epicTitleSlug = (epic.title || epicId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
    const epicFileName = `${epicTitleSlug}.yaml`
    const epicFilePath = path.join(epicsDir, epicFileName)
    await fs.promises.writeFile(epicFilePath, epicYaml, 'utf-8')
    materialized.epicFile = path.relative(process.cwd(), epicFilePath)

    // 2. Write feature YAML to /docs/features/{FEATURE-ID}.yaml
    const featureYaml = `id: ${feature.feature_id}
title: "${(feature.title || '').replace(/"/g, '\\"')}"
epic_id: ${epicId}
description: "${(feature.description || '').replace(/"/g, '\\"')}"
acceptance_criteria:
${(feature.acceptance_criteria || []).map((c: string) => `  - "${c.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
governance_references:
${(feature.governance_references || []).map((r: string) => `  - "${r.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
user_story_ids:
${(stories && stories.length > 0 ? stories.map((s: StoryRequest) => `  - ${s.story_id}`).join('\n') : '  - []')}
created_at: "${new Date().toISOString()}"
`
    // Generate human-readable filename from feature title
    const titleSlug = (feature.title || feature.feature_id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
    const featureFileName = `${titleSlug}.yaml`
    const featureFilePath = path.join(featuresDir, featureFileName)
    await fs.promises.writeFile(featureFilePath, featureYaml, 'utf-8')
    materialized.featureFile = path.relative(process.cwd(), featureFilePath)

    // 3. Write each user story YAML to /docs/stories/{STORY-ID}.yaml
    if (stories && Array.isArray(stories) && stories.length > 0) {
      for (const story of stories) {
        const storyYaml = `id: ${story.story_id}
title: "${(story.title || '').replace(/"/g, '\\"')}"
epic_id: ${epicId}
feature_id: ${feature.feature_id}
role: "${(story.role || '').replace(/"/g, '\\"')}"
capability: "${(story.capability || '').replace(/"/g, '\\"')}"
benefit: "${(story.benefit || '').replace(/"/g, '\\"')}"
acceptance_criteria:
${(story.acceptance_criteria || []).map((c: string) => `  - "${c.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
governance_references:
${(story.governance_references || []).map((r: string) => `  - "${r.replace(/"/g, '\\"')}"`).join('\n') || '  - []'}
created_at: "${story.created_at || new Date().toISOString()}"
`
        // Generate human-readable filename from story title
        const storyTitleSlug = (story.title || story.story_id)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50)
        const storyFileName = `${storyTitleSlug}.yaml`
        const storyFilePath = path.join(storiesDir, storyFileName)
        await fs.promises.writeFile(storyFilePath, storyYaml, 'utf-8')
        materialized.storyFiles.push(path.relative(process.cwd(), storyFilePath))
      }
    }

    // 4. Write each AI prompt markdown to /docs/prompts/{STORY-ID}.prompt.md
    if (prompts && Array.isArray(prompts) && prompts.length > 0) {
      for (const prompt of prompts) {
        const promptMarkdown = `# AI Prompt: ${prompt.prompt_id}

**Story ID:** ${prompt.story_id}
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
        // Generate human-readable filename from story title (prompts are linked to stories)
        // Find the corresponding story for this prompt
        const correspondingStory = stories?.find(s => s.story_id === prompt.story_id)
        const promptTitleSlug = correspondingStory?.title
          ? correspondingStory.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50)
          : prompt.story_id
        const promptFileName = `${promptTitleSlug}.prompt.md`
        const promptFilePath = path.join(promptsDir, promptFileName)
        await fs.promises.writeFile(promptFilePath, promptMarkdown, 'utf-8')
        materialized.promptFiles.push(path.relative(process.cwd(), promptFilePath))
      }
    }

    console.log(`[materialize] epic=${epicId} feature=${feature.feature_id} stories=${stories?.length || 0} prompts=${prompts?.length || 0}`)

    return res.json({
      ok: true,
      message: `Artifacts materialized to /docs per EPIC-003`,
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
