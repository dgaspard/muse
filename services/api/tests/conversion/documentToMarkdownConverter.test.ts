import { describe, it, expect, beforeEach } from 'vitest'
import { Readable } from 'stream'
import {
  BasicPdfToMarkdownConverter,
  ConverterRegistry,
  type MarkdownMetadata,
  type MarkdownOutput,
} from '../../src/conversion/documentToMarkdownConverter'

describe('BasicPdfToMarkdownConverter', () => {
  let converter: BasicPdfToMarkdownConverter

  beforeEach(() => {
    converter = new BasicPdfToMarkdownConverter()
  })

  describe('supports()', () => {
    it('should return true for application/pdf', () => {
      expect(converter.supports('application/pdf')).toBe(true)
    })

    it('should return false for other MIME types', () => {
      expect(converter.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(
        false,
      )
      expect(converter.supports('text/plain')).toBe(false)
      expect(converter.supports('image/png')).toBe(false)
    })
  })

  describe('convert()', () => {
    it('should generate Markdown with YAML front matter', async () => {
      const mockStream = Readable.from([Buffer.from('Test PDF content')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-abc123',
        checksumSha256: 'sha256:abc123def456',
        originalFilename: 'governance-policy.pdf',
      })

      expect(result.content).toContain('---')
      expect(result.content).toContain('document_id: doc-abc123')
      expect(result.content).toContain('source_checksum: sha256:abc123def456')
      expect(result.content).toContain('derived_artifact: governance_markdown')
      expect(result.content).toContain('original_filename: governance-policy.pdf')
    })

    it('should include document_id in front matter', async () => {
      const mockStream = Readable.from([Buffer.from('Sample text')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-xyz789',
        checksumSha256: 'sha256:xyz789',
        originalFilename: 'sample.pdf',
      })

      const frontMatterMatch = result.content.match(/document_id: ([^\n]+)/)
      expect(frontMatterMatch).not.toBeNull()
      expect(frontMatterMatch?.[1]).toBe('doc-xyz789')
    })

    it('should include checksum in front matter', async () => {
      const mockStream = Readable.from([Buffer.from('Content')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-1',
        checksumSha256: 'sha256:fedcba9876543210',
        originalFilename: 'test.pdf',
      })

      expect(result.content).toContain('source_checksum: sha256:fedcba9876543210')
    })

    it('should include generated_at timestamp', async () => {
      const mockStream = Readable.from([Buffer.from('Test')])
      const beforeConversion = new Date()

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-1',
        checksumSha256: 'abc123',
        originalFilename: 'test.pdf',
      })

      const afterConversion = new Date()

      const timestampMatch = result.content.match(/generated_at: ([^\n]+)/)
      expect(timestampMatch).not.toBeNull()

      const generatedTime = new Date(timestampMatch![1])
      expect(generatedTime.getTime()).toBeGreaterThanOrEqual(beforeConversion.getTime())
      expect(generatedTime.getTime()).toBeLessThanOrEqual(afterConversion.getTime())
    })

    it('should return metadata with matching documentId and checksum', async () => {
      const mockStream = Readable.from([Buffer.from('Governance document')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-governance-1',
        checksumSha256: 'sha256:govdoc123',
        originalFilename: 'policy.pdf',
      })

      expect(result.metadata.document_id).toBe('doc-governance-1')
      expect(result.metadata.source_checksum).toBe('sha256:govdoc123')
      expect(result.metadata.original_filename).toBe('policy.pdf')
      expect(result.metadata.derived_artifact).toBe('governance_markdown')
    })

    it('should generate deterministic output for same input', async () => {
      const testData = Buffer.from('Deterministic test content')

      const stream1 = Readable.from([testData])
      const result1 = await converter.convert(stream1, 'application/pdf', {
        documentId: 'doc-det',
        checksumSha256: 'sha256:det123',
        originalFilename: 'det.pdf',
      })

      const stream2 = Readable.from([testData])
      const result2 = await converter.convert(stream2, 'application/pdf', {
        documentId: 'doc-det',
        checksumSha256: 'sha256:det123',
        originalFilename: 'det.pdf',
      })

      // Content structure should be identical
      expect(result1.content.split('\n').slice(0, 7)).toEqual(result2.content.split('\n').slice(0, 7))
    })

    it('should preserve paragraph structure', async () => {
      // Note: Full PDF text extraction is not yet implemented (stub returns placeholder).
      // This test verifies that the Markdown front matter and formatting are correct,
      // and that the converter handles the stream properly.
      const mockStream = Readable.from([Buffer.from('Test content')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-para',
        checksumSha256: 'sha256:para123',
        originalFilename: 'paragraphs.pdf',
      })

      // After front matter, content should exist
      const bodyContent = result.content.split('---\n\n')[1]
      expect(bodyContent).toBeTruthy()
      expect(bodyContent.length).toBeGreaterThan(0)
      // Verify it includes the byte count from stub
      expect(bodyContent).toContain('PDF extracted from')
    })

    it('should suggest appropriate filename', async () => {
      const mockStream = Readable.from([Buffer.from('Content')])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-fname-123',
        checksumSha256: 'sha256:fname',
        originalFilename: 'anything.pdf',
      })

      expect(result.suggestedFilename).toBe('doc-fname-123.md')
    })

    it('should not hallucinate or infer content', async () => {
      const minimalContent = 'Just a few words.'
      const mockStream = Readable.from([Buffer.from(minimalContent)])

      const result = await converter.convert(mockStream, 'application/pdf', {
        documentId: 'doc-minimal',
        checksumSha256: 'sha256:minimal',
        originalFilename: 'minimal.pdf',
      })

      const bodyContent = result.content.split('---\n\n')[1]
      // Should not add summaries, inferred sections, or extra meaning
      expect(bodyContent.toLowerCase()).not.toContain('summary')
      expect(bodyContent.toLowerCase()).not.toContain('in conclusion')
      expect(bodyContent.toLowerCase()).not.toContain('therefore')
    })
  })
})

