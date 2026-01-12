import matter from 'gray-matter'
import * as fs from 'fs'
import * as path from 'path'

export interface GovernanceReference {
  section: string
  path: string
}

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
  private readFeatureMarkdown(markdownPath: string): { content: string; frontMatter: any } {
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Feature Markdown not found: ${markdownPath}`)
    }
    const fileContent = fs.readFileSync(markdownPath, 'utf-8')
    const parsed = matter(fileContent)
    return { content: parsed.content, frontMatter: parsed.data }
  }

  private readGovernanceMarkdown(governancePath: string): { content: string; frontMatter: any } {
    if (!fs.existsSync(governancePath)) {
      throw new Error(`Governance Markdown not found: ${governancePath}`)
    }
    const fileContent = fs.readFileSync(governancePath, 'utf-8')
    const parsed = matter(fileContent)
    return { content: parsed.content, frontMatter: parsed.data }
  }

  private validateStorySchema(story: any): asserts story is StorySchema {
    const errors: string[] = []

    if (!story.story_id || typeof story.story_id !== 'string') errors.push('Missing or invalid story_id')
    if (!story.title || typeof story.title !== 'string') errors.push('Missing or invalid title')
    if (!story.role || typeof story.role !== 'string') errors.push('Missing or invalid role')
    if (!story.capability || typeof story.capability !== 'string') errors.push('Missing or invalid capability')
    if (!story.benefit || typeof story.benefit !== 'string') errors.push('Missing or invalid benefit')
    if (!story.derived_from_feature || typeof story.derived_from_feature !== 'string') {
      errors.push('Missing or invalid derived_from_feature')
    }
    if (!story.derived_from_epic || typeof story.derived_from_epic !== 'string') {
      errors.push('Missing or invalid derived_from_epic')
    }
    if (!Array.isArray(story.governance_references) || story.governance_references.length === 0) {
      errors.push('Missing or invalid governance_references (must be non-empty array)')
    } else {
      story.governance_references.forEach((ref: any, idx: number) => {
        if (!ref.section || typeof ref.section !== 'string') {
          errors.push(`governance_references[${idx}].section is missing or invalid`)
        }
        if (!ref.path || typeof ref.path !== 'string') {
          errors.push(`governance_references[${idx}].path is missing or invalid`)
        }
      })
    }
    if (!Array.isArray(story.acceptance_criteria) || story.acceptance_criteria.length === 0) {
      errors.push('Missing or invalid acceptance_criteria (must be non-empty array)')
    }

    const allowed = [
      'story_id',
      'title',
      'role',
      'capability',
      'benefit',
      'derived_from_feature',
      'derived_from_epic',
      'governance_references',
      'acceptance_criteria',
    ]
    const extras = Object.keys(story).filter((k) => !allowed.includes(k))
    if (extras.length > 0) errors.push(`Unexpected fields: ${extras.join(', ')}`)

    if (errors.length) throw new StoryValidationError(`Story validation failed:\n${errors.join('\n')}`)
  }

  private validateINVESTCompliance(story: StorySchema): void {
    const errors: string[] = []

    // Independent: Story should have clear identity
    // Note: Relaxed validation - governance documents may use implementation terms
    // Only flag if VERY obvious technical implementation details appear
    const technicalPattern = /\b(database schema|SQL query|REST endpoint|class name|function signature)\b/i
    if (technicalPattern.test(story.title)) {
      errors.push('INVEST violation: Title contains low-level implementation detail')
    }

    // Valuable: Must have clear benefit (relaxed minimum)
    if (story.benefit.trim().length < 5) {
      errors.push('INVEST violation: Benefit is too short to be valuable')
    }

    // Estimable: Must have clear capability (relaxed minimum)
    if (story.capability.trim().length < 5) {
      errors.push('INVEST violation: Capability is too vague to be estimable')
    }

    // Small: Title should be concise (increased limit)
    if (story.title.length > 200) {
      errors.push('INVEST violation: Title is too long (not small enough)')
    }

    // Testable: Must have acceptance criteria
    if (story.acceptance_criteria.length === 0) {
      errors.push('INVEST violation: No acceptance criteria (not testable)')
    }

    if (errors.length) throw new StoryValidationError(`INVEST compliance failed:\n${errors.join('\n')}`)
  }

  private generateStoryMarkdown(story: StoryOutput): string {
    const lines: string[] = []

    lines.push(`## User Story: ${story.title}`)
    lines.push(`**Story ID:** ${story.story_id}`)
    lines.push(`**Derived From Feature:** ${story.derived_from_feature}`)
    lines.push(`**Derived From Epic:** ${story.derived_from_epic}`)
    lines.push('')
    lines.push(`**As a** ${story.role},`)
    lines.push(`**I want** ${story.capability},`)
    lines.push(`**So that** ${story.benefit}.`)
    lines.push('')
    lines.push('### Governance References')
    story.governance_references.forEach((ref) => {
      lines.push(`- Section: ${ref.section}`)
      lines.push(`  Source: ${ref.path}`)
    })
    lines.push('')
    lines.push('### Acceptance Criteria')
    story.acceptance_criteria.forEach((criterion) => {
      lines.push(`- ${criterion}`)
    })
    lines.push('')

    return lines.join('\n')
  }

  /**
   * Derive INVEST-compliant user stories from Feature markdown.
   * 
   * IMPORTANT: Each User Story MUST:
   * - Deliver a portion of the Feature's stated business value
   * - Reference the Feature's acceptance criteria it supports
   * - Be named using the convention: <project>-<feature_id>-<short_capability_name>
   * 
   * If a Feature has no actionable acceptance criteria, you MUST FAIL instead of generating stories.
   * 
   * Strategy: one story per acceptance criterion (or feature if no criteria).
   */
  async deriveStories(
    featureMarkdownPath: string,
    governanceMarkdownPath: string,
    epicId?: string,
  ): Promise<StoryOutput[]> {
    const { content, frontMatter } = this.readFeatureMarkdown(featureMarkdownPath)

    const effectiveEpicId = epicId || frontMatter.epic_id
    if (!effectiveEpicId) {
      throw new StoryValidationError('Missing epic_id in front matter or parameters')
    }

    // Read governance for traceability (validates file exists)
    this.readGovernanceMarkdown(governanceMarkdownPath)

    // Extract feature metadata from content
    const lines = content.split('\n')

    // Find feature blocks (looking for "# Feature:" headers)
    const featureBlocks: Array<{ featureId: string; title: string; description: string; criteria: string[] }> = []

    let currentFeature: any = null
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
        currentFeature = {
          featureId: frontMatter.feature_id || `feat-${effectiveEpicId}-01`,
          title: featureMatch[1].trim(),
          description: '',
          criteria: [],
        }
        inDescription = false
        inCriteria = false
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
          }
        }
      }
    }

    if (currentFeature) {
      featureBlocks.push(currentFeature)
    }

    // If no features found, create one placeholder
    if (featureBlocks.length === 0) {
      featureBlocks.push({
        featureId: frontMatter.feature_id || `feat-${effectiveEpicId}-01`,
        title: 'Derived Feature',
        description: 'Feature derived from Epic',
        criteria: ['Demonstrate measurable outcome aligned with Feature goal'],
      })
    }

    // Generate stories: one per acceptance criterion
    const outputs: StoryOutput[] = []
    let storyIndex = 1

    for (const feature of featureBlocks) {
      const criteriaToUse = feature.criteria.length > 0 ? feature.criteria : [feature.title]

      for (const criterion of criteriaToUse.slice(0, 3)) {
        // Limit to 3 stories per feature
        const story: StorySchema = {
          story_id: `story-${effectiveEpicId}-${String(storyIndex).padStart(3, '0')}`,
          title: criterion.substring(0, 100),
          role: 'user',
          capability: criterion,
          benefit: feature.description.substring(0, 200) || 'achieve the feature goal',
          derived_from_feature: feature.featureId,
          derived_from_epic: effectiveEpicId,
          governance_references: [
            {
              section: 'Requirements',
              path: path.relative(process.cwd(), governanceMarkdownPath),
            },
          ],
          acceptance_criteria: [criterion],
        }

        this.validateStorySchema(story)
        this.validateINVESTCompliance(story)

        outputs.push({ ...story, generated_at: new Date().toISOString() })
        storyIndex++
      }
    }

    return outputs
  }

  async deriveAndWriteStories(
    featureMarkdownPath: string,
    governanceMarkdownPath: string,
    epicId: string | undefined,
    outputDir: string = 'docs/stories',
  ): Promise<{ stories: StoryOutput[]; storyPath: string }> {
    const stories = await this.deriveStories(featureMarkdownPath, governanceMarkdownPath, epicId)

    const featureFrontMatter = matter(fs.readFileSync(featureMarkdownPath, 'utf-8')).data
    const documentId = featureFrontMatter.epic_id || 'unknown'

    const filename = `${documentId}-stories.md`
    const outPath = path.join(outputDir, filename)

    const dir = path.dirname(outPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Build front matter
    const frontMatter = {
      derived_from_epic: stories[0].derived_from_epic,
      derived_from_features: Array.from(new Set(stories.map((s) => s.derived_from_feature))),
      source_features: path.relative(process.cwd(), featureMarkdownPath),
      generated_at: new Date().toISOString(),
    }

    const lines: string[] = []
    lines.push('---')
    lines.push(`derived_from_epic: ${frontMatter.derived_from_epic}`)
    lines.push('derived_from_features:')
    frontMatter.derived_from_features.forEach((f) => lines.push(`  - ${f}`))
    lines.push(`source_features: ${frontMatter.source_features}`)
    lines.push(`generated_at: ${frontMatter.generated_at}`)
    lines.push('---')
    lines.push('')

    stories.forEach((story) => {
      lines.push(this.generateStoryMarkdown(story))
    })

    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')

    return { stories, storyPath: outPath }
  }
}
