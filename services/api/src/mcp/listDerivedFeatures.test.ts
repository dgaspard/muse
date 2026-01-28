import { listDerivedFeatures } from '../../../services/mcp/listDerivedFeatures'

describe('listDerivedFeatures MCP tool', () => {
  it('should return features with required fields and deterministic ordering', async () => {
    const features = await listDerivedFeatures('http://localhost:4000/api/mcp')
    expect(Array.isArray(features)).toBe(true)
    for (const feature of features) {
      expect(typeof feature.feature_id).toBe('string')
      expect(typeof feature.epic_id).toBe('string')
      expect(Array.isArray(feature.user_story_ids)).toBe(true)
    }
    // Check deterministic ordering
    const sorted = [...features].sort((a, b) => a.feature_id.localeCompare(b.feature_id))
    expect(features.map(f => f.feature_id)).toEqual(sorted.map(f => f.feature_id))
  })
})
