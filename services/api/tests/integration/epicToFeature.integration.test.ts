import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { EpicDerivationWorkflow } from '../../src/governance/EpicDerivationWorkflow'
import { FeatureDerivationWorkflow } from '../../src/features/FeatureDerivationWorkflow'
import { StoryDerivationWorkflow } from '../../src/stories/StoryDerivationWorkflow'

describe('Integration: Epic → Feature → Story derivation (MUSE-005 → MUSE-006 → MUSE-007)', () => {
  let tempDir: string
  let epicWorkflow: EpicDerivationWorkflow
  let featureWorkflow: FeatureDerivationWorkflow
  let storyWorkflow: StoryDerivationWorkflow

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-int-'))
    epicWorkflow = new EpicDerivationWorkflow(tempDir)
    featureWorkflow = new FeatureDerivationWorkflow(tempDir)
    storyWorkflow = new StoryDerivationWorkflow(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('derives Epic, Features, and User Stories with full traceability', async () => {
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
    featureArtifacts.forEach((f) => {
      expect(f.epic_id).toBe(epicArtifact.epic_id)
      expect(fs.existsSync(path.join(tempDir, f.feature_path))).toBe(true)
    })

    const featureMarkdownPath = path.join(tempDir, featureArtifacts[0].feature_path)

    // 4) Derive User Stories from Features (MUSE-007)
    const storyArtifacts = await storyWorkflow.deriveStoriesFromFeatures(featureMarkdownPath, governancePath)
    expect(storyArtifacts.length).toBeGreaterThan(0)
    storyArtifacts.forEach((s) => {
      expect(s.story_id).toBeTruthy()
      expect(s.derived_from_epic).toBe(epicArtifact.epic_id)
      expect(fs.existsSync(path.join(tempDir, s.story_path))).toBe(true)
    })

    // 5) Validate muse.yaml contains epics, features, and stories entries
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    expect(fs.existsSync(museYamlPath)).toBe(true)
    const museData = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))

    expect(Array.isArray(museData.artifacts.epics)).toBe(true)
    expect(Array.isArray(museData.artifacts.features)).toBe(true)
    expect(Array.isArray(museData.artifacts.stories)).toBe(true)

    const epicEntry = museData.artifacts.epics.find((e: any) => e.derived_from === 'doc-int-001')
    expect(epicEntry).toBeTruthy()

    const featuresForEpic = museData.artifacts.features.filter((f: any) => f.epic_id === epicArtifact.epic_id)
    expect(featuresForEpic.length).toBeGreaterThan(0)

    const storiesForEpic = museData.artifacts.stories.filter((s: any) => s.derived_from_epic === epicArtifact.epic_id)
    expect(storiesForEpic.length).toBeGreaterThan(0)

    // 6) Verify traceability chain: Governance → Epic → Feature → Story
    const storyMarkdownPath = path.join(tempDir, storyArtifacts[0].story_path)
    const storyContent = fs.readFileSync(storyMarkdownPath, 'utf-8')
    expect(storyContent).toContain(epicArtifact.epic_id)
    expect(storyContent).toContain('Governance References')
  })
})
