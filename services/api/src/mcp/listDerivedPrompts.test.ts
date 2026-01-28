import { listDerivedPrompts } from '../../../services/mcp/listDerivedPrompts'

describe('listDerivedPrompts MCP tool', () => {
  it('should return prompts with required fields and deterministic ordering', async () => {
    const prompts = await listDerivedPrompts('http://localhost:4000/api/mcp')
    expect(Array.isArray(prompts)).toBe(true)
    for (const prompt of prompts) {
      expect(typeof prompt.prompt_id).toBe('string')
      expect(typeof prompt.story_id).toBe('string')
      expect(typeof prompt.content).toBe('string')
    }
    // Check deterministic ordering
    const sorted = [...prompts].sort((a, b) => a.prompt_id.localeCompare(b.prompt_id))
    expect(prompts.map(p => p.prompt_id)).toEqual(sorted.map(p => p.prompt_id))
  })
})
