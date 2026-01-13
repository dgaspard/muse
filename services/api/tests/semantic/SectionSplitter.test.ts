import { describe, it, expect } from 'vitest'
import { SectionSplitter } from '../../src/semantic/SectionSplitter'

describe('SectionSplitter', () => {
  it('produces deterministic sections', () => {
    const md = `# Doc\n\n## Meaningful Section A\nThis is some longer content about obligations and requirements that should be meaningful enough to pass the minimum length check.\n\n## Meaningful Section B\nThis is another section with enough content to be considered meaningful and not be filtered out by the splitter.\n`
    const splitter = new SectionSplitter('/path/doc.md')
    const a = splitter.split(md, 'doc-1234')
    const b = splitter.split(md, 'doc-1234')
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
    expect(a[0].title).toContain('Meaningful')
  })
})
