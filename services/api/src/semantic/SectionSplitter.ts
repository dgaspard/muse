import crypto from 'crypto'

export interface Section {
  id: string
  title: string
  content: string
  source_path: string
  start_line: number
  end_line: number
}

/**
 * SectionSplitter — Semantic chunking for governance documents
 * 
 * Strategy:
 * 1. Normalize & Clean: Strip structural artifacts (TOC, page numbers, dot leaders)
 * 2. Semantic Anchors: Identify meaningful headers (not formatting headers)
 * 3. Semantic Blocks: Group content by coherent obligation/outcome
 * 4. Preserve narrative continuity over arbitrary token limits
 */
export class SectionSplitter {
  constructor(private readonly sourcePath: string) {}

  /**
   * Normalize governance markdown by removing structural noise.
   * STEP 0 — MANDATORY before chunking.
   */
  private normalizeMarkdown(markdown: string): string {
    let normalized = markdown

    // Remove table of contents patterns (lines with dot leaders)
    normalized = normalized.replace(/^.+\.{3,}.+$/gm, '')

    // Remove page number patterns ("7-8", "1 of 112", "-- 1 --")
    normalized = normalized.replace(/^\d+ of \d+\s*--?\s*$/gm, '')
    normalized = normalized.replace(/^--?\s*\d+\s*--?$/gm, '')
    normalized = normalized.replace(/^\s*\d+-\d+\s*$/gm, '')

    // Remove isolated page markers and footers
    normalized = normalized.replace(/^\s*Page \d+.*$/gm, '')
    normalized = normalized.replace(/^\s*-+\s*$/gm, '')

    // Remove empty numbered headings (e.g., "3.2.1" alone on a line)
    normalized = normalized.replace(/^\s*\d+(\.\d+)*\s*$/gm, '')

    // Collapse multiple blank lines to max 2
    normalized = normalized.replace(/\n{3,}/g, '\n\n')

    return normalized.trim()
  }

  /**
   * Determine if a header is a semantic anchor (meaningful) vs. structural.
   */
  private isSemanticAnchor(title: string): boolean {
    const nonSemantic = [
      /^\d+(\.\d+)*$/,           // Pure numbers: "3.2.1"
      /^overview$/i,
      /^general$/i,
      /^introduction$/i,         // Unless it has content
      /^definitions$/i,
      /^appendix [a-z]$/i,
      /^table of contents$/i,
      /^contents$/i,
    ]

    for (const pattern of nonSemantic) {
      if (pattern.test(title.trim())) {
        return false
      }
    }

    // Must have at least some meaningful words (not just numbers/punctuation)
    return /[a-zA-Z]{3,}/.test(title)
  }

  split(markdown: string, documentId: string): Section[] {
    // STEP 0: Normalize & Clean
    const normalized = this.normalizeMarkdown(markdown)
    const lines = normalized.split(/\r?\n/)
    const sections: Section[] = []
    let currentTitle = 'Introduction'
    let currentStart = 1

    const flush = (start: number, end: number, title: string, idx: number) => {
      const content = lines.slice(start - 1, end).join('\n').trim()
      // Skip empty or near-empty sections
      if (content.length < 50) return

      const hash = crypto.createHash('sha256').update(title + content).digest('hex').slice(0, 8)
      const id = `sec-${documentId.substring(0,8)}-${String(idx).padStart(2,'0')}-${hash}`
      sections.push({ id, title, content, source_path: this.sourcePath, start_line: start, end_line: end })
    }

    let idx = 1
    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1
      const line = lines[i]
      const headerMatch = line.match(/^##+\s+(.*)$/)
      
      if (headerMatch) {
        const headerTitle = headerMatch[1].trim()
        
        // STEP 1: Check if this is a semantic anchor
        if (this.isSemanticAnchor(headerTitle)) {
          // Close previous section
          if (lineNo - 1 >= currentStart) {
            flush(currentStart, lineNo - 1, currentTitle, idx++)
          }
          currentTitle = headerTitle
          currentStart = lineNo + 1
        }
        // Non-semantic headers are absorbed into current section
      }
    }
    
    // Flush final section (allow it even if we have no semantic anchors found)
    if (currentStart <= lines.length) {
      flush(currentStart, lines.length, currentTitle, idx++)
    }

    return sections
  }
}
