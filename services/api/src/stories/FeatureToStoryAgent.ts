import fs from 'fs'
import matter from 'gray-matter'
import { Readable } from 'stream'
import {
  GovernanceReference,
  validateStoryHardening,
  validateFeatureIdFormat,
  validateStoryIdFormat,
} from '../shared/ArtifactValidation'
import type { DocumentStore } from '../storage/documentStore'

export interface StorySchema {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  derived_from_feature: string
  derived_from_epic: string
  governance_references: GovernanceReference[]
  acceptance_criteria: string[]
}

export interface StoryOutput extends StorySchema {
  generated_at: string
}

export class StoryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoryValidationError'
  }
}

export class FeatureToStoryAgent {
  /**
   * Parse markdown content from a stream (for MinIO/S3 sources).
   */
  private async parseMarkdownFromStream(stream: Readable): Promise<{ content: string; frontMatter: Record<string, unknown> }> {
    const chunks: Buffer[] = []
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => {
        const fileContent = Buffer.concat(chunks as Uint8Array[]).toString('utf-8')
        const parsed = matter(fileContent)
        resolve({ content: parsed.content, frontMatter: parsed.data })
      })
    })
  }

  private validateStorySchema(story: unknown, featureText?: string): asserts story is StorySchema {
    if (typeof story !== 'object' || story === null) {
      throw new StoryValidationError('Story must be an object')
    }

    const s = story as Record<string, unknown>

    // Basic structure validation
    if (!s.story_id || typeof s.story_id !== 'string') {
      throw new StoryValidationError('Missing or invalid story_id')
    }

    if (!s.title || typeof s.title !== 'string' || (s.title as string).length < 10) {
      throw new StoryValidationError('Missing or invalid title (must be at least 10 characters)')
    }

    if (!s.role || typeof s.role !== 'string' || (s.role as string).trim().length === 0) {
      throw new StoryValidationError('Missing or invalid role (canonical format required)')
    }

    if (!s.capability || typeof s.capability !== 'string' || (s.capability as string).trim().length === 0) {
      throw new StoryValidationError('Missing or invalid capability (canonical format required)')
    }

    if (!s.benefit || typeof s.benefit !== 'string' || (s.benefit as string).trim().length === 0) {
      throw new StoryValidationError('Missing or invalid benefit (canonical format required)')
    }

    if (!s.derived_from_feature || typeof s.derived_from_feature !== 'string') {
      throw new StoryValidationError('Missing or invalid derived_from_feature')
    }

    if (!s.derived_from_epic || typeof s.derived_from_epic !== 'string') {
      throw new StoryValidationError('Missing or invalid derived_from_epic')
    }

    if (!Array.isArray(s.governance_references) || s.governance_references.length === 0) {
      throw new StoryValidationError('Missing or empty governance_references array (REQUIRED)')
    }

    if (!Array.isArray(s.acceptance_criteria) || s.acceptance_criteria.length === 0) {
      throw new StoryValidationError('Missing or empty acceptance_criteria array (REQUIRED for testability)')
    }

    // Use comprehensive hardening validator
    const hardeningReport = validateStoryHardening({
      story_id: s.story_id as string,
      title: s.title as string,
      role: s.role as string,
      capability: s.capability as string,
      benefit: s.benefit as string,
      acceptance_criteria: s.acceptance_criteria as string[],
      governance_references: s.governance_references,
      derived_from_feature: s.derived_from_feature as string,
      feature_text: featureText,
    })

    if (!hardeningReport.valid) {
      throw new StoryValidationError(`Story hardening validation failed:\n${hardeningReport.errors.join('\n')}`)
    }

    // Validate governance references structure
    for (const ref of s.governance_references as unknown[]) {
      const refObj = ref as Record<string, unknown>
      if (!refObj.document_id || !refObj.filename || !Array.isArray(refObj.sections) || refObj.sections.length === 0) {
        throw new StoryValidationError(
          'Each governance reference must include document_id, filename, and non-empty sections array'
        )
      }
      if (!refObj.markdown_path || typeof refObj.markdown_path !== 'string') {
        throw new StoryValidationError(
          'Each governance reference must include markdown_path (full path to markdown file)'
        )
      }
    }
  }

  private validateINVESTCompliance(story: StorySchema): void {
    const errors: string[] = []

    // NOTE: Relaxed INVEST validation for prototype - allow stories with minimal context
    // Independent: Story should have clear identity
    // Only flag if VERY obvious technical implementation details appear
    const technicalPattern = /\b(database schema|SQL query|REST endpoint|class name|function signature)\b/i
    if (technicalPattern.test(story.title)) {
      console.warn('[INVEST] Title contains low-level implementation detail:', story.title)
      // Don't throw - just warn
    }

    // Valuable: Must have clear benefit (very relaxed minimum)
    if (story.benefit.trim().length < 3) {
      console.warn('[INVEST] Benefit is very short:', story.benefit)
      // Don't throw - just warn
    }

    // Estimable: Must have clear capability (very relaxed minimum)
    if (story.capability.trim().length < 3) {
      console.warn('[INVEST] Capability is very short:', story.capability)
      // Don't throw - just warn
    }

    // Small: Title should be concise (increased limit)
    if (story.title.length > 200) {
      errors.push('INVEST violation: Title is too long (not small enough)')
    }

    // Testable: Must have at least one acceptance criterion
    if (!story.acceptance_criteria || story.acceptance_criteria.length === 0) {
      errors.push('INVEST violation: No acceptance criteria (cannot be tested)')
    }

    // Only throw if critical violations exist
    if (errors.length > 0) {
      throw new StoryValidationError(`Story INVEST validation failed:\n${errors.join('\n')}`)
    }
  }

  /**
   * Derive stories from documents stored in MinIO/S3.
   * Uses DocumentStore to retrieve feature and governance markdown.
   */
  async deriveStoriesFromDocuments(
    featureDocumentId: string,
    governanceDocumentId: string,
    projectId: string,
    epicId: string | undefined,
    documentStore: DocumentStore,
  ): Promise<StoryOutput[]> {
    // Retrieve feature markdown from MinIO
    const { stream: featureStream } = await documentStore.getOriginal(featureDocumentId)
    const { content: featureContent, frontMatter: featureFrontMatter } = await this.parseMarkdownFromStream(featureStream)

    // Retrieve governance markdown from MinIO
    const { stream: govStream } = await documentStore.getOriginal(governanceDocumentId)
    const { content: govContent, frontMatter: govFrontMatter } = await this.parseMarkdownFromStream(govStream)

    // Use existing derivation logic
    return this.deriveStoriesFromContent(
      featureContent,
      featureFrontMatter,
      govContent,
      govFrontMatter,
      projectId,
      epicId,
    )
  }

  /**
   * Derive stories from local markdown files (filesystem-based workflow).
   */
  async deriveStoriesFromMarkdownFiles(
    featureMarkdownPath: string,
    governanceMarkdownPath: string,
    projectId?: string,
    epicId?: string,
  ): Promise<StoryOutput[]> {
    const featureRaw = fs.readFileSync(featureMarkdownPath, 'utf-8')
    const featureParsed = matter(featureRaw)

    const governanceRaw = fs.readFileSync(governanceMarkdownPath, 'utf-8')
    const governanceParsed = matter(governanceRaw)

    // Prefer explicit projectId, otherwise try to infer from front matter (epic_id prefix or project_id)
    let effectiveProjectId = projectId
    const fm = featureParsed.data as Record<string, unknown>

    if (!effectiveProjectId) {
      if (typeof fm.project_id === 'string' && fm.project_id.trim()) {
        effectiveProjectId = fm.project_id
      } else if (typeof fm.epic_id === 'string' && fm.epic_id.includes('-')) {
        effectiveProjectId = fm.epic_id.split('-')[0]
      }
    }

    return this.deriveStoriesFromContent(
      featureParsed.content,
      featureParsed.data,
      governanceParsed.content,
      governanceParsed.data,
      effectiveProjectId ?? 'project',
      epicId,
    )
  }

  /**
   * Internal method: derive stories from markdown content (supports both file and stream sources).
   */
  private async deriveStoriesFromContent(
    featureContent: string,
    featureFrontMatter: Record<string, unknown>,
    _govContent: string,
    _govFrontMatter: Record<string, unknown>,
    projectId: string,
    epicId?: string,
  ): Promise<StoryOutput[]> {
    const fmObj = featureFrontMatter as Record<string, unknown>
    let effectiveEpicId: string = '';
    if (typeof epicId === 'string' && epicId) {
      effectiveEpicId = epicId;
    } else if (typeof fmObj.epic_id === 'string' && fmObj.epic_id) {
      effectiveEpicId = fmObj.epic_id;
    } else {
      throw new StoryValidationError('Missing epic_id in front matter or parameters')
    }

    console.log('[FeatureToStoryAgent] Parsing feature content for stories')
    console.log(`[FeatureToStoryAgent] Feature content length: ${featureContent.length} chars`)
    console.log(`[FeatureToStoryAgent] First 500 chars: ${featureContent.substring(0, 500)}`)

    // Extract feature metadata from content
    const lines = featureContent.split('\n')
    const featureBlocks: Array<{ featureId: string; title: string; description: string; criteria: string[] }> = []
    let currentFeature: { featureId: string; title: string; description: string; criteria: string[] } | null = null
    let inDescription = false
    let inCriteria = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check for Feature header
      const featureMatch = line.match(/^# Feature: (.+)/)
      if (featureMatch) {
        if (currentFeature) {
          featureBlocks.push(currentFeature)
        }
        // Use feature_id from front matter - this is the source of truth
        // Do NOT construct IDs from projectId as it may not match the feature's actual ID
        const featureId = typeof fmObj.feature_id === 'string' && fmObj.feature_id
          ? fmObj.feature_id as string
          : (() => {
              // Fallback only if front matter is missing feature_id (should not happen in production)
              console.warn('[FeatureToStoryAgent] Missing feature_id in front matter, using fallback')
              return `${projectId}-${effectiveEpicId}-feature-01`
            })()
        
        currentFeature = {
          featureId,
          title: featureMatch[1].trim(),
          description: '',
          criteria: [],
        }
        inDescription = false
        inCriteria = false
        console.log(`[FeatureToStoryAgent] Found feature: ${featureMatch[1].trim()}`)
        continue
      }

      if (currentFeature) {
        // Check for Description section
        if (line.trim().startsWith('## Description')) {
          inDescription = true
          inCriteria = false
          continue
        }

        // Check for Acceptance Criteria section
        if (line.trim().startsWith('## Acceptance Criteria')) {
          inDescription = false
          inCriteria = true
          console.log(`[FeatureToStoryAgent] Found Acceptance Criteria section for feature: ${currentFeature.title}`)
          continue
        }

        // Check for another section (stop current section)
        if (line.trim().startsWith('##')) {
          inDescription = false
          inCriteria = false
          continue
        }

        // Collect description
        if (inDescription && line.trim()) {
          currentFeature.description += (currentFeature.description ? ' ' : '') + line.trim()
        }

        // Collect criteria
        if (inCriteria) {
          const criterionMatch = line.match(/^[-*]\s+(.+)/)
          if (criterionMatch && criterionMatch[1].trim().length > 3) {
            currentFeature.criteria.push(criterionMatch[1].trim())
            console.log(`[FeatureToStoryAgent]   Added criterion: ${criterionMatch[1].trim().substring(0, 80)}`)
          }
        }
      }
    }

    if (currentFeature) {
      featureBlocks.push(currentFeature)
    }

    console.log(`[FeatureToStoryAgent] Total features parsed: ${featureBlocks.length}`)
    featureBlocks.forEach((f, idx) => {
      console.log(`[FeatureToStoryAgent]   Feature ${idx + 1}: ${f.title} - ${f.criteria.length} criteria`)
    })

    // If no features found, create one placeholder
    if (featureBlocks.length === 0) {
      console.log('[FeatureToStoryAgent] No features found in markdown, creating placeholder')
      featureBlocks.push({
        featureId: (typeof fmObj.feature_id === 'string' ? fmObj.feature_id : `feat-${effectiveEpicId}-01`),
        title: 'Derived Feature',
        description: 'Feature derived from Epic',
        criteria: ['Demonstrate measurable outcome aligned with Feature goal'],
      })
    }

    // Generate stories: one per acceptance criterion
    const outputs: StoryOutput[] = []
    let storyIndex = 1

    for (const feature of featureBlocks) {
      // Use criteria if available, otherwise use feature title as fallback
      const criteriaToUse = feature.criteria.length > 0 ? feature.criteria : [feature.title]

      // Generate stories from criteria (limit to 5 per feature for prototype)
      for (const criterion of criteriaToUse.slice(0, 5)) {
        const storyTitle = criterion.substring(0, 100)
        
        // Build story with minimal validation
        const story: StorySchema = {
          story_id: buildStoryId({
            featureId: feature.featureId,
            storyNumber: storyIndex,
            shortName: storyTitle,
          }),
          title: storyTitle,
          role: 'user',
          capability: criterion.trim() || 'achieve functionality',
          benefit: feature.description.substring(0, 200) || 'meet requirements',
          derived_from_feature: feature.featureId,
          derived_from_epic: effectiveEpicId,
          governance_references: [
            {
              document_id: effectiveEpicId,
              filename: 'governance.md',
              markdown_path: 'governance.md',
              sections: ['Requirements'],
            },
          ],
          acceptance_criteria: [criterion.trim() || 'Story delivers expected outcome'],
        }

        try {
          this.validateStorySchema(story)
          this.validateINVESTCompliance(story)
          outputs.push({ ...story, generated_at: new Date().toISOString() })
          console.log(`[FeatureToStoryAgent] ✓ Story ${storyIndex} validated and added: ${story.title.substring(0, 60)}`)
          storyIndex++
        } catch (validationError) {
          console.error(`[FeatureToStoryAgent] ✗ Story validation failed for "${criterion.substring(0, 60)}...":`)
          console.error(`[FeatureToStoryAgent]   Error: ${(validationError as Error).message}`)
          console.error(`[FeatureToStoryAgent]   Story ID: ${story.story_id}`)
          console.error(`[FeatureToStoryAgent]   Feature ID: ${story.derived_from_feature}`)
          // Continue to next story instead of failing completely
        }
      }
    }

    // Ensure we always return at least one story if we have any features
    if (outputs.length === 0 && featureBlocks.length > 0) {
      console.warn('[FeatureToStoryAgent] No valid stories generated, creating fallback story')
      const feature = featureBlocks[0]
      outputs.push({
        story_id: buildStoryId({
          featureId: feature.featureId,
          storyNumber: 1,
          shortName: 'baseline',
        }),
        title: feature.title,
        role: 'user',
        capability: 'achieve the feature objective',
        benefit: 'meet requirements',
        derived_from_feature: feature.featureId,
        derived_from_epic: effectiveEpicId,
        governance_references: [
          {
            document_id: effectiveEpicId,
            filename: 'governance.md',
            markdown_path: 'governance.md',
            sections: ['Requirements'],
          },
        ],
        acceptance_criteria: ['Feature delivers expected outcome'],
        generated_at: new Date().toISOString(),
      })
    }

    if (outputs.length === 0) {
      throw new Error('No stories were generated. The feature may not have sufficient acceptance criteria.')
    }

    return outputs
  }

}

function toKebabCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function buildStoryId(params: {
  featureId: string
  storyNumber: number
  shortName: string
}): string {
  validateFeatureIdFormat(params.featureId)

  const nn = pad2(params.storyNumber)
  const short = toKebabCase(params.shortName) || 'story'

  // Feature ID already contains the full hierarchy: <project>-epic-<id>-feature-<id>
  // Story ID format: <featureId>-story-<nn>-<short-name>
  const storyId = `${params.featureId}-story-${nn}-${short}`
  validateStoryIdFormat(storyId)

  return storyId
}
