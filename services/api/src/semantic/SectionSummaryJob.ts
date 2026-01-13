import crypto from 'crypto'

export interface SectionSummary {
  section_id: string
  obligations: string[]
  actors: string[]
  constraints: string[]
  references: string[]
  cached: boolean
}

export class SectionSummaryJob {
  constructor(private readonly cache: Map<string, SectionSummary>) {}

  private key(sectionId: string, content: string): string {
    const hash = crypto.createHash('sha256').update(sectionId + content).digest('hex').slice(0,16)
    return `summary:${sectionId}:${hash}`
  }

  async run(sectionId: string, content: string): Promise<SectionSummary> {
    const k = this.key(sectionId, content)
    const cached = this.cache.get(k)
    if (cached) {
      return { ...cached, cached: true }
    }
    // Deterministic rule-based placeholder summary (no LLM)
    const obligations = (content.match(/-\s+(.+)/g) || []).map(x => x.replace(/-\s+/, '')).slice(0,5)
    const summary: SectionSummary = {
      section_id: sectionId,
      obligations,
      actors: [],
      constraints: [],
      references: [],
      cached: false,
    }
    this.cache.set(k, summary)
    return summary
  }
}
