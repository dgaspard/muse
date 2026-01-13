import { SectionSummary } from './SectionSummaryJob'

export interface Epic {
  epic_id: string
  objective: string
  success_criteria: string[]
  source_sections: string[]
}

export class EpicDerivationJob {
  constructor(private readonly docId: string) {}

  run(summaries: SectionSummary[]): Epic[] {
    // Deterministic grouping: one epic per 5 summaries (placeholder)
    const epics: Epic[] = []
    for (let i = 0; i < summaries.length; i += 5) {
      const group = summaries.slice(i, i + 5)
      const num = String(epics.length + 1).padStart(2, '0')
      const epic_id = `epic-${this.docId.substring(0,8)}-${num}`
      const objective = group[0]?.obligations[0] || 'Governance outcome'
      const success_criteria = group.flatMap(s => s.obligations).slice(0,6)
      const source_sections = group.map(s => s.section_id)
      epics.push({ epic_id, objective, success_criteria, source_sections })
    }
    return epics.slice(0,12)
  }
}
