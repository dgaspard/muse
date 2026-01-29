// Minimal MCP adapter for list_derived_user_stories
// This module calls the MUSE API contract and exposes the result for MCP orchestration

import fetch from 'node-fetch'

export interface UserStorySummary {
  story_id: string
  feature_id: string
  epic_id: string
  governance_reference: string
}

export async function listDerivedUserStories(apiBaseUrl: string = 'http://localhost:4000/api/mcp'):
  Promise<UserStorySummary[]> {
  const res = await fetch(`${apiBaseUrl}/list_derived_user_stories`)
  if (!res.ok) {
    throw new Error(`Failed to fetch derived user stories: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return data.stories as UserStorySummary[]
}

// Example CLI usage
if (require.main === module) {
  listDerivedUserStories()
    .then(stories => {
      for (const story of stories) {
        console.log(`${story.story_id}\t${story.feature_id}\t${story.epic_id}\t${story.governance_reference}`)
      }
    })
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
}
