import matter from 'gray-matter'
import * as fs from 'fs'
import * as path from 'path'

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export interface FeatureSchema {
  feature_id: string
  epic_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  parent_feature_id?: string
}

export interface FeatureOutput extends FeatureSchema {
  generated_at: string
}

export class FeatureValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeatureValidationError'
  }
}

export class FeatureDerivationAgent {
  private readEpicMarkdown(markdownPath: string): { content: string; frontMatter: Record<string, unknown> } {
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Epic Markdown not found: ${markdownPath}`)
    }
    const fileContent = fs.readFileSync(markdownPath, 'utf-8')
    const parsed = matter(fileContent)
    return { content: parsed.content, frontMatter: parsed.data }
  }

  private validateFeatureSchema(feature: unknown): asserts feature is FeatureSchema {
    if (typeof feature !== 'object' || feature === null) {
      throw new FeatureValidationError('Feature must be an object')
    }

    const errors: string[] = []
    const f = feature as Record<string, unknown>

    if (!f.feature_id || typeof f.feature_id !== 'string') errors.push('Missing or invalid feature_id')
    if (!f.epic_id || typeof f.epic_id !== 'string') errors.push('Missing or invalid epic_id')
    if (!f.title || typeof f.title !== 'string') errors.push('Missing or invalid title')
    if (!f.description || typeof f.description !== 'string') errors.push('Missing or invalid description')
    if (!Array.isArray(f.acceptance_criteria) || f.acceptance_criteria.length === 0) {
      errors.push('Missing or invalid acceptance_criteria (must be non-empty array)')
    }
    const allowed = ['feature_id', 'epic_id', 'title', 'description', 'acceptance_criteria', 'parent_feature_id']
    const extras = Object.keys(f).filter(k => !allowed.includes(k))
    if (extras.length > 0) errors.push(`Unexpected fields: ${extras.join(', ')}`)

    if (errors.length) throw new FeatureValidationError(`Feature validation failed:\n${errors.join('\n')}`)
  }

  private generateFeatureMarkdown(feature: FeatureOutput): string {
    const frontMatter: Record<string, string> = {
      feature_id: feature.feature_id,
      epic_id: feature.epic_id,
      generated_at: feature.generated_at
    }
    if (feature.parent_feature_id) {
      frontMatter.parent_feature_id = feature.parent_feature_id
    }
    const lines: string[] = []
    lines.push('---')
    Object.entries(frontMatter).forEach(([k, v]) => lines.push(`${k}: ${v}`))
    lines.push('---', '', `# Feature: ${feature.title}`, '', '## Description', '', feature.description, '', '## Acceptance Criteria', '')
    feature.acceptance_criteria.forEach(c => lines.push(`- ${c}`))
    lines.push('')
    return lines.join('\n')
  }

  private writeFeatureMarkdown(feature: FeatureOutput, outputPath: string): void {
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const content = this.generateFeatureMarkdown(feature)
    fs.writeFileSync(outputPath, content, 'utf-8')
  }

  /**
   * Derive features from Epic markdown. Strategy: one feature per success criterion.
   */
  async deriveFeatures(epicMarkdownPath: string, epicId?: string, projectId?: string): Promise<FeatureOutput[]> {
    const { content, frontMatter } = this.readEpicMarkdown(epicMarkdownPath)

    const fmObj = frontMatter as Record<string, unknown>
    const effectiveEpicId = epicId || (typeof fmObj.epic_id === 'string' ? fmObj.epic_id : null)
    if (!effectiveEpicId) throw new FeatureValidationError('Missing epic_id in front matter or parameters')

    const lines = content.split('\n')
    // Extract objective paragraph for description fallback
    const objectiveIndex = lines.findIndex(l => l.trim().toLowerCase().startsWith('## objective'))
    let descriptionBase = 'Derived from Epic objective.'
    if (objectiveIndex !== -1) {
      // next non-empty lines until next section
      const descLines: string[] = []
      for (let i = objectiveIndex + 1; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim().startsWith('## ')) break
        if (line.trim()) descLines.push(line.trim())
      }
      if (descLines.length) descriptionBase = descLines.join(' ').substring(0, 600)
    }

