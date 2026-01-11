import { Readable } from 'stream'

/**
 * Metadata included in the YAML front matter of generated Markdown.
 * This ensures the derived artifact remains traceable to the immutable original.
 */
export type MarkdownMetadata = {
  /** SHA-256 checksum of the original document (immutable) */
  source_checksum: string
  /** UUID or content-hash ID of the original document */
  document_id: string
  /** ISO 8601 timestamp when this Markdown was generated */
  generated_at: string
  /** Artifact type identifier */
  derived_artifact: 'governance_markdown'
  /** Original filename from the source document */
  original_filename: string
}

/**
 * Output of the conversion process.
 */
export type MarkdownOutput = {
  /** Markdown content with YAML front matter */
  content: string
  /** Metadata for traceability */
  metadata: MarkdownMetadata
  /** Suggested filename for storage */
  suggestedFilename: string
}

/**
 * Interface for converting documents to Markdown.
 *
 * Implementations must:
 * - Preserve section headings and hierarchy
 * - Maintain paragraph boundaries
 * - NOT hallucinate content
 * - NOT infer or summarize policy meaning
 * - Generate output deterministically
 */
export interface DocumentToMarkdownConverter {
  /**
   * Converts a document stream to Markdown.
   *
   * @param stream - Readable stream of the document bytes
   * @param mimeType - MIME type of the document (e.g., "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
   * @param metadata - Traceability metadata from the immutable original
   * @returns Promise<MarkdownOutput> - Converted Markdown with front matter
   * @throws Error if the document format is not supported or conversion fails
   */
  convert(
    stream: Readable,
    mimeType: string,
    metadata: {
      documentId: string
      checksumSha256: string
      originalFilename: string
    },
  ): Promise<MarkdownOutput>

  /**
   * Check if this converter supports the given MIME type.
   *
   * @param mimeType - MIME type to check
   * @returns true if this converter can handle the format
   */
  supports(mimeType: string): boolean

  /**
   * Get list of supported MIME types.
   *
   * @returns Array of MIME types this converter can handle
   */
  getSupportedMimeTypes(): string[]
}

/**
 * Basic PDF to Markdown converter using text extraction.
 * Does NOT attempt OCR or fancy layout reconstruction.
 * Simply extracts text and preserves paragraph structure where evident.
 */
export class BasicPdfToMarkdownConverter implements DocumentToMarkdownConverter {
  private readonly generatedAtCache: Map<string, string> = new Map()
  
  async convert(
    stream: Readable,
    _mimeType: string,
    metadata: {
      documentId: string
      checksumSha256: string
      originalFilename: string
    },
  ): Promise<MarkdownOutput> {
    // For now, return a placeholder that demonstrates the structure.
    // In production, this would use a library like pdf-parse or pdfjs-dist.
    const text = await this.extractTextFromStream(stream)

    const cacheKey = `${metadata.documentId}|${metadata.checksumSha256}|${metadata.originalFilename}`
    let generatedAt = this.generatedAtCache.get(cacheKey)
    if (!generatedAt) {
      generatedAt = new Date().toISOString()
      this.generatedAtCache.set(cacheKey, generatedAt)
    }

    const frontMatter: MarkdownMetadata = {
      document_id: metadata.documentId,
      source_checksum: metadata.checksumSha256,
      generated_at: generatedAt,
      derived_artifact: 'governance_markdown',
      original_filename: metadata.originalFilename,
    }

    const markdownContent = this.formatAsMarkdown(text, frontMatter)

    const suggestedFilename = `${metadata.documentId}.md`

    return {
      content: markdownContent,
      metadata: frontMatter,
      suggestedFilename,
    }
  }

  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf'
  }

  getSupportedMimeTypes(): string[] {
    return ['application/pdf']
  }

  /**
   * Extract text from a PDF stream using pdf-parse.
   * The pdf-parse module v2.4.5+ exports a PDFParse class.
   */
  private async extractTextFromStream(stream: Readable): Promise<string> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks as Uint8Array[])
          
          // pdf-parse v2.4.5 exports named exports including PDFParse class
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { PDFParse } = require('pdf-parse')
          
          // Create a new parser instance with the PDF data
          const parser = new PDFParse({ data: buffer })
          
          // Use getText() method to extract text from all pages
          const textResult = await parser.getText()
          const text = textResult.text || ''
          
          // Clean up resources
          await parser.destroy()
          
          if (!text || text.trim().length === 0) {
            reject(new Error('PDF contains no extractable text. Document may be image-based or encrypted.'))
            return
          }
          
          resolve(text)
        } catch (err) {
          reject(new Error(`PDF parsing failed: ${(err as Error).message}`))
        }
      })
      stream.on('error', reject)
    })
  }

  /**
   * Format extracted text as Markdown with YAML front matter.
   */
  private formatAsMarkdown(text: string, metadata: MarkdownMetadata): string {
    const yamlFrontMatter = `---
document_id: ${metadata.document_id}
source_checksum: ${metadata.source_checksum}
generated_at: ${metadata.generated_at}
derived_artifact: ${metadata.derived_artifact}
original_filename: ${metadata.original_filename}
---

`

    // Simple paragraph-aware formatting:
    // Split on double newlines and preserve structure
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .join('\n\n')

    return yamlFrontMatter + paragraphs
  }
}

/**
 * Converter registry to manage multiple converter implementations.
 */
export class ConverterRegistry {
  private readonly converters: DocumentToMarkdownConverter[] = []

  constructor() {
    // Register built-in converters
    this.register(new BasicPdfToMarkdownConverter())
    // TODO: Register additional converters as they are implemented (DOCX, etc.)
  }

  /**
   * Register a new converter implementation.
   */
  register(converter: DocumentToMarkdownConverter): void {
    this.converters.push(converter)
  }

  /**
   * Find a converter that supports the given MIME type.
   */
  findConverter(mimeType: string): DocumentToMarkdownConverter {
    const converter = this.converters.find((c) => c.supports(mimeType))
    if (!converter) {
      throw new Error(
        `No converter available for MIME type: ${mimeType}. Supported: ${this.getSupportedMimeTypes().join(', ')}`,
      )
    }
    return converter
  }

  /**
   * Get list of supported MIME types.
   */
  getSupportedMimeTypes(): string[] {
    return this.converters.flatMap((c) => c.getSupportedMimeTypes())
  }
}
