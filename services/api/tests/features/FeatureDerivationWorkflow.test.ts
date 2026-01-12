import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { FeatureDerivationWorkflow } from '../../src/features/FeatureDerivationWorkflow'

describe('FeatureDerivationWorkflow', () => {
  let tempDir: string
  let workflow: FeatureDerivationWorkflow

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-feature-workflow-'))
    workflow = new FeatureDerivationWorkflow(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should derive features and update muse.yaml', async () => {
    const epicPath = path.join(tempDir, 'docs', 'epics', 'epic-doc-xyz.md')
    fs.mkdirSync(path.dirname(epicPath), { recursive: true })
    const epicContent = `---\nepic_id: epic-doc-xyz\n---\n\n# Epic: Example\n\n## Objective\nExample objective.\n\n## Success Criteria\n- First criterion\n- Second criterion\n`
    fs.writeFileSync(epicPath, epicContent, 'utf-8')

    const artifacts = await workflow.deriveFeaturesFromEpic(epicPath)
    expect(artifacts.length).toBeGreaterThan(0)

    const museYamlPath = path.join(tempDir, 'muse.yaml')
    expect(fs.existsSync(museYamlPath)).toBe(true)
    const data = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))
    expect(Array.isArray(data.artifacts.features)).toBe(true)
    expect(data.artifacts.features[0].epic_id).toBe('epic-doc-xyz')
  })

  it('validateEpicFeatures should fail when Epic has more than 5 features', () => {
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    const features = Array.from({ length: 6 }).map((_, idx) => ({
      feature_id: `proj-epic-xyz-feature-0${idx + 1}`,
      epic_id: 'epic-doc-xyz',
      derived_from_epic: 'epic-doc-xyz',
      feature_path: `docs/features/feature-0${idx + 1}.md`,
      generated_at: new Date().toISOString()
    }))

    const data = { artifacts: { features } }
    fs.writeFileSync(museYamlPath, YAML.stringify(data), 'utf-8')

    const report = workflow.validateEpicFeatures('epic-doc-xyz')
    expect(report.valid).toBe(false)
    expect(report.errors.some(e => e.includes('exceeding maximum of 5'))).toBe(true)
  })

  it('validateEpicFeatures should pass for 3 features', () => {
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    const features = Array.from({ length: 3 }).map((_, idx) => ({
      feature_id: `proj-epic-xyz-feature-0${idx + 1}`,
      epic_id: 'epic-doc-xyz',
      derived_from_epic: 'epic-doc-xyz',
      feature_path: `docs/features/feature-0${idx + 1}.md`,
      generated_at: new Date().toISOString()
    }))

    const data = { artifacts: { features } }
    fs.writeFileSync(museYamlPath, YAML.stringify(data), 'utf-8')

    const report = workflow.validateEpicFeatures('epic-doc-xyz')
    expect(report.valid).toBe(true)
    expect(report.errors).toHaveLength(0)
  })
})
