import { describe, it, expect } from 'vitest'
import { SectionSummaryJob } from '../../src/semantic/SectionSummaryJob'

describe('SectionSummaryJob', () => {
  it('caches summaries by section id + content', async () => {
    const cache = new Map<string, any>()
    const job = new SectionSummaryJob(cache)
    const content = `Agencies must maintain proper records and documentation.

The system should ensure compliance with federal standards.

## Obligations
- Agencies must document all transactions in accordance with federal policy
- Systems should validate credentials against the authoritative database
`
    const first = await job.run('sec-doc-0001-aaaa', 'Test Section', content)
    expect(first.cached).toBe(false)
    expect(first.title).toBe('Test Section')
    expect(first.obligations.length).toBeGreaterThan(0)

    const second = await job.run('sec-doc-0001-aaaa', 'Test Section', content)
    expect(second.cached).toBe(true)
    expect(second.section_id).toBe(first.section_id)
    expect(second.obligations).toEqual(first.obligations)
  })
})
