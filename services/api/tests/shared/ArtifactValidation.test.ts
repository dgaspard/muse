import { describe, it, expect } from 'vitest'
import {
  validateEpicFeatureCount,
  validateFeatureHierarchy,
  validateSubFeatureIdFormat,
  detectOrphanedArtifacts,
  validateArtifactHierarchy,
  ValidationReport
} from '../../src/shared/ArtifactValidation'

describe('Enhanced Hierarchy Validation', () => {
  describe('validateEpicFeatureCount', () => {
    it('should pass for Epic with 1-5 Features', () => {
      const features = [
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' }
      ]
      
      const result = validateEpicFeatureCount('epic-doc-01', features)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn for Epic with only 1 Feature', () => {
      const features = [
        { derived_from_epic: 'epic-doc-01' }
      ]
      
      const result = validateEpicFeatureCount('epic-doc-01', features)
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('only 1 Feature')
    })

    it('should fail for Epic with no Features', () => {
      const features: Array<{ derived_from_epic: string }> = []
      
      const result = validateEpicFeatureCount('epic-doc-01', features)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('has no Features')
      expect(result.errors[0]).toContain('1-5 Features')
    })

    it('should fail for Epic with more than 5 Features', () => {
      const features = [
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' }
      ]
      
      const result = validateEpicFeatureCount('epic-doc-01', features)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('6 Features')
      expect(result.errors[0]).toContain('exceeding maximum of 5')
    })

    it('should only count Features for the specified Epic', () => {
      const features = [
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-01' },
        { derived_from_epic: 'epic-doc-02' },
        { derived_from_epic: 'epic-doc-02' }
      ]
      
      const result = validateEpicFeatureCount('epic-doc-01', features)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateFeatureHierarchy', () => {
    it('should pass for Feature with Stories (no Sub-Features)', () => {
      const allFeatures = [
        { feature_id: 'proj-epic-01-feature-01', parent_feature_id: undefined }
      ]
      const stories = [
        { derived_from_feature: 'proj-epic-01-feature-01' },
        { derived_from_feature: 'proj-epic-01-feature-01' }
      ]
      
      const result = validateFeatureHierarchy('proj-epic-01-feature-01', allFeatures, stories)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should pass for Feature with Sub-Features (no direct Stories)', () => {
      const allFeatures = [
        { feature_id: 'proj-epic-01-feature-01', parent_feature_id: undefined },
        { feature_id: 'proj-epic-01-feature-01-subfeature-01', parent_feature_id: 'proj-epic-01-feature-01' },
        { feature_id: 'proj-epic-01-feature-01-subfeature-02', parent_feature_id: 'proj-epic-01-feature-01' }
      ]
      const stories = [
        { derived_from_feature: 'proj-epic-01-feature-01-subfeature-01' }
      ]
      
      const result = validateFeatureHierarchy('proj-epic-01-feature-01', allFeatures, stories)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for Feature with neither Sub-Features nor Stories', () => {
      const allFeatures = [
        { feature_id: 'proj-epic-01-feature-01', parent_feature_id: undefined }
      ]
      const stories: Array<{ derived_from_feature: string }> = []
      
      const result = validateFeatureHierarchy('proj-epic-01-feature-01', allFeatures, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('neither Sub-Features nor Stories')
    })

    it('should fail for Feature with both Sub-Features and direct Stories', () => {
      const allFeatures = [
        { feature_id: 'proj-epic-01-feature-01', parent_feature_id: undefined },
        { feature_id: 'proj-epic-01-feature-01-subfeature-01', parent_feature_id: 'proj-epic-01-feature-01' }
      ]
      const stories = [
        { derived_from_feature: 'proj-epic-01-feature-01' }, // Direct story
        { derived_from_feature: 'proj-epic-01-feature-01-subfeature-01' } // Sub-Feature story
      ]
      
      const result = validateFeatureHierarchy('proj-epic-01-feature-01', allFeatures, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('both Sub-Features and direct Stories')
    })
  })

  describe('validateSubFeatureIdFormat', () => {
    it('should validate correct Sub-Feature ID format', () => {
      expect(
        validateSubFeatureIdFormat(
          'proj-epic-01-feature-01-subfeature-01',
          'proj-epic-01-feature-01'
        )
      ).toBe(true)
    })

    it('should validate multi-digit Sub-Feature numbers', () => {
      expect(
        validateSubFeatureIdFormat(
          'proj-epic-01-feature-01-subfeature-99',
          'proj-epic-01-feature-01'
        )
      ).toBe(true)
    })

    it('should reject Sub-Feature ID without proper parent prefix', () => {
      expect(
        validateSubFeatureIdFormat(
          'proj-epic-01-feature-02-subfeature-01',
          'proj-epic-01-feature-01'
        )
      ).toBe(false)
    })

    it('should reject Sub-Feature ID with single-digit number', () => {
      expect(
        validateSubFeatureIdFormat(
          'proj-epic-01-feature-01-subfeature-1',
          'proj-epic-01-feature-01'
        )
      ).toBe(false)
    })

    it('should reject Sub-Feature ID missing -subfeature- component', () => {
      expect(
        validateSubFeatureIdFormat(
          'proj-epic-01-feature-01-01',
          'proj-epic-01-feature-01'
        )
      ).toBe(false)
    })
  })

  describe('detectOrphanedArtifacts', () => {
    it('should pass when all artifacts have valid parents', () => {
      const epics = [{ epic_id: 'epic-doc-01' }]
      const features = [
        { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined }
      ]
      const stories = [
        { story_id: 'proj-epic-01-feature-01-story-01-test', derived_from_feature: 'proj-epic-01-feature-01' }
      ]
      
      const result = detectOrphanedArtifacts(epics, features, stories)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect orphaned Feature (missing Epic)', () => {
      const epics = [{ epic_id: 'epic-doc-01' }]
      const features = [
        { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
        { feature_id: 'proj-epic-99-feature-01', derived_from_epic: 'epic-doc-99', parent_feature_id: undefined }
      ]
      const stories: Array<{ story_id: string; derived_from_feature: string }> = []
      
      const result = detectOrphanedArtifacts(epics, features, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('orphaned Feature')
      expect(result.errors[0]).toContain('proj-epic-99-feature-01')
    })

    it('should detect orphaned Sub-Feature (missing parent Feature)', () => {
      const epics = [{ epic_id: 'epic-doc-01' }]
      const features = [
        { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
        { 
          feature_id: 'proj-epic-01-feature-99-subfeature-01', 
          derived_from_epic: 'epic-doc-01',
          parent_feature_id: 'proj-epic-01-feature-99'
        }
      ]
      const stories: Array<{ story_id: string; derived_from_feature: string }> = []
      
      const result = detectOrphanedArtifacts(epics, features, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('orphaned Sub-Feature')
      expect(result.errors[0]).toContain('proj-epic-01-feature-99-subfeature-01')
    })

    it('should detect orphaned Story (missing Feature)', () => {
      const epics = [{ epic_id: 'epic-doc-01' }]
      const features = [
        { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined }
      ]
      const stories = [
        { story_id: 'proj-epic-01-feature-01-story-01-test', derived_from_feature: 'proj-epic-01-feature-01' },
        { story_id: 'proj-epic-01-feature-99-story-01-test', derived_from_feature: 'proj-epic-01-feature-99' }
      ]
      
      const result = detectOrphanedArtifacts(epics, features, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('orphaned Story')
      expect(result.errors[0]).toContain('proj-epic-01-feature-99-story-01-test')
    })

    it('should detect multiple types of orphaned artifacts', () => {
      const epics = [{ epic_id: 'epic-doc-01' }]
      const features = [
        { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
        { feature_id: 'proj-epic-99-feature-01', derived_from_epic: 'epic-doc-99', parent_feature_id: undefined }
      ]
      const stories = [
        { story_id: 'proj-epic-01-feature-99-story-01-test', derived_from_feature: 'proj-epic-01-feature-99' }
      ]
      
      const result = detectOrphanedArtifacts(epics, features, stories)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('validateArtifactHierarchy', () => {
    it('should pass for valid complete hierarchy', () => {
      const hierarchy = {
        epics: [{ epic_id: 'epic-doc-01', document_id: 'doc-01' }],
        features: [
          { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-02', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined }
        ],
        stories: [
          { story_id: 'proj-epic-01-feature-01-story-01-test', derived_from_feature: 'proj-epic-01-feature-01' },
          { story_id: 'proj-epic-01-feature-02-story-01-test', derived_from_feature: 'proj-epic-01-feature-02' }
        ]
      }
      
      const result = validateArtifactHierarchy(hierarchy)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate hierarchy with Sub-Features', () => {
      const hierarchy = {
        epics: [{ epic_id: 'epic-doc-01', document_id: 'doc-01' }],
        features: [
          { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-01-subfeature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: 'proj-epic-01-feature-01' },
          { feature_id: 'proj-epic-01-feature-01-subfeature-02', derived_from_epic: 'epic-doc-01', parent_feature_id: 'proj-epic-01-feature-01' }
        ],
        stories: [
          { story_id: 'proj-epic-01-feature-01-subfeature-01-story-01-test', derived_from_feature: 'proj-epic-01-feature-01-subfeature-01' },
          { story_id: 'proj-epic-01-feature-01-subfeature-02-story-01-test', derived_from_feature: 'proj-epic-01-feature-01-subfeature-02' }
        ]
      }
      
      const result = validateArtifactHierarchy(hierarchy)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail for Epic with too many Features', () => {
      const hierarchy = {
        epics: [{ epic_id: 'epic-doc-01', document_id: 'doc-01' }],
        features: [
          { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-02', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-03', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-04', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-05', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-06', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined }
        ],
        stories: [
          { story_id: 'proj-epic-01-feature-01-story-01-test', derived_from_feature: 'proj-epic-01-feature-01' }
        ]
      }
      
      const result = validateArtifactHierarchy(hierarchy)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('6 Features'))).toBe(true)
    })

    it('should fail for Sub-Feature without Stories', () => {
      const hierarchy = {
        epics: [{ epic_id: 'epic-doc-01', document_id: 'doc-01' }],
        features: [
          { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-01-feature-01-subfeature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: 'proj-epic-01-feature-01' }
        ],
        stories: [] // No stories for Sub-Feature
      }
      
      const result = validateArtifactHierarchy(hierarchy)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Sub-Feature') && e.includes('has no Stories'))).toBe(true)
    })

    it('should accumulate multiple validation errors', () => {
      const hierarchy = {
        epics: [{ epic_id: 'epic-doc-01', document_id: 'doc-01' }],
        features: [
          { feature_id: 'proj-epic-01-feature-01', derived_from_epic: 'epic-doc-01', parent_feature_id: undefined },
          { feature_id: 'proj-epic-99-feature-01', derived_from_epic: 'epic-doc-99', parent_feature_id: undefined } // Orphaned
        ],
        stories: [
          { story_id: 'proj-epic-01-feature-99-story-01-test', derived_from_feature: 'proj-epic-01-feature-99' } // Orphaned
        ]
      }
      
      const result = validateArtifactHierarchy(hierarchy)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })
})
