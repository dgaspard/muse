import crypto from 'crypto'

export interface Section {
  id: string
  title: string
  content: string
  source_path: string
  start_line: number
  end_line: number
}

export class SectionSplitter {
  constructor(private readonly sourcePath: string) {}

  split(markdown: string, documentId: string): Section[] {
    const lines = markdown.split(/\r?\n/)
    const sections: Section[] = []
    let currentTitle = 'Introduction'
    let currentStart = 1

    const flush = (start: number, end: number, title: string, idx: number) => {
      const content = lines.slice(start - 1, end).join('\n')
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
        // close previous section
        if (lineNo - 1 >= currentStart) {
          flush(currentStart, lineNo - 1, currentTitle, idx++)
        }
        currentTitle = headerMatch[1].trim()
        currentStart = lineNo + 1
      }
    }
    // flush tail
    if (currentStart <= lines.length) {
      flush(currentStart, lines.length, currentTitle, idx++)
    }

    return sections
  }
}
