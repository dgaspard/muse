import { SectionSummary } from './SectionSummaryJob'

export interface Epic {
  epic_id: string
  objective: string
  success_criteria: string[]
  source_sections: string[]
}

/**
 * EpicDerivationJob — Group section summaries into coherent epics
 * 
 * Epics represent strategic governance outcomes derived from curated section summaries.
 * This consumes structured summaries (obligations, outcomes, actors, constraints), NOT raw markdown.
 */
export class EpicDerivationJob {
  constructor(private readonly docId: string) {}

  run(summaries: SectionSummary[]): Epic[] {
    // Deterministic grouping: one epic per 5 summaries (can be enhanced with clustering)
    const epics: Epic[] = []
    for (let i = 0; i < summaries.length; i += 5) {
      const group = summaries.slice(i, i + 5)
      const num = String(epics.length + 1).padStart(2, '0')
      const epic_id = `epic-${this.docId.substring(0,8)}-${num}`

      // Objective: Derive from first meaningful outcome or obligation
      let objective = 'Governance outcome'
      if (group[0]?.outcomes.length > 0) {
        objective = group[0].outcomes[0]
      } else if (group[0]?.obligations.length > 0) {
        objective = group[0].obligations[0]
      }

      // Success criteria: Combine outcomes and key obligations from all summaries in group
      const success_criteria: string[] = []
      for (const summary of group) {
        // Prioritize outcomes (what we achieve)
        for (const outcome of summary.outcomes.slice(0, 2)) {
          if (!success_criteria.includes(outcome)) {
            success_criteria.push(outcome)
          }
        }
        // Add key obligations as criteria
        for (const obligation of summary.obligations.slice(0, 1)) {
          if (!success_criteria.includes(obligation) && success_criteria.length < 6) {
            success_criteria.push(obligation)
          }
        }
      }

      const source_sections = group.map(s => s.section_id)
      epics.push({ epic_id, objective, success_criteria: success_criteria.slice(0, 6), source_sections })
    }
    return epics.slice(0, 12)
  }
}