    // Extract success criteria bullets
    const scIndex = lines.findIndex(l => l.trim().toLowerCase().startsWith('## success criteria'))
    const criteria: string[] = []
    if (scIndex !== -1) {
      for (let i = scIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('## ')) break
        const m = line.match(/^[-*]\s+(.+)/)
        if (m && m[1].length > 3) criteria.push(m[1])
      }
    }

    const selected = criteria.slice(0, 5)
    if (selected.length === 0) {
      // fallback: create a single feature from objective
      selected.push('Demonstrate measurable outcome aligned with Epic objective')
    }

    const projectSlug = projectId ? slugify(projectId) : 'project'

    // Rule-based approach: Create features with multiple acceptance criteria
    // Strategy: Group related criteria together to create richer features
    // For small Epic (1-2 criteria): One feature with all criteria
    // For medium Epic (3-4 criteria): Group pairs
    // For large Epic (5+ criteria): Create 2-3 features with distributed criteria
    
    const outputs: FeatureOutput[] = []
    
    if (selected.length <= 2) {
      // Small Epic: Single feature with all criteria
      const featureId = `${projectSlug}-${effectiveEpicId}-feature-01`
      const feature: FeatureSchema = {
        feature_id: featureId,
        epic_id: effectiveEpicId,
        title: selected[0].substring(0, 120),
        description: descriptionBase,
        acceptance_criteria: selected
      }
      this.validateFeatureSchema(feature)
      outputs.push({ ...feature, generated_at: new Date().toISOString() })
    } else if (selected.length <= 4) {
      // Medium Epic: 2 features with criteria pairs
      const midpoint = Math.ceil(selected.length / 2)
      for (let groupIdx = 0; groupIdx < 2; groupIdx++) {
        const start = groupIdx * midpoint
        const end = Math.min(start + midpoint, selected.length)
        const groupCriteria = selected.slice(start, end)
        
        if (groupCriteria.length > 0) {
          const featureIndex = String(groupIdx + 1).padStart(2, '0')
          const featureId = `${projectSlug}-${effectiveEpicId}-feature-${featureIndex}`
          const feature: FeatureSchema = {
            feature_id: featureId,
            epic_id: effectiveEpicId,
            title: groupCriteria[0].substring(0, 120),
            description: descriptionBase,
            acceptance_criteria: groupCriteria
          }
          this.validateFeatureSchema(feature)
          outputs.push({ ...feature, generated_at: new Date().toISOString() })
        }
      }
    } else {
      // Large Epic (5 criteria): 3 features with distributed criteria
      // Feature 1: criteria[0,1], Feature 2: criteria[2,3], Feature 3: criteria[4]
      const distribution = [
        [0, 1],
        [2, 3],
        [4]
      ]
      
      distribution.forEach((indices, groupIdx) => {
        const groupCriteria = indices.map(i => selected[i]).filter(Boolean)
        
        if (groupCriteria.length > 0) {
          const featureIndex = String(groupIdx + 1).padStart(2, '0')
          const featureId = `${projectSlug}-${effectiveEpicId}-feature-${featureIndex}`
          const feature: FeatureSchema = {
            feature_id: featureId,
            epic_id: effectiveEpicId,
            title: groupCriteria[0].substring(0, 120),
            description: descriptionBase,
            acceptance_criteria: groupCriteria
          }
          this.validateFeatureSchema(feature)
          outputs.push({ ...feature, generated_at: new Date().toISOString() })
        }
      })
    }

    return outputs
  }

  async deriveAndWriteFeatures(
    epicMarkdownPath: string,
    epicId: string | undefined,
    outputDir: string = 'docs/features',
    projectId?: string
  ): Promise<{ features: FeatureOutput[]; featurePaths: string[] }> {
    const features = await this.deriveFeatures(epicMarkdownPath, epicId, projectId)
    const featurePaths: string[] = []
    features.forEach(f => {
      const filename = `${f.epic_id}-${f.feature_id.split('-').slice(-1)[0]}.md`
      const outPath = path.join(outputDir, filename)
      this.writeFeatureMarkdown(f, outPath)
      featurePaths.push(outPath)
    })
    return { features, featurePaths }
  }
}
