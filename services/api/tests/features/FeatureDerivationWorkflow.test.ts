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
})
