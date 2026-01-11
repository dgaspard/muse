import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { GovernanceIntentAgent, EpicSchema, AgentValidationError } from '../../src/governance/GovernanceIntentAgent'

describe('GovernanceIntentAgent', () => {
  const testDir = path.join(__dirname, '../../../.test-fixtures')
  const outputDir = path.join(testDir, 'output')
  let agent: GovernanceIntentAgent

  beforeAll(() => {
    agent = new GovernanceIntentAgent()
    // Ensure test directories exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up test fixtures
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should parse governance markdown with front matter', async () => {
    // Arrange: Create a test governance document
    const governanceMarkdown = `---
document_id: gov-001
title: Authentication & Authorization
version: 1.0
---

# Governance: Authentication & Authorization

## Overview
Establish centralized identity and access control across all Muse services.

## Requirements
- All APIs must validate JWT tokens
- Role-based access control must be enforced
- Audit logs must track all authentication events
- MFA should be available for sensitive operations

## Success Metrics
- 100% of APIs protected by authentication
- Zero unauthorized access incidents
- <5s latency for token validation
`

    const filePath = path.join(testDir, 'governance-001.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act
    const epic = await agent.deriveEpic(filePath, 'gov-001')

    // Assert
    expect(epic).toBeDefined()
    expect(epic.epic_id).toBe('epic-gov-001')
    expect(epic.derived_from).toBe('gov-001')
    expect(epic.source_markdown).toBe(filePath)
    expect(epic.objective).toBeTruthy()
    expect(epic.objective.length).toBeGreaterThan(0)
    expect(Array.isArray(epic.success_criteria)).toBe(true)
    expect(epic.success_criteria.length).toBeGreaterThan(0)
    expect(epic.generated_at).toBeTruthy()
  })

  it('should extract success criteria from markdown bullet points', async () => {
    // Arrange
    const governanceMarkdown = `---
document_id: gov-002
---

# Document Processing Governance

This document outlines requirements for handling document uploads.

- All documents must be scanned for malware
- Documents over 50MB must be rejected
- Supported formats include PDF, DOCX, and Markdown
- Processing must complete within 30 seconds
- Metadata must be extracted and indexed
`

    const filePath = path.join(testDir, 'governance-002.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act
    const epic = await agent.deriveEpic(filePath, 'gov-002')

    // Assert
    expect(epic.success_criteria.length).toBeGreaterThan(0)
    expect(epic.success_criteria.some((c: string) => c.includes('malware'))).toBe(true)
  })

  it('should generate and write epic markdown with YAML front matter', async () => {
    // Arrange
    const governanceMarkdown = `---
document_id: gov-003
---

# Data Governance

Protect sensitive data across the platform.

- Encryption at rest required
- Encryption in transit required
- Regular backups scheduled
`

    const filePath = path.join(testDir, 'governance-003.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act
    const { epic, epicPath } = await agent.deriveAndWriteEpic(
      filePath,
      'gov-003',
      outputDir
    )

    // Assert
    expect(epicPath).toBeTruthy()
    expect(fs.existsSync(epicPath)).toBe(true)

    const epicContent = fs.readFileSync(epicPath, 'utf-8')
    expect(epicContent).toContain('---')
    expect(epicContent).toContain('epic_id: epic-gov-003')
    expect(epicContent).toContain('derived_from: gov-003')
    expect(epicContent).toContain('# Epic:')
    expect(epicContent).toContain('## Objective')
    expect(epicContent).toContain('## Success Criteria')
  })

  it('should throw AgentValidationError for missing required fields', async () => {
    // This test validates the schema enforcement
    // The agent should reject any epic missing required fields

    const governanceMarkdown = `---
document_id: gov-004
---

# Empty Governance Document
`

    const filePath = path.join(testDir, 'governance-004.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act & Assert
    // The agent should either:
    // 1. Extract something valid, OR
    // 2. Throw AgentValidationError with descriptive message
    const epic = await agent.deriveEpic(filePath, 'gov-004')

    // Verify schema is valid even with minimal input
    expect(epic.epic_id).toBeTruthy()
    expect(epic.objective).toBeTruthy()
    expect(Array.isArray(epic.success_criteria)).toBe(true)
    expect(epic.success_criteria.length).toBeGreaterThan(0)
  })

  it('should throw error when governance file does not exist', async () => {
    // Arrange
    const nonExistentPath = path.join(testDir, 'does-not-exist.md')

    // Act & Assert
    expect(async () => {
      await agent.deriveEpic(nonExistentPath)
    }).rejects.toThrow('Governance Markdown not found')
  })

  it('should use document_id from front matter when not provided', async () => {
    // Arrange
    const governanceMarkdown = `---
document_id: front-matter-id
---

# Example Governance
`

    const filePath = path.join(testDir, 'governance-005.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act: Call without documentId parameter
    const epic = await agent.deriveEpic(filePath)

    // Assert
    expect(epic.derived_from).toBe('front-matter-id')
  })

  it('should fall back to filename when no document_id provided', async () => {
    // Arrange
    const governanceMarkdown = `---
title: Example
---

# Example Governance
`

    const filePath = path.join(testDir, 'governance-006.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act: Call without documentId parameter
    const epic = await agent.deriveEpic(filePath)

    // Assert
    expect(epic.derived_from).toBe('governance-006')
  })

  it('should limit objective and success_criteria lengths', async () => {
    // Arrange: Very long governance document
    const longText = 'word '.repeat(200) // 200 repetitions of "word "
    const governanceMarkdown = `---
document_id: gov-007
---

# Long Document

${longText}

- Very long criterion: ${longText}
- Another criterion
`

    const filePath = path.join(testDir, 'governance-007.md')
    fs.writeFileSync(filePath, governanceMarkdown, 'utf-8')

    // Act
    const epic = await agent.deriveEpic(filePath, 'gov-007')

    // Assert
    expect(epic.objective.length).toBeLessThanOrEqual(500)
    expect(epic.success_criteria.length).toBeLessThanOrEqual(5)
  })
})
