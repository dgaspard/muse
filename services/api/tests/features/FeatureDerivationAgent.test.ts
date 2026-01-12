import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { FeatureDerivationAgent, FeatureValidationError } from '../../src/features/FeatureDerivationAgent'

describe('FeatureDerivationAgent', () => {
  const tmp = path.join(__dirname, '../../../.test-features')
  const epicPath = path.join(tmp, 'epic-sample.md')
  let agent: FeatureDerivationAgent

  beforeAll(() => {
    agent = new FeatureDerivationAgent()
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const content = `---\nepic_id: epic-doc-123\n---\n\n# Epic: Sample\n\n## Objective\nDeliver measurable outcomes.\n\n## Success Criteria\n- A criterion A\n- Criterion B with more details\n- Another criterion C\n`
    fs.writeFileSync(epicPath, content, 'utf-8')
  })

  afterAll(() => {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
  })

  describe('Basic Feature Derivation', () => {
    it('derives features from success criteria', async () => {
      const features = await agent.deriveFeatures(epicPath)
      expect(features.length).toBeGreaterThan(0)
      expect(features[0].epic_id).toBe('epic-doc-123')
      expect(features[0].feature_id).toMatch(/^project-epic-doc-123-feature-\d{2}$/)
      expect(Array.isArray(features[0].acceptance_criteria)).toBe(true)
    })

    it('creates one feature per success criterion', async () => {
      const features = await agent.deriveFeatures(epicPath)
      expect(features.length).toBe(3)
      expect(features[0].title).toContain('criterion A')
      expect(features[1].title).toContain('Criterion B')
      expect(features[2].title).toContain('criterion C')
    })

    it('assigns sequential feature IDs', async () => {
      const features = await agent.deriveFeatures(epicPath)
      expect(features[0].feature_id).toContain('-feature-01')
      expect(features[1].feature_id).toContain('-feature-02')
      expect(features[2].feature_id).toContain('-feature-03')
    })

    it('includes generated_at timestamp', async () => {
      const features = await agent.deriveFeatures(epicPath)
      features.forEach(f => {
        expect(f.generated_at).toBeTruthy()
        expect(new Date(f.generated_at).getTime()).toBeGreaterThan(0)
      })
    })
  })

  describe('Epic Markdown Parsing', () => {
    it('extracts objective as feature description', async () => {
      const features = await agent.deriveFeatures(epicPath)
      expect(features[0].description).toBe('Deliver measurable outcomes.')
    })

    it('handles missing epic file', async () => {
      const nonExistentPath = path.join(tmp, 'non-existent.md')
      await expect(agent.deriveFeatures(nonExistentPath)).rejects.toThrow('Epic Markdown not found')
    })

    it('throws error when epic_id is missing', async () => {
      const noIdPath = path.join(tmp, 'no-id.md')
      fs.writeFileSync(noIdPath, '# Epic\n\n## Objective\nTest\n\n## Success Criteria\n- Criterion', 'utf-8')
      
      await expect(agent.deriveFeatures(noIdPath)).rejects.toThrow('Missing epic_id')
      
      fs.unlinkSync(noIdPath)
    })

    it('uses epicId parameter when provided', async () => {
      const features = await agent.deriveFeatures(epicPath, 'override-epic-id')
      expect(features[0].epic_id).toBe('override-epic-id')
      expect(features[0].feature_id).toContain('override-epic-id')
    })
  })

  describe('Feature Limits and Edge Cases', () => {
    it('limits features to 5 per epic', async () => {
      const manyPath = path.join(tmp, 'many-criteria.md')
      const content = `---\nepic_id: epic-many\n---\n\n# Epic\n\n## Objective\nTest\n\n## Success Criteria\n- Criterion 1\n- Criterion 2\n- Criterion 3\n- Criterion 4\n- Criterion 5\n- Criterion 6\n- Criterion 7\n`
      fs.writeFileSync(manyPath, content, 'utf-8')
      
      const features = await agent.deriveFeatures(manyPath)
      expect(features.length).toBeLessThanOrEqual(5)
      
      fs.unlinkSync(manyPath)
    })

    it('creates fallback feature when no success criteria found', async () => {
      const noCriteriaPath = path.join(tmp, 'no-criteria.md')
      const content = `---\nepic_id: epic-no-criteria\n---\n\n# Epic\n\n## Objective\nTest objective text.`
      fs.writeFileSync(noCriteriaPath, content, 'utf-8')
      
      const features = await agent.deriveFeatures(noCriteriaPath)
      expect(features.length).toBe(1)
      expect(features[0].title).toContain('measurable outcome')
      
      fs.unlinkSync(noCriteriaPath)
    })

    it('ignores empty or very short criteria lines', async () => {
      const shortPath = path.join(tmp, 'short-criteria.md')
      const content = `---\nepic_id: epic-short\n---\n\n# Epic\n\n## Objective\nTest\n\n## Success Criteria\n- A\n- BB\n- CCC\n- Valid criterion with enough length\n`
      fs.writeFileSync(shortPath, content, 'utf-8')
      
      const features = await agent.deriveFeatures(shortPath)
      expect(features.length).toBe(1)
      expect(features[0].title).toContain('Valid criterion')
      
      fs.unlinkSync(shortPath)
    })
  })

  describe('Project ID Handling', () => {
    it('uses custom projectId in feature IDs', async () => {
      const features = await agent.deriveFeatures(epicPath, undefined, 'myproject')
      expect(features[0].feature_id).toMatch(/^myproject-epic-doc-123-feature-\d{2}$/)
    })

    it('slugifies projectId correctly', async () => {
      const features = await agent.deriveFeatures(epicPath, undefined, 'My Complex Project!')
      expect(features[0].feature_id).toMatch(/^my-complex-project-epic-doc-123-feature-\d{2}$/)
    })

    it('defaults to "project" when no projectId provided', async () => {
      const features = await agent.deriveFeatures(epicPath)
      expect(features[0].feature_id).toMatch(/^project-epic-doc-123-feature-\d{2}$/)
    })
  })

  describe('Feature Writing', () => {
    it('writes features to markdown files', async () => {
      const outputDir = path.join(tmp, 'output')
      const result = await agent.deriveAndWriteFeatures(epicPath, undefined, outputDir, 'testproj')
      
      expect(result.features.length).toBeGreaterThan(0)
      expect(result.featurePaths.length).toBe(result.features.length)
      
      result.featurePaths.forEach(p => {
        expect(fs.existsSync(p)).toBe(true)
        const content = fs.readFileSync(p, 'utf-8')
        expect(content).toContain('---')
        expect(content).toContain('feature_id:')
        expect(content).toContain('# Feature:')
        expect(content).toContain('## Description')
        expect(content).toContain('## Acceptance Criteria')
      })
      
      // Cleanup
      if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true })
    })

    it('creates output directory if it does not exist', async () => {
      const outputDir = path.join(tmp, 'new-output-dir', 'nested')
      expect(fs.existsSync(outputDir)).toBe(false)
      
      await agent.deriveAndWriteFeatures(epicPath, undefined, outputDir)
      expect(fs.existsSync(outputDir)).toBe(true)
      
      // Cleanup
      fs.rmSync(path.join(tmp, 'new-output-dir'), { recursive: true, force: true })
    })
  })

  describe('Feature Schema Validation', () => {
    it('validates all required fields are present', async () => {
      const features = await agent.deriveFeatures(epicPath)
      
      features.forEach(f => {
        expect(f.feature_id).toBeTruthy()
        expect(f.epic_id).toBeTruthy()
        expect(f.title).toBeTruthy()
        expect(f.description).toBeTruthy()
        expect(Array.isArray(f.acceptance_criteria)).toBe(true)
        expect(f.acceptance_criteria.length).toBeGreaterThan(0)
      })
    })

    it('truncates long feature titles to 120 characters', async () => {
      const longPath = path.join(tmp, 'long-title.md')
      const longCriterion = 'A'.repeat(200)
      const content = `---\nepic_id: epic-long\n---\n\n# Epic\n\n## Objective\nTest\n\n## Success Criteria\n- ${longCriterion}\n`
      fs.writeFileSync(longPath, content, 'utf-8')
      
      const features = await agent.deriveFeatures(longPath)
      expect(features[0].title.length).toBeLessThanOrEqual(120)
      
      fs.unlinkSync(longPath)
    })

    it('truncates long descriptions to 600 characters', async () => {
      const longDescPath = path.join(tmp, 'long-desc.md')
      const longObjective = 'B'.repeat(1000)
      const content = `---\nepic_id: epic-long-desc\n---\n\n# Epic\n\n## Objective\n${longObjective}\n\n## Success Criteria\n- Criterion\n`
      fs.writeFileSync(longDescPath, content, 'utf-8')
      
      const features = await agent.deriveFeatures(longDescPath)
      expect(features[0].description.length).toBeLessThanOrEqual(600)
      
      fs.unlinkSync(longDescPath)
    })
  })
})
