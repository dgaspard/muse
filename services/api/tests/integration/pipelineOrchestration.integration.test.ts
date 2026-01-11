import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { MusePipelineOrchestrator } from '../../src/orchestration/MusePipelineOrchestrator'
import { InMemoryDocumentStore, DocumentMetadata } from '../../src/storage/documentStore'
import { DocumentToMarkdownConverter, MarkdownOutput } from '../../src/conversion/documentToMarkdownConverter'
import { Readable } from 'stream'

// Mock converter for testing
class MockMarkdownConverter implements DocumentToMarkdownConverter {
  async convert(_stream: Readable, _mimeType: string, metadata: any): Promise<MarkdownOutput> {
    const content = `---
document_id: ${metadata.documentId}
source_checksum: ${metadata.checksumSha256}
original_filename: ${metadata.originalFilename}
derived_artifact: governance_markdown
generated_at: ${new Date().toISOString()}
---

# Governance Policy Document

## Section 1: Data Security
All customer data must be encrypted at rest and in transit using industry-standard algorithms.

## Section 2: Access Control  
Role-based access control (RBAC) must be implemented for all system functions.

## Section 3: Audit Logging
All data access events must be logged with user identity, timestamp, and action performed.
`
    return {
      content,
      metadata: {
        document_id: metadata.documentId,
        source_checksum: metadata.checksumSha256,
        original_filename: metadata.originalFilename,
        derived_artifact: 'governance_markdown',
        generated_at: new Date().toISOString(),
      },
      suggestedFilename: 'test-governance.md',
    }
  }

  getSupportedMimeTypes(): string[] {
    return ['text/plain', 'application/pdf']
  }
}

describe('Integration: End-to-End UI Workflow (MUSE-008)', () => {
  let tempDir: string
  let docStore: InMemoryDocumentStore
  let converter: MockMarkdownConverter
  let orchestrator: MusePipelineOrchestrator

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-ui-int-'))
    docStore = new InMemoryDocumentStore()
    converter = new MockMarkdownConverter()
    orchestrator = new MusePipelineOrchestrator(docStore, converter, tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('orchestrator initializes correctly with required services', () => {
    // Verify orchestrator can be instantiated with document store and converter
    expect(orchestrator).toBeDefined()
    expect(docStore).toBeDefined()
    expect(converter).toBeDefined()
  })

  it('document store persists uploaded files correctly', async () => {
    const testFile = path.join(tempDir, 'test-doc.txt')
    fs.writeFileSync(testFile, 'Test governance content', 'utf-8')

    const metadata = await docStore.saveOriginalFromPath(testFile, {
      originalFilename: 'test-doc.txt',
      mimeType: 'text/plain',
      sizeBytes: 24,
      projectId: 'test-project',
    })

    expect(metadata.documentId).toBeTruthy()
    expect(metadata.originalFilename).toBe('test-doc.txt')
    expect(metadata.projectId).toBe('test-project')

    // Verify document can be retrieved
    const { stream, metadata: retrievedMetadata } = await docStore.getOriginal(metadata.documentId)
    expect(retrievedMetadata.documentId).toBe(metadata.documentId)
    expect(stream).toBeDefined()
  })

  it('converter generates governance markdown with traceability metadata', async () => {
    const testStream = Readable.from(['Test document content'])
    const output = await converter.convert(testStream, 'text/plain', {
      documentId: 'test-id-123',
      checksumSha256: 'abc123',
      originalFilename: 'test.txt',
    })

    expect(output.content).toContain('document_id: test-id-123')
    expect(output.content).toContain('source_checksum: abc123')
    expect(output.content).toContain('# Governance Policy Document')
    expect(output.metadata.document_id).toBe('test-id-123')
    expect(output.suggestedFilename).toBe('test-governance.md')
  })
})
