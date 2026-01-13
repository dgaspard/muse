import { Epic } from './EpicDerivationJob'
import { SectionSummary } from './SectionSummaryJob'

export interface Feature {
  feature_id: string
  title: string
  description: string
  epic_id: string
  source_sections: string[]
  children?: Feature[]
}

export class FeatureDerivationJob {
  run(epic: Epic, summaries: SectionSummary[]): Feature[] {
    const features: Feature[] = []
    const grouped = summaries.filter(s => epic.source_sections.includes(s.section_id)).slice(0,25)
    for (let i = 0; i < grouped.length; i += 5) {
      const bucket = grouped.slice(i, i + 5)
      const num = String(features.length + 1).padStart(2, '0')
      const feature_id = `project-${epic.epic_id}-feature-${num}`.replace(/^project-/, '')
      const title = bucket[0]?.obligations[0] || `Feature ${num}`
      const description = `Derived from sections: ${bucket.map(b => b.section_id).join(', ')}`
      features.push({ feature_id, title, description, epic_id: epic.epic_id, source_sections: bucket.map(b => b.section_id) })
    }
    return features.slice(0,5)
  }
}
