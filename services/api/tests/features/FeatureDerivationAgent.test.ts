import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { FeatureDerivationAgent } from '../../src/features/FeatureDerivationAgent'

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

  it('derives features from success criteria', async () => {
    const features = await agent.deriveFeatures(epicPath)
    expect(features.length).toBeGreaterThan(0)
    expect(features[0].epic_id).toBe('epic-doc-123')
    expect(features[0].feature_id).toContain('feat-')
    expect(Array.isArray(features[0].acceptance_criteria)).toBe(true)
  })
})
