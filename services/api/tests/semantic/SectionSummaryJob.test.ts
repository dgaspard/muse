import { describe, it, expect } from 'vitest'
import { SectionSummaryJob } from '../../src/semantic/SectionSummaryJob'

describe('SectionSummaryJob', () => {
  it('caches summaries by section id + content', async () => {
    const cache = new Map<string, any>()
    const job = new SectionSummaryJob(cache)
    const content = `## Obligations\n- do X\n- do Y\n`
    const first = await job.run('sec-doc-0001-aaaa', content)
    expect(first.cached).toBe(false)
    expect(first.obligations).toEqual(['do X', 'do Y'])

    const second = await job.run('sec-doc-0001-aaaa', content)
    expect(second.cached).toBe(true)
    expect(second.section_id).toBe(first.section_id)
    expect(second.obligations).toEqual(first.obligations)
  })
})
