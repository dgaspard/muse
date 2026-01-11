import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { EpicDerivationWorkflow } from '../../src/governance/EpicDerivationWorkflow'
import { FeatureDerivationWorkflow } from '../../src/features/FeatureDerivationWorkflow'

describe('Integration: Epic derivation (MUSE-005) → Feature derivation (MUSE-006)', () => {
  let tempDir: string
  let epicWorkflow: EpicDerivationWorkflow
  let featureWorkflow: FeatureDerivationWorkflow

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-int-'))
    epicWorkflow = new EpicDerivationWorkflow(tempDir)
    featureWorkflow = new FeatureDerivationWorkflow(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('derives an Epic from governance, then derives Features from that Epic and updates muse.yaml', async () => {
    // 1) Seed a minimal governance Markdown with front matter
    const governancePath = path.join(tempDir, 'docs', 'governance', 'policy-doc.md')
    fs.mkdirSync(path.dirname(governancePath), { recursive: true })
    const governanceContent = `---\ndocument_id: doc-int-001\n---\n\n# Governance Policy\n\nThis is a minimal document used for integration testing.`
    fs.writeFileSync(governancePath, governanceContent, 'utf-8')

    // 2) Derive Epic (MUSE-005)
    const epicArtifact = await epicWorkflow.deriveEpic(governancePath, 'doc-int-001')
    expect(epicArtifact.epic_id).toBeTruthy()
    expect(epicArtifact.derived_from).toBe('doc-int-001')
    expect(epicArtifact.epic_path).toBeTruthy()

    const epicMarkdownPath = path.join(tempDir, epicArtifact.epic_path)
    expect(fs.existsSync(epicMarkdownPath)).toBe(true)

    // 3) Derive Features from Epic (MUSE-006)
    const featureArtifacts = await featureWorkflow.deriveFeaturesFromEpic(epicMarkdownPath)
    expect(featureArtifacts.length).toBeGreaterThan(0)
    featureArtifacts.forEach(f => {
      expect(f.epic_id).toBe(epicArtifact.epic_id)
      expect(fs.existsSync(path.join(tempDir, f.feature_path))).toBe(true)
    })

    // 4) Validate muse.yaml contains both epics and features entries
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    expect(fs.existsSync(museYamlPath)).toBe(true)
    const museData = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))

    expect(Array.isArray(museData.artifacts.epics)).toBe(true)
    expect(Array.isArray(museData.artifacts.features)).toBe(true)

    const epicEntry = museData.artifacts.epics.find((e: any) => e.derived_from === 'doc-int-001')
    expect(epicEntry).toBeTruthy()

    const featuresForEpic = museData.artifacts.features.filter((f: any) => f.epic_id === epicArtifact.epic_id)
    expect(featuresForEpic.length).toBeGreaterThan(0)
  })
})
