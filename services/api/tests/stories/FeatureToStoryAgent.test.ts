import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Readable } from 'stream'
import { FeatureToStoryAgent, StoryValidationError } from '../../src/stories/FeatureToStoryAgent'
import type { DocumentStore } from '../../src/storage/documentStore'

describe('FeatureToStoryAgent (MinIO-based)', () => {
  let agent: FeatureToStoryAgent
  let mockDocumentStore: DocumentStore

  beforeEach(() => {
    agent = new FeatureToStoryAgent()
    
    // Create mock DocumentStore
    mockDocumentStore = {
      saveOriginalFromPath: vi.fn(),
      getOriginal: vi.fn(),
      getMetadata: vi.fn(),
    }
  })

  describe('deriveStoriesFromDocuments', () => {
    it('should derive stories from feature and governance documents in MinIO', async () => {
      // Setup feature markdown
      const featureContent = `# Feature: User Authentication

## Description
Enable users to securely log into the system using credentials.

## Acceptance Criteria
- User can enter username and password
- System validates credentials against database
- User receives appropriate feedback on login attempt
`
      const featureFrontMatter = {
        feature_id: 'myproject-epic-01-feature-01',
        epic_id: 'epic-01',
      }

      // Setup governance markdown
      const governanceContent = `# Security Requirements

Users must authenticate before accessing the system.
`
      const governanceFrontMatter = {
        document_id: 'doc-gov-123',
      }

      // Mock DocumentStore to return streams
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-01-feature-01\nepic_id: epic-01\n---\n\n${featureContent}`,
      ])
      const govStream = Readable.from([`---\ndocument_id: doc-gov-123\n---\n\n${governanceContent}`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      // Execute
      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-01',
        mockDocumentStore,
      )

      // Assertions
      expect(stories.length).toBeGreaterThan(0)
      expect(mockDocumentStore.getOriginal).toHaveBeenCalledTimes(2)
      expect(mockDocumentStore.getOriginal).toHaveBeenNthCalledWith(1, 'feature-doc-id')
      expect(mockDocumentStore.getOriginal).toHaveBeenNthCalledWith(2, 'governance-doc-id')

      // Verify story structure
      stories.forEach((story) => {
        expect(story.story_id).toBeTruthy()
        expect(story.story_id).toMatch(/^myproject-myproject-epic-01-feature-01-story-\d{2}-.+$/)
        expect(story.title).toBeTruthy()
        expect(story.title.length).toBeGreaterThanOrEqual(10)
        expect(story.role).toBe('user')
        expect(story.capability).toBeTruthy()
        expect(story.benefit).toBeTruthy()
        expect(story.derived_from_feature).toBe('myproject-epic-01-feature-01')
        expect(story.derived_from_epic).toBe('epic-01')
        expect(Array.isArray(story.governance_references)).toBe(true)
        expect(story.governance_references.length).toBeGreaterThan(0)
        expect(Array.isArray(story.acceptance_criteria)).toBe(true)
        expect(story.acceptance_criteria.length).toBeGreaterThan(0)
        expect(story.generated_at).toBeTruthy()
      })
    })

    it('should generate one story per acceptance criterion', async () => {
      const featureContent = `# Feature: Multi-Factor Authentication

## Description
Implement two-factor authentication for enhanced security.

## Acceptance Criteria
- User can enable 2FA in account settings
- System sends verification code via email
- User must enter verification code within 5 minutes
`
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-02-feature-01\nepic_id: epic-02\n---\n\n${featureContent}`,
      ])
      const govStream = Readable.from([`---\ndocument_id: doc-gov-456\n---\n\n# Security\n\nAuth required.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-02',
        mockDocumentStore,
      )

      // Should have at least 3 stories (one per criterion)
      expect(stories.length).toBeGreaterThanOrEqual(3)
      
      // Each story should have unique title based on criterion
      const titles = stories.map((s) => s.title)
      expect(new Set(titles).size).toBeGreaterThanOrEqual(3)
    })

    it('should use epicId from front matter when not provided', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-03-feature-01\nepic_id: epic-from-frontmatter\n---\n\n# Feature: Test\n\n## Description\nTest feature\n\n## Acceptance Criteria\n- Test criterion\n`,
      ])
      const govStream = Readable.from([`---\ndocument_id: doc-gov-789\n---\n\n# Test\n\nTest gov.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        undefined, // No epicId provided
        mockDocumentStore,
      )

      expect(stories.length).toBeGreaterThan(0)
      expect(stories[0].derived_from_epic).toBe('epic-from-frontmatter')
    })

    it('should throw error when epic_id is missing from both parameters and front matter', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-04-feature-01\n---\n\n# Feature: Test\n\n## Description\nTest\n\n## Acceptance Criteria\n- Test\n`,
      ])
      const govStream = Readable.from([`# Test\n\nTest gov.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      await expect(
        agent.deriveStoriesFromDocuments(
          'feature-doc-id',
          'governance-doc-id',
          'myproject',
          undefined,
          mockDocumentStore,
        ),
      ).rejects.toThrow('Missing epic_id in front matter or parameters')
    })

    it('should limit stories to 5 per feature', async () => {
      // Create feature with 10 acceptance criteria
      const criteria = Array.from({ length: 10 }, (_, i) => `- Acceptance criterion number ${i + 1}`)
      const featureContent = `# Feature: Large Feature

## Description
Feature with many acceptance criteria to test the 5-story limit.

## Acceptance Criteria
${criteria.join('\n')}
`
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-05-feature-01\nepic_id: epic-05\n---\n\n${featureContent}`,
      ])
      const govStream = Readable.from([`# Gov\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-05',
        mockDocumentStore,
      )

      // Should be limited to 5 stories
      expect(stories.length).toBeLessThanOrEqual(5)
    })

    it('should handle features with no explicit acceptance criteria', async () => {
      const featureContent = `# Feature: Minimal Feature

## Description
This feature has a description but no explicit acceptance criteria section.
`
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-06-feature-01\nepic_id: epic-06\n---\n\n${featureContent}`,
      ])
      const govStream = Readable.from([`# Gov\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-06',
        mockDocumentStore,
      )

      // Should still generate at least one story (fallback behavior)
      expect(stories.length).toBeGreaterThan(0)
      expect(stories[0].story_id).toBeTruthy()
    })

    it('should validate story IDs follow the canonical format', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: testproj-epic-99-feature-01\nepic_id: epic-99\n---\n\n# Feature: Test\n\n## Description\nTest\n\n## Acceptance Criteria\n- User can perform action\n`,
      ])
      const govStream = Readable.from([`# Test\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'testproj',
        'epic-99',
        mockDocumentStore,
      )

      stories.forEach((story) => {
        // Story ID format: <project>-<feature_id>-story-<NN>-<short-name>
        expect(story.story_id).toMatch(/^testproj-testproj-epic-99-feature-01-story-\d{2}-.+$/)
      })
    })

    it('should include governance references in each story', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-07-feature-01\nepic_id: epic-07\n---\n\n# Feature: Test\n\n## Description\nTest\n\n## Acceptance Criteria\n- Test criterion\n`,
      ])
      const govStream = Readable.from([`# Governance\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-07',
        mockDocumentStore,
      )

      stories.forEach((story) => {
        expect(Array.isArray(story.governance_references)).toBe(true)
        expect(story.governance_references.length).toBeGreaterThan(0)
        
        story.governance_references.forEach((ref) => {
          expect(ref.document_id).toBeTruthy()
          expect(ref.filename).toBeTruthy()
          expect(ref.markdown_path).toBeTruthy()
          expect(Array.isArray(ref.sections)).toBe(true)
          expect(ref.sections.length).toBeGreaterThan(0)
        })
      })
    })

    it('should handle DocumentStore errors gracefully', async () => {
      mockDocumentStore.getOriginal = vi.fn().mockRejectedValue(new Error('MinIO connection failed'))

      await expect(
        agent.deriveStoriesFromDocuments(
          'feature-doc-id',
          'governance-doc-id',
          'myproject',
          'epic-08',
          mockDocumentStore,
        ),
      ).rejects.toThrow('MinIO connection failed')
    })
  })

  describe('Story validation', () => {
    it('should validate stories meet INVEST criteria', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-09-feature-01\nepic_id: epic-09\n---\n\n# Feature: Valid Feature\n\n## Description\nThis is a well-defined feature with clear acceptance criteria that will generate valid stories.\n\n## Acceptance Criteria\n- User can navigate to the login page\n- System validates user credentials\n- User receives appropriate feedback\n`,
      ])
      const govStream = Readable.from([`# Security\n\nAuthentication required.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-09',
        mockDocumentStore,
      )

      // All generated stories should have passed INVEST validation
      expect(stories.length).toBeGreaterThan(0)
      
      stories.forEach((story) => {
        // Testable: must have acceptance criteria
        expect(story.acceptance_criteria.length).toBeGreaterThan(0)
        
        // Small: title should be concise
        expect(story.title.length).toBeLessThanOrEqual(200)
        
        // Valuable: must have clear benefit
        expect(story.benefit).toBeTruthy()
        expect(story.benefit.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Story ID generation', () => {
    it('should generate sequential story numbers', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-10-feature-01\nepic_id: epic-10\n---\n\n# Feature: Test\n\n## Description\nTest feature for ID generation.\n\n## Acceptance Criteria\n- First criterion\n- Second criterion\n- Third criterion\n`,
      ])
      const govStream = Readable.from([`# Test\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-10',
        mockDocumentStore,
      )

      expect(stories.length).toBeGreaterThanOrEqual(3)
      
      // Check that story numbers are sequential and zero-padded
      expect(stories[0].story_id).toContain('-story-01-')
      expect(stories[1].story_id).toContain('-story-02-')
      expect(stories[2].story_id).toContain('-story-03-')
    })

    it('should convert story titles to kebab-case for IDs', async () => {
      const featureStream = Readable.from([
        `---\nfeature_id: myproject-epic-11-feature-01\nepic_id: epic-11\n---\n\n# Feature: Test\n\n## Description\nTest\n\n## Acceptance Criteria\n- User Can Navigate to Login Page With Special Characters!\n`,
      ])
      const govStream = Readable.from([`# Test\n\nTest.`])

      mockDocumentStore.getOriginal = vi
        .fn()
        .mockResolvedValueOnce({ stream: featureStream, metadata: {} })
        .mockResolvedValueOnce({ stream: govStream, metadata: {} })

      const stories = await agent.deriveStoriesFromDocuments(
        'feature-doc-id',
        'governance-doc-id',
        'myproject',
        'epic-11',
        mockDocumentStore,
      )

      expect(stories[0].story_id).toMatch(/^myproject-myproject-epic-11-feature-01-story-01-[a-z0-9-]+$/)
      expect(stories[0].story_id).not.toMatch(/[A-Z]/) // No uppercase
      expect(stories[0].story_id).not.toMatch(/[!@#$%^&*()]/) // No special chars
    })
  })
})
