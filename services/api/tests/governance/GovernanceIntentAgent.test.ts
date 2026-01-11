import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { GovernanceIntentAgent, AgentValidationError } from '../../src/governance/GovernanceIntentAgent'

describe('GovernanceIntentAgent', () => {
  let tempDir: string
  let agent: GovernanceIntentAgent

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-agent-test-'))
    agent = new GovernanceIntentAgent()
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })

  describe('deriveEpic', () => {
    it('should derive Epic from valid governance Markdown', async () => {
      const markdownPath = path.join(tempDir, 'test-doc.md')
      const governanceContent = `---
document_id: doc-test-123
---

# Test Governance Document

This document describes the requirements for document processing.

## Requirements

- Documents must be uploaded securely
- Documents must be converted to Markdown
- Documents must be committed to Git
- Traceability must be maintained
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath, 'doc-test-123')

      expect(result.epic_id).toBe('epic-doc-test')
      expect(result.derived_from).toBe('doc-test-123')
      expect(result.source_markdown).toBe(markdownPath)
      expect(result.objective).toBeTruthy()
      expect(result.success_criteria).toBeInstanceOf(Array)
      expect(result.success_criteria.length).toBeGreaterThan(0)
      expect(result.generated_at).toBeTruthy()
    })

    it('should include objective from document content', async () => {
      const markdownPath = path.join(tempDir, 'doc-with-objective.md')
      const governanceContent = `---
document_id: doc-456
---

# Governance Policy

Enable governance-driven development through automated document processing. Documents must be traceable and auditable.

## Success Criteria

- All documents have unique identifiers
- Changes are tracked in version control
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      expect(result.objective).toContain('governance')
      expect(result.objective).toContain('document processing')
    })

    it('should extract success criteria from bullet points', async () => {
      const markdownPath = path.join(tempDir, 'doc-with-criteria.md')
      const governanceContent = `---
document_id: doc-789
---

# Requirements Document

## Key Requirements

- Documents must be uploaded and stored securely
- Metadata must be captured accurately
- Conversion must preserve document structure
- Traceability links must be established
- Audit trails must be maintained
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      expect(result.success_criteria.length).toBeGreaterThan(0)
      expect(result.success_criteria.some(c => c.includes('upload'))).toBeTruthy()
      expect(result.success_criteria.some(c => c.includes('Metadata'))).toBeTruthy()
    })

    it('should provide default success criteria when none found', async () => {
      const markdownPath = path.join(tempDir, 'minimal-doc.md')
      const governanceContent = `---
document_id: doc-minimal
---

# Minimal Document

This is a very simple document with no bullet points.
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      expect(result.success_criteria.length).toBeGreaterThan(0)
      expect(result.success_criteria.some(c => c.includes('upload'))).toBeTruthy()
    })

    it('should use document_id from front matter if not provided', async () => {
      const markdownPath = path.join(tempDir, 'auto-id.md')
      const governanceContent = `---
document_id: doc-auto-123
---

# Auto ID Document
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      expect(result.derived_from).toBe('doc-auto-123')
    })

    it('should throw error when markdown file does not exist', async () => {
      const markdownPath = path.join(tempDir, 'nonexistent.md')

      await expect(agent.deriveEpic(markdownPath)).rejects.toThrow('not found')
    })

    it('should include generated_at timestamp', async () => {
      const markdownPath = path.join(tempDir, 'timestamp-test.md')
      const governanceContent = `---
document_id: doc-time-123
---

# Timestamp Test
`

      fs.writeFileSync(markdownPath, governanceContent)

      const beforeTime = new Date().toISOString()
      const result = await agent.deriveEpic(markdownPath)
      const afterTime = new Date().toISOString()

      expect(result.generated_at).toBeTruthy()
      expect(result.generated_at >= beforeTime).toBeTruthy()
      expect(result.generated_at <= afterTime).toBeTruthy()
    })
  })

  describe('deriveAndWriteEpic', () => {
    it('should write Epic to file with correct structure', async () => {
      const markdownPath = path.join(tempDir, 'source.md')
      const governanceContent = `---
document_id: doc-write-123
---

# Test Document

- Requirement one
- Requirement two
`

      fs.writeFileSync(markdownPath, governanceContent)

      const outputDir = path.join(tempDir, 'epics')
      const { epic, epicPath } = await agent.deriveAndWriteEpic(
        markdownPath,
        'doc-write-123',
        outputDir
      )

      expect(fs.existsSync(epicPath)).toBeTruthy()
      
      const epicContent = fs.readFileSync(epicPath, 'utf-8')
      
      // Check YAML front matter
      expect(epicContent).toContain('---')
      expect(epicContent).toContain(`epic_id: ${epic.epic_id}`)
      expect(epicContent).toContain('derived_from: doc-write-123')
      expect(epicContent).toContain('generated_at:')
      
      // Check markdown structure
      expect(epicContent).toContain('# Epic:')
      expect(epicContent).toContain('## Objective')
      expect(epicContent).toContain('## Success Criteria')
      expect(epicContent).toMatch(/-\s+\w+/)  // At least one bullet point
    })

    it('should create output directory if it does not exist', async () => {
      const markdownPath = path.join(tempDir, 'source2.md')
      const governanceContent = `---
document_id: doc-dir-123
---

# Test Document
`

      fs.writeFileSync(markdownPath, governanceContent)

      const outputDir = path.join(tempDir, 'nested', 'epics', 'dir')
      expect(fs.existsSync(outputDir)).toBeFalsy()

      await agent.deriveAndWriteEpic(markdownPath, 'doc-dir-123', outputDir)

      expect(fs.existsSync(outputDir)).toBeTruthy()
    })

    it('should name Epic file using derived_from', async () => {
      const markdownPath = path.join(tempDir, 'naming-test.md')
      const governanceContent = `---
document_id: doc-naming-456
---

# Naming Test
`

      fs.writeFileSync(markdownPath, governanceContent)

      const outputDir = path.join(tempDir, 'epics')
      const { epicPath } = await agent.deriveAndWriteEpic(
        markdownPath,
        'doc-naming-456',
        outputDir
      )

      expect(path.basename(epicPath)).toBe('doc-naming-456-epic.md')
    })
  })

  describe('schema validation', () => {
    it('should validate Epic has all required fields', async () => {
      const markdownPath = path.join(tempDir, 'valid.md')
      const governanceContent = `---
document_id: doc-valid-123
---

# Valid Document

- Success criterion one
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      // Verify all required schema fields exist
      expect(result).toHaveProperty('epic_id')
      expect(result).toHaveProperty('derived_from')
      expect(result).toHaveProperty('source_markdown')
      expect(result).toHaveProperty('objective')
      expect(result).toHaveProperty('success_criteria')
      expect(result).toHaveProperty('generated_at')
    })

    it('should ensure success_criteria is non-empty array', async () => {
      const markdownPath = path.join(tempDir, 'criteria-test.md')
      const governanceContent = `---
document_id: doc-criteria-123
---

# Document
`

      fs.writeFileSync(markdownPath, governanceContent)

      const result = await agent.deriveEpic(markdownPath)

      expect(Array.isArray(result.success_criteria)).toBeTruthy()
      expect(result.success_criteria.length).toBeGreaterThan(0)
      expect(result.success_criteria.every(c => typeof c === 'string')).toBeTruthy()
    })
  })
})
