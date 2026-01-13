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

/**
 * FeatureDerivationJob — Derive features from epic-related section summaries
 * 
 * Features represent tactical capabilities derived from curated section summaries.
 * Uses obligations and outcomes to generate meaningful feature titles and descriptions.
 */
export class FeatureDerivationJob {
  run(epic: Epic, summaries: SectionSummary[]): Feature[] {
    const features: Feature[] = []
    const grouped = summaries.filter(s => epic.source_sections.includes(s.section_id)).slice(0,25)
    
    for (let i = 0; i < grouped.length; i += 5) {
      const bucket = grouped.slice(i, i + 5)
      const num = String(features.length + 1).padStart(2, '0')
      const feature_id = `${epic.epic_id}-feature-${num}`
      
      // Title: Use section title or first obligation
      const title = bucket[0]?.title || bucket[0]?.obligations[0] || `Feature ${num}`
      
      // Description: Combine key obligations and outcomes
      const descParts: string[] = []
      for (const summary of bucket) {
        if (summary.obligations.length > 0) {
          descParts.push(summary.obligations[0])
        }
        if (summary.outcomes.length > 0) {
          descParts.push(summary.outcomes[0])
        }
      }
      const description = descParts.slice(0, 3).join('. ') || `Derived from sections: ${bucket.map(b => b.section_id).join(', ')}`
      
      features.push({ 
        feature_id, 
        title, 
        description, 
        epic_id: epic.epic_id, 
        source_sections: bucket.map(b => b.section_id) 
      })
    }
    return features.slice(0,5)
  }
}
