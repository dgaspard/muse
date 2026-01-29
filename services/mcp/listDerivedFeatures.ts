// Minimal MCP adapter for list_derived_features
// This module calls the MUSE API contract and exposes the result for MCP orchestration

import fetch from 'node-fetch'

export interface FeatureSummary {
  feature_id: string
  epic_id: string
  user_story_ids: string[]
}

export async function listDerivedFeatures(apiBaseUrl: string = 'http://localhost:4000/api/mcp'):
  Promise<FeatureSummary[]> {
  const res = await fetch(`${apiBaseUrl}/list_derived_features`)
  if (!res.ok) {
    throw new Error(`Failed to fetch derived features: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return data.features as FeatureSummary[]
}

// Example CLI usage
if (require.main === module) {
  listDerivedFeatures()
    .then(features => {
      for (const feature of features) {
        console.log(`${feature.feature_id}\t${feature.epic_id}\t${feature.user_story_ids.join(',')}`)
      }
    })
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
}
