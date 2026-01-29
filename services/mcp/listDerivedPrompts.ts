// Minimal MCP adapter for list_derived_prompts
// This module calls the MUSE API contract and exposes the result for MCP orchestration

import fetch from 'node-fetch'

export interface PromptSummary {
  prompt_id: string
  story_id: string
  content: string
}

export async function listDerivedPrompts(apiBaseUrl: string = 'http://localhost:4000/api/mcp'):
  Promise<PromptSummary[]> {
  const res = await fetch(`${apiBaseUrl}/list_derived_prompts`)
  if (!res.ok) {
    throw new Error(`Failed to fetch derived prompts: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return data.prompts as PromptSummary[]
}

// Example CLI usage
if (require.main === module) {
  listDerivedPrompts()
    .then(prompts => {
      for (const prompt of prompts) {
        console.log(`${prompt.prompt_id}\t${prompt.story_id}\t${prompt.content.substring(0, 40)}...`)
      }
    })
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
}