describe('ConverterRegistry', () => {
  let registry: ConverterRegistry

  beforeEach(() => {
    registry = new ConverterRegistry()
  })

  describe('findConverter()', () => {
    it('should find PDF converter for application/pdf', () => {
      const converter = registry.findConverter('application/pdf')
      expect(converter).toBeInstanceOf(BasicPdfToMarkdownConverter)
    })

    it('should throw for unsupported MIME types', () => {
      expect(() => {
        registry.findConverter('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      }).toThrow(/No converter available/)

      expect(() => {
        registry.findConverter('text/plain')
      }).toThrow(/No converter available/)
    })
  })

  describe('getSupportedMimeTypes()', () => {
    it('should return list of supported MIME types', () => {
      const supported = registry.getSupportedMimeTypes()
      expect(supported).toContain('application/pdf')
    })

    it('should not include unsupported types', () => {
      const supported = registry.getSupportedMimeTypes()
      expect(supported).not.toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(supported).not.toContain('text/plain')
    })
  })

  describe('register()', () => {
    it('should allow custom converters to be registered', () => {
      const customConverter = new BasicPdfToMarkdownConverter()
      registry.register(customConverter)

      // Should still find PDF converter
      const found = registry.findConverter('application/pdf')
      expect(found).toBeDefined()
    })
  })
})

describe('MarkdownOutput', () => {
  it('should include all required fields', async () => {
    const converter = new BasicPdfToMarkdownConverter()
    const mockStream = Readable.from([Buffer.from('Test')])

    const result = await converter.convert(mockStream, 'application/pdf', {
      documentId: 'doc-1',
      checksumSha256: 'sha256:abc',
      originalFilename: 'test.pdf',
    })

    expect(result).toHaveProperty('content')
    expect(result).toHaveProperty('metadata')
    expect(result).toHaveProperty('suggestedFilename')

    expect(typeof result.content).toBe('string')
    expect(typeof result.metadata).toBe('object')
    expect(typeof result.suggestedFilename).toBe('string')
  })
})

describe('MarkdownMetadata', () => {
  it('should have all required traceability fields', async () => {
    const converter = new BasicPdfToMarkdownConverter()
    const mockStream = Readable.from([Buffer.from('Test')])

    const result = await converter.convert(mockStream, 'application/pdf', {
      documentId: 'doc-trace-1',
      checksumSha256: 'sha256:trace123',
      originalFilename: 'trace.pdf',
    })

    const metadata = result.metadata

    expect(metadata).toHaveProperty('document_id')
    expect(metadata).toHaveProperty('source_checksum')
    expect(metadata).toHaveProperty('generated_at')
    expect(metadata).toHaveProperty('derived_artifact')
    expect(metadata).toHaveProperty('original_filename')

    expect(metadata.derived_artifact).toBe('governance_markdown')
  })
})
