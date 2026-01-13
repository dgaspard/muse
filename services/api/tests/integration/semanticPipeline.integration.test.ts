import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { MusePipelineOrchestrator } from '../../src/orchestration/MusePipelineOrchestrator'
import { InMemoryDocumentStore } from '../../src/storage/documentStore'
import { DocumentToMarkdownConverter, MarkdownOutput } from '../../src/conversion/documentToMarkdownConverter'
import { Readable } from 'stream'

class LargeDocConverter implements DocumentToMarkdownConverter {
  supports(mimeType: string): boolean {
    return ['text/plain', 'application/pdf'].includes(mimeType)
  }
  async convert(_stream: Readable, _mimeType: string, metadata: any): Promise<MarkdownOutput> {
    // Generate a large markdown document (> 2000 chars) with multiple sections
    const sections: string[] = []
    for (let i = 1; i <= 20; i++) {
      sections.push(`## Section ${i}\n- Obligation ${i}.1 must be met.\n- Obligation ${i}.2 must be met.\n- Obligation ${i}.3 must be met.\n`)
    }
    const content = `---\ndocument_id: ${metadata.documentId}\nsource_checksum: ${metadata.checksumSha256}\noriginal_filename: ${metadata.originalFilename}\nderived_artifact: governance_markdown\ngenerated_at: ${new Date().toISOString()}\n---\n\n# Large Governance Document\n\n${sections.join('\n')}\n`
    return {
      content,
      metadata: {
        document_id: metadata.documentId,
        source_checksum: metadata.checksumSha256,
        original_filename: metadata.originalFilename,
        derived_artifact: 'governance_markdown',
        generated_at: new Date().toISOString(),
      },
      suggestedFilename: 'large-governance.md',
    }
  }
  getSupportedMimeTypes(): string[] { return ['text/plain', 'application/pdf'] }
}

describe('Integration: Staged Semantic Pipeline for Large Docs', () => {
  let tempDir: string
  let docStore: InMemoryDocumentStore
  let converter: LargeDocConverter
  let orchestrator: MusePipelineOrchestrator

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-semantic-int-'))
    docStore = new InMemoryDocumentStore()
    converter = new LargeDocConverter()
    orchestrator = new MusePipelineOrchestrator(docStore, converter, tempDir)
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('produces epics, features, and stories with governance lineage', async () => {
    const fileBuffer = Buffer.from('large content')
    const result = await orchestrator.executePipeline(fileBuffer, {
      originalFilename: 'large.pdf',
      mimeType: 'application/pdf',
      sizeBytes: fileBuffer.length,
      projectId: 'test-project',
    })

    expect(result.validation.isValid).toBe(true)
    expect(result.epics.length).toBeGreaterThan(0)
    expect(result.features.length).toBeGreaterThan(0)
    expect(result.stories.length).toBeGreaterThan(0)

    // Governance references should include section ids from splitter (sec-...)
    const epicRefs = result.epics[0].governance_references
    expect(epicRefs.length).toBeGreaterThan(0)
    expect(epicRefs[0]).toMatch(/^sec-/)

    const featureRefs = result.features[0].governance_references
    expect(featureRefs.length).toBeGreaterThan(0)
    expect(featureRefs[0]).toMatch(/^sec-/)

    const storyRefs = result.stories[0].governance_references
    expect(storyRefs.length).toBeGreaterThan(0)
    expect(storyRefs[0]).toMatch(/^sec-/)
  })
})
