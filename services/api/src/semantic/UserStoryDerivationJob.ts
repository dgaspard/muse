import { Feature } from './FeatureDerivationJob'

export interface Story {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  epic_id: string
  feature_id: string
  source_sections: string[]
}

export class UserStoryDerivationJob {
  run(feature: Feature): Story[] {
    const stories: Story[] = []
    const base = feature.title || 'capability'
    for (let i = 1; i <= Math.min(5, Math.max(1, (feature.source_sections.length % 5) || 1)); i++) {
      const nn = String(i).padStart(2, '0')
      const title = base
      const story_id = `${feature.feature_id}-story-${nn}-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
      stories.push({
        story_id,
        title,
        role: 'user',
        capability: base,
        benefit: 'value',
        epic_id: feature.epic_id,
        feature_id: feature.feature_id,
        source_sections: feature.source_sections,
      })
    }
    return stories
  }
}
