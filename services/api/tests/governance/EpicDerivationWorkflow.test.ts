import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { EpicDerivationWorkflow } from '../../src/governance/EpicDerivationWorkflow'

describe('EpicDerivationWorkflow', () => {
  let tempDir: string
  let workflow: EpicDerivationWorkflow

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-workflow-test-'))
    workflow = new EpicDerivationWorkflow(tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })

  describe('deriveEpic', () => {
    it('should derive Epic and update muse.yaml', async () => {
      const governancePath = path.join(tempDir, 'docs', 'governance', 'test.md')
      fs.mkdirSync(path.dirname(governancePath), { recursive: true })

      const governanceContent = `---
document_id: doc-workflow-123
---

# Test Governance Document

This document describes requirements.

- Requirement one is important
- Requirement two ensures quality
`

      fs.writeFileSync(governancePath, governanceContent)

      const artifact = await workflow.deriveEpic(governancePath, 'doc-workflow-123')

      // Check artifact structure
      expect(artifact.epic_id).toBe('epic-doc-work')
      expect(artifact.derived_from).toBe('doc-workflow-123')
      expect(artifact.epic_path).toBeTruthy()
      expect(artifact.generated_at).toBeTruthy()

      // Check Epic file was created
      const epicPath = path.join(tempDir, artifact.epic_path)
      expect(fs.existsSync(epicPath)).toBeTruthy()

      // Check muse.yaml was created/updated
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      expect(fs.existsSync(museYamlPath)).toBeTruthy()

      const museContent = fs.readFileSync(museYamlPath, 'utf-8')
      const museData = YAML.parse(museContent)

      expect(museData.artifacts.epics).toBeInstanceOf(Array)
      expect(museData.artifacts.epics.length).toBe(1)
      expect(museData.artifacts.epics[0].derived_from).toBe('doc-workflow-123')
    })

    it('should preserve existing artifacts in muse.yaml', async () => {
      // Create muse.yaml with existing artifacts
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      const existingData = {
        artifacts: {
          governance_markdown: [
            {
              document_id: 'existing-doc',
              committed_at: '2026-01-01T00:00:00Z'
            }
          ],
          epics: []
        }
      }
      fs.writeFileSync(museYamlPath, YAML.stringify(existingData))

      // Derive new Epic
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-preserve-123
---

# Test
`

      fs.writeFileSync(governancePath, governanceContent)

      await workflow.deriveEpic(governancePath, 'doc-preserve-123')

      // Check that existing artifacts are preserved
      const museContent = fs.readFileSync(museYamlPath, 'utf-8')
      const museData = YAML.parse(museContent)

      expect(museData.artifacts.governance_markdown).toBeInstanceOf(Array)
      expect(museData.artifacts.governance_markdown.length).toBe(1)
      expect(museData.artifacts.governance_markdown[0].document_id).toBe('existing-doc')
      
      expect(museData.artifacts.epics.length).toBe(1)
    })

    it('should replace existing Epic for same document_id', async () => {
      // Create initial Epic
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-replace-123
---

# Test Version 1
`

      fs.writeFileSync(governancePath, governanceContent)

      await workflow.deriveEpic(governancePath, 'doc-replace-123')

      // Derive again (simulating re-derivation)
      const governanceContent2 = `---
document_id: doc-replace-123
---

# Test Version 2 (Updated)
`

      fs.writeFileSync(governancePath, governanceContent2)

      await workflow.deriveEpic(governancePath, 'doc-replace-123')

      // Check that only one Epic exists
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      const museContent = fs.readFileSync(museYamlPath, 'utf-8')
      const museData = YAML.parse(museContent)

      expect(museData.artifacts.epics.length).toBe(1)
      expect(museData.artifacts.epics[0].derived_from).toBe('doc-replace-123')
    })

    it('should use custom output directory when specified', async () => {
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-custom-123
---

# Test
`

      fs.writeFileSync(governancePath, governanceContent)

      const customOutputDir = path.join(tempDir, 'custom', 'epics')
      const artifact = await workflow.deriveEpic(governancePath, 'doc-custom-123', {
        outputDir: customOutputDir
      })

      expect(artifact.epic_path.startsWith('custom/epics')).toBeTruthy()
      
      const epicPath = path.join(tempDir, artifact.epic_path)
      expect(fs.existsSync(epicPath)).toBeTruthy()
    })
  })

  describe('getEpicMetadata', () => {
    it('should retrieve Epic metadata from muse.yaml', async () => {
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-meta-123
---

# Test
`

      fs.writeFileSync(governancePath, governanceContent)

      await workflow.deriveEpic(governancePath, 'doc-meta-123')

      const metadata = workflow.getEpicMetadata('doc-meta-123')

      expect(metadata).toBeTruthy()
      expect(metadata?.derived_from).toBe('doc-meta-123')
      expect(metadata?.epic_id).toBeTruthy()
    })

    it('should return null for non-existent document', () => {
      const metadata = workflow.getEpicMetadata('nonexistent-doc')

      expect(metadata).toBeNull()
    })

    it('should return null when muse.yaml does not exist', () => {
      const metadata = workflow.getEpicMetadata('any-doc')

      expect(metadata).toBeNull()
    })
  })

  describe('deriveAllEpics', () => {
    it('should derive Epics from all governance documents', async () => {
      const governanceDir = path.join(tempDir, 'docs', 'governance')
      fs.mkdirSync(governanceDir, { recursive: true })

      // Create multiple governance documents
      const doc1Content = `---
document_id: doc-all-1
---

# Document 1

- Requirement A
`

      const doc2Content = `---
document_id: doc-all-2
---

# Document 2

- Requirement B
`

      fs.writeFileSync(path.join(governanceDir, 'doc1.md'), doc1Content)
      fs.writeFileSync(path.join(governanceDir, 'doc2.md'), doc2Content)

      const results = await workflow.deriveAllEpics('docs/governance')

      expect(results.length).toBe(2)
      expect(results.map(r => r.derived_from).sort()).toEqual(['doc-all-1', 'doc-all-2'])

      // Check muse.yaml has both
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      const museContent = fs.readFileSync(museYamlPath, 'utf-8')
      const museData = YAML.parse(museContent)

      expect(museData.artifacts.epics.length).toBe(2)
    })

    it('should continue processing on individual failures', async () => {
      const governanceDir = path.join(tempDir, 'docs', 'governance')
      fs.mkdirSync(governanceDir, { recursive: true })

      // Create one valid and one invalid document
      const validContent = `---
document_id: doc-valid
---

# Valid Document
`

      const invalidContent = `This is not valid Markdown with front matter`

      fs.writeFileSync(path.join(governanceDir, 'valid.md'), validContent)
      fs.writeFileSync(path.join(governanceDir, 'invalid.md'), invalidContent)

      const results = await workflow.deriveAllEpics('docs/governance')

      // Should have processed at least the valid one
      expect(results.length).toBeGreaterThan(0)
    })

    it('should throw error when governance directory does not exist', async () => {
      await expect(
        workflow.deriveAllEpics('nonexistent/dir')
      ).rejects.toThrow('not found')
    })
  })

  describe('Epic file structure', () => {
    it('should create valid YAML front matter', async () => {
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-yaml-123
---

# Test
`

      fs.writeFileSync(governancePath, governanceContent)

      const artifact = await workflow.deriveEpic(governancePath, 'doc-yaml-123')

      const epicPath = path.join(tempDir, artifact.epic_path)
      const epicContent = fs.readFileSync(epicPath, 'utf-8')

      // Parse front matter
      const frontMatterMatch = epicContent.match(/^---\n([\s\S]+?)\n---/)
      expect(frontMatterMatch).toBeTruthy()

      const frontMatterYaml = frontMatterMatch![1]
      const frontMatter = YAML.parse(frontMatterYaml)

      expect(frontMatter.epic_id).toBeTruthy()
      expect(frontMatter.derived_from).toBe('doc-yaml-123')
      expect(frontMatter.generated_at).toBeTruthy()
    })

    it('should include required sections in Epic Markdown', async () => {
      const governancePath = path.join(tempDir, 'test.md')
      const governanceContent = `---
document_id: doc-sections-123
---

# Test
`

      fs.writeFileSync(governancePath, governanceContent)

      const artifact = await workflow.deriveEpic(governancePath, 'doc-sections-123')

      const epicPath = path.join(tempDir, artifact.epic_path)
      const epicContent = fs.readFileSync(epicPath, 'utf-8')

      expect(epicContent).toContain('# Epic:')
      expect(epicContent).toContain('## Objective')
      expect(epicContent).toContain('## Success Criteria')
    })
  })

  describe('validateFeatureCounts', () => {
    it('should fail when Epic has more than 5 features', () => {
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      const features = Array.from({ length: 6 }).map((_, idx) => ({
        feature_id: `proj-epic-xyz-feature-0${idx + 1}`,
        derived_from_epic: 'epic-doc-xyz'
      }))

      const data = { artifacts: { features } }
      fs.writeFileSync(museYamlPath, YAML.stringify(data), 'utf-8')

      const report = workflow.validateFeatureCounts('epic-doc-xyz')
      expect(report.valid).toBe(false)
      expect(report.errors.some(e => e.includes('exceeding maximum of 5'))).toBe(true)
    })

    it('should pass when Epic has between 1 and 5 features', () => {
      const museYamlPath = path.join(tempDir, 'muse.yaml')
      const features = Array.from({ length: 2 }).map((_, idx) => ({
        feature_id: `proj-epic-xyz-feature-0${idx + 1}`,
        derived_from_epic: 'epic-doc-xyz'
      }))

      const data = { artifacts: { features } }
      fs.writeFileSync(museYamlPath, YAML.stringify(data), 'utf-8')

      const report = workflow.validateFeatureCounts('epic-doc-xyz')
      expect(report.valid).toBe(true)
    })
  })
})
