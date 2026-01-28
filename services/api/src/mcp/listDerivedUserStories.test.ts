import { listDerivedUserStories } from '../../../services/mcp/listDerivedUserStories'

describe('listDerivedUserStories MCP tool', () => {
  it('should return user stories with required fields and deterministic ordering', async () => {
    const stories = await listDerivedUserStories('http://localhost:4000/api/mcp')
    expect(Array.isArray(stories)).toBe(true)
    for (const story of stories) {
      expect(typeof story.story_id).toBe('string')
      expect(typeof story.feature_id).toBe('string')
      expect(typeof story.epic_id).toBe('string')
      expect(typeof story.governance_reference).toBe('string')
    }
    // Check deterministic ordering
    const sorted = [...stories].sort((a, b) => a.story_id.localeCompare(b.story_id))
    expect(stories.map(s => s.story_id)).toEqual(sorted.map(s => s.story_id))
  })
})
