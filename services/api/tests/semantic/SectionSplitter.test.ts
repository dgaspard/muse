import { describe, it, expect } from 'vitest'
import { SectionSplitter } from '../../src/semantic/SectionSplitter'

describe('SectionSplitter', () => {
  it('produces deterministic sections', () => {
    const md = `# Doc\n\n## A\n- one\n\n## B\n- two\n`
    const splitter = new SectionSplitter('/path/doc.md')
    const a = splitter.split(md, 'doc-1234')
    const b = splitter.split(md, 'doc-1234')
    expect(a).toEqual(b)
    expect(a.length).toBe(3)
    expect(a[0].title).toBe('Introduction')
    expect(a[1].title).toBe('A')
    expect(a[2].title).toBe('B')
  })
})
