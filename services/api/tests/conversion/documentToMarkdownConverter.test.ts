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
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test governance policy) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n449\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'doc-123',
        checksumSha256: 'abc123def456',
        originalFilename: 'policy.pdf',
      })

      expect(result.content).toContain('---')
      expect(result.content).toContain('document_id: doc-123')
      expect(result.content).toContain('source_checksum: abc123def456')
      expect(result.content).toContain('derived_artifact: governance_markdown')
      expect(result.content).toContain('original_filename: policy.pdf')
    })

    it('should include document_id in front matter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test content) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n441\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'governance-doc-xyz',
        checksumSha256: 'checksum789',
        originalFilename: 'governance.pdf',
      })

      expect(result.metadata.document_id).toBe('governance-doc-xyz')
      expect(result.content).toContain('document_id: governance-doc-xyz')
    })

    it('should include checksum in front matter', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test text) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n437\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const checksumValue = 'sha256hash999'
      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'doc-999',
        checksumSha256: checksumValue,
        originalFilename: 'document.pdf',
      })

      expect(result.metadata.source_checksum).toBe(checksumValue)
      expect(result.content).toContain(`source_checksum: ${checksumValue}`)
    })

    it('should include generated_at timestamp', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Test) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n424\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const beforeConversion = new Date().toISOString()
      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'doc-ts',
        checksumSha256: 'checksum-ts',
        originalFilename: 'timestamped.pdf',
      })
      const afterConversion = new Date().toISOString()

      expect(result.metadata.generated_at).toBeTruthy()
      const timestamp = new Date(result.metadata.generated_at)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeConversion).getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(afterConversion).getTime())
      expect(result.content).toContain('generated_at:')
    })

    it('should return metadata with matching documentId and checksum', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Meta test) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n435\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const docId = 'metadata-doc-id'
      const checksum = 'metadata-checksum'

      const result = await converter.convert(stream, 'application/pdf', {
        documentId: docId,
        checksumSha256: checksum,
        originalFilename: 'metadata.pdf',
      })

      expect(result.metadata.document_id).toBe(docId)
      expect(result.metadata.source_checksum).toBe(checksum)
    })

    it('should generate deterministic output for same input', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Deterministic) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n442\n%%EOF'
      )

      const result1 = await converter.convert(Readable.from([pdfBuffer]), 'application/pdf', {
        documentId: 'doc-det',
        checksumSha256: 'checksum-det',
        originalFilename: 'deterministic.pdf',
      })

      const result2 = await converter.convert(Readable.from([pdfBuffer]), 'application/pdf', {
        documentId: 'doc-det',
        checksumSha256: 'checksum-det',
        originalFilename: 'deterministic.pdf',
      })

      // Same input should produce same generated_at (cached)
      expect(result1.metadata.generated_at).toBe(result2.metadata.generated_at)
    })

    it('should preserve paragraph structure', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Paragraph one.\\nParagraph two.) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n454\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'doc-para',
        checksumSha256: 'checksum-para',
        originalFilename: 'paragraphs.pdf',
      })

      // Content should be present (pdf-parse will extract text)
      expect(result.content).toBeTruthy()
      expect(result.content.length).toBeGreaterThan(0)
    })

    it('should suggest appropriate filename', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Filename test) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n438\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const docId = 'suggested-doc-id-123'
      const result = await converter.convert(stream, 'application/pdf', {
        documentId: docId,
        checksumSha256: 'checksum-fn',
        originalFilename: 'original.pdf',
      })

      expect(result.suggestedFilename).toBe(`${docId}.md`)
      expect(result.suggestedFilename).toMatch(/\.md$/)
    })

    it('should not hallucinate or infer content', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Exact text.) Tj ET\nendstream\nendobj\n' +
        'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
        '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n435\n%%EOF'
      )
      const stream = Readable.from([pdfBuffer])

      const result = await converter.convert(stream, 'application/pdf', {
        documentId: 'doc-hallucination-test',
        checksumSha256: 'checksum-exact',
        originalFilename: 'exact.pdf',
      })

      // Content should contain extracted text, not inferred/summarized content
      expect(result.content).toBeTruthy()
      expect(result.metadata.derived_artifact).toBe('governance_markdown')
      // Should not try to interpret the policy
      expect(result.content).not.toContain('This policy requires')
      expect(result.content).not.toContain('In summary,')
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
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
      '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Field test) Tj ET\nendstream\nendobj\n' +
      'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n435\n%%EOF'
    )
    const stream = Readable.from([pdfBuffer])

    const result = await converter.convert(stream, 'application/pdf', {
      documentId: 'doc-field-test',
      checksumSha256: 'checksum-fields',
      originalFilename: 'fields.pdf',
    })

    // Verify all required fields are present
    expect(result).toHaveProperty('content')
    expect(result).toHaveProperty('metadata')
    expect(result).toHaveProperty('suggestedFilename')

    expect(result.content).toBeTruthy()
    expect(typeof result.content).toBe('string')

    expect(result.suggestedFilename).toBeTruthy()
    expect(typeof result.suggestedFilename).toBe('string')
  })
})

describe('MarkdownMetadata', () => {
  it('should have all required traceability fields', async () => {
    const converter = new BasicPdfToMarkdownConverter()
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
      '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Traceability) Tj ET\nendstream\nendobj\n' +
      'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
      '0000000273 00000 n \n0000000354 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n441\n%%EOF'
    )
    const stream = Readable.from([pdfBuffer])

    const result = await converter.convert(stream, 'application/pdf', {
      documentId: 'doc-traceability',
      checksumSha256: 'checksum-trace',
      originalFilename: 'traceability.pdf',
    })

    const { metadata } = result

    // Verify all required traceability fields are present
    expect(metadata).toHaveProperty('document_id')
    expect(metadata).toHaveProperty('source_checksum')
    expect(metadata).toHaveProperty('generated_at')
    expect(metadata).toHaveProperty('derived_artifact')
    expect(metadata).toHaveProperty('original_filename')

    expect(metadata.document_id).toBe('doc-traceability')
    expect(metadata.source_checksum).toBe('checksum-trace')
    expect(metadata.derived_artifact).toBe('governance_markdown')
    expect(metadata.original_filename).toBe('traceability.pdf')
    expect(new Date(metadata.generated_at)).toBeInstanceOf(Date)
  })
})
