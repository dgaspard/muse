// Minimal MCP adapter for list_derived_epics
// This module calls the MUSE API contract and exposes the result for MCP orchestration

import fetch from 'node-fetch'

export interface EpicSummary {
  epic_id: string
  title: string
  governance_reference: string
  generated_at: string
}

export async function listDerivedEpics(apiBaseUrl: string = 'http://localhost:4000/api/mcp'):
  Promise<EpicSummary[]> {
  const res = await fetch(`${apiBaseUrl}/list_derived_epics`)
  if (!res.ok) {
    throw new Error(`Failed to fetch derived epics: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return data.epics as EpicSummary[]
}

// Example CLI usage
if (require.main === module) {
  listDerivedEpics()
    .then(epics => {
      for (const epic of epics) {
        console.log(`${epic.epic_id}\t${epic.title}\t${epic.governance_reference}`)
      }
    })
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
}
