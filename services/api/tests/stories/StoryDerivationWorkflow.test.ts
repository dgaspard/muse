import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { StoryDerivationWorkflow } from '../../src/stories/StoryDerivationWorkflow'

describe('StoryDerivationWorkflow', () => {
  let tempDir: string
  let workflow: StoryDerivationWorkflow
  let featurePath: string
  let governancePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-story-workflow-'))
    workflow = new StoryDerivationWorkflow(tempDir)

    // Create sample feature markdown
    const featureDir = path.join(tempDir, 'docs', 'features')
    fs.mkdirSync(featureDir, { recursive: true })
    featurePath = path.join(featureDir, 'feat-epic-xyz-01.md')
    const featureContent = `---
feature_id: feat-epic-xyz-01
epic_id: epic-xyz
---

# Feature: Secure Login

## Description
Users need a secure way to authenticate and access their account information.

## Acceptance Criteria
- User can submit credentials
- System validates input
- Appropriate feedback is displayed
`
    fs.writeFileSync(featurePath, featureContent, 'utf-8')

    // Create sample governance markdown
    const govDir = path.join(tempDir, 'docs', 'governance')
    fs.mkdirSync(govDir, { recursive: true })
    governancePath = path.join(govDir, 'policy.md')
    const governanceContent = `---
document_id: doc-policy-xyz
---

# Authentication Policy

All users must authenticate before accessing sensitive data.
`
    fs.writeFileSync(governancePath, governanceContent, 'utf-8')
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should derive stories and update muse.yaml', async () => {
    const artifacts = await workflow.deriveStoriesFromFeatures(featurePath, governancePath)

    expect(artifacts.length).toBeGreaterThan(0)
    artifacts.forEach((artifact) => {
      expect(artifact.story_id).toBeTruthy()
      expect(artifact.derived_from_feature).toBe('feat-epic-xyz-01')
      expect(artifact.derived_from_epic).toBe('epic-xyz')
      expect(artifact.story_path).toBeTruthy()
      expect(artifact.generated_at).toBeTruthy()
    })

    // Verify muse.yaml was created and updated
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    expect(fs.existsSync(museYamlPath)).toBe(true)

    const museData = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))
    expect(Array.isArray(museData.artifacts.stories)).toBe(true)
    expect(museData.artifacts.stories.length).toBeGreaterThan(0)
    expect(museData.artifacts.stories[0].derived_from_epic).toBe('epic-xyz')
  })

  it('should create story markdown file with correct structure', async () => {
    const artifacts = await workflow.deriveStoriesFromFeatures(featurePath, governancePath)

    const storyPath = path.join(tempDir, artifacts[0].story_path)
    expect(fs.existsSync(storyPath)).toBe(true)

    const content = fs.readFileSync(storyPath, 'utf-8')

    // Check front matter
    expect(content).toContain('---')
    expect(content).toContain('derived_from_epic: epic-xyz')
    expect(content).toContain('derived_from_features:')
    expect(content).toContain('source_features:')

    // Check story content
    expect(content).toContain('## User Story:')
    expect(content).toContain('**Story ID:**')
    expect(content).toContain('**Derived From Feature:**')
    expect(content).toContain('**Derived From Epic:**')
    expect(content).toContain('**As a**')
    expect(content).toContain('**I want**')
    expect(content).toContain('**So that**')
    expect(content).toContain('### Governance References')
    expect(content).toContain('### Acceptance Criteria')
  })

  it('should preserve existing artifacts in muse.yaml', async () => {
    // Create muse.yaml with existing artifacts
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    const existingData = {
      artifacts: {
        epics: [
          {
            epic_id: 'epic-existing',
            derived_from: 'doc-existing',
          },
        ],
        features: [
          {
            feature_id: 'feat-existing-01',
            epic_id: 'epic-existing',
          },
        ],
        stories: [],
      },
    }
    fs.writeFileSync(museYamlPath, YAML.stringify(existingData))

    await workflow.deriveStoriesFromFeatures(featurePath, governancePath)

    const museData = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))

    // Verify existing artifacts are preserved
    expect(museData.artifacts.epics.length).toBe(1)
    expect(museData.artifacts.epics[0].epic_id).toBe('epic-existing')
    expect(museData.artifacts.features.length).toBe(1)
    expect(museData.artifacts.features[0].feature_id).toBe('feat-existing-01')

    // Verify new stories are added
    expect(museData.artifacts.stories.length).toBeGreaterThan(0)
  })

  it('should replace existing stories for same epic', async () => {
    // Create muse.yaml with existing stories for same epic
    const museYamlPath = path.join(tempDir, 'muse.yaml')
    const existingData = {
      artifacts: {
        stories: [
          {
            story_id: 'story-xyz-old',
            derived_from_epic: 'epic-xyz',
            generated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    }
    fs.writeFileSync(museYamlPath, YAML.stringify(existingData))

    await workflow.deriveStoriesFromFeatures(featurePath, governancePath)

    const museData = YAML.parse(fs.readFileSync(museYamlPath, 'utf-8'))

    // Old story should be replaced
    expect(museData.artifacts.stories.every((s: any) => s.story_id !== 'story-xyz-old')).toBe(true)
    expect(museData.artifacts.stories.length).toBeGreaterThan(0)
  })
})
