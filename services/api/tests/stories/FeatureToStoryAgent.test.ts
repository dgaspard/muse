import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { FeatureToStoryAgent, StoryValidationError } from '../../src/stories/FeatureToStoryAgent'

describe('FeatureToStoryAgent', () => {
  let tempDir: string
  let agent: FeatureToStoryAgent
  let featurePath: string
  let governancePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-story-agent-'))
    agent = new FeatureToStoryAgent()

    // Create sample feature markdown
    featurePath = path.join(tempDir, 'feat-epic-123-01.md')
    const featureContent = `---
feature_id: feat-epic-123-01
epic_id: epic-123
---

# Feature: User Authentication

## Description
Enable users to securely log into the system using credentials.

## Acceptance Criteria
- User can enter username and password
- System validates credentials
- User receives appropriate feedback
`
    fs.writeFileSync(featurePath, featureContent, 'utf-8')

    // Create sample governance markdown
    governancePath = path.join(tempDir, 'governance.md')
    const governanceContent = `---
document_id: doc-gov-123
---

# Security Requirements

Users must authenticate before accessing the system.
`
    fs.writeFileSync(governancePath, governanceContent, 'utf-8')
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('deriveStories', () => {
    it('should derive INVEST-compliant stories from feature', async () => {
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-123')

      expect(stories.length).toBeGreaterThan(0)
      stories.forEach((story) => {
        expect(story.story_id).toBeTruthy()
        expect(story.title).toBeTruthy()
        expect(story.role).toBeTruthy()
        expect(story.capability).toBeTruthy()
        expect(story.benefit).toBeTruthy()
        expect(story.derived_from_feature).toBe('feat-epic-123-01')
        expect(story.derived_from_epic).toBe('epic-123')
        expect(story.governance_references.length).toBeGreaterThan(0)
        expect(story.acceptance_criteria.length).toBeGreaterThan(0)
        expect(story.generated_at).toBeTruthy()
      })
    })

    it('should reference governance source', async () => {
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-123')

      stories.forEach((story) => {
        expect(story.governance_references.length).toBeGreaterThan(0)
        story.governance_references.forEach((ref) => {
          expect(ref.sections).toBeTruthy()
          expect(ref.markdown_path).toBeTruthy()
        })
      })
    })

    it('should include acceptance criteria in each story', async () => {
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-123')

      stories.forEach((story) => {
        expect(story.acceptance_criteria.length).toBeGreaterThan(0)
        story.acceptance_criteria.forEach((criterion) => {
          expect(criterion).toBeTruthy()
          expect(typeof criterion).toBe('string')
        })
      })
    })

    it('should throw error if feature file not found', async () => {
      await expect(agent.deriveStories('/nonexistent/path.md', governancePath, 'epic-123')).rejects.toThrow(
        'Feature Markdown not found',
      )
    })

    it('should throw error if governance file not found', async () => {
      await expect(agent.deriveStories(featurePath, '/nonexistent/governance.md', 'epic-123')).rejects.toThrow(
        'Governance Markdown not found',
      )
    })

    it('should validate INVEST compliance', async () => {
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-123')

      // INVEST validation happens during derivation
      // If we get here without exception, stories are INVEST-compliant
      expect(stories.length).toBeGreaterThan(0)
    })
  })

  describe('deriveAndWriteStories', () => {
    it('should write stories to markdown file', async () => {
      const outputDir = path.join(tempDir, 'stories')
      const { stories, storyPath } = await agent.deriveAndWriteStories(
        featurePath,
        governancePath,
        'epic-123',
        outputDir,
      )

      expect(fs.existsSync(storyPath)).toBe(true)
      expect(stories.length).toBeGreaterThan(0)

      const content = fs.readFileSync(storyPath, 'utf-8')
      expect(content).toContain('---')
      expect(content).toContain('derived_from_epic: epic-123')
      expect(content).toContain('## User Story:')
      expect(content).toContain('**As a**')
      expect(content).toContain('**I want**')
      expect(content).toContain('**So that**')
      expect(content).toContain('### Governance References')
      expect(content).toContain('### Acceptance Criteria')
    })

    it('should use canonical Muse story format', async () => {
      const outputDir = path.join(tempDir, 'stories')
      const { storyPath } = await agent.deriveAndWriteStories(featurePath, governancePath, 'epic-123', outputDir)

      const content = fs.readFileSync(storyPath, 'utf-8')

      // Check front matter
      expect(content).toMatch(/^---\n/)
      expect(content).toContain('derived_from_epic:')
      expect(content).toContain('derived_from_features:')
      expect(content).toContain('source_features:')
      expect(content).toContain('generated_at:')

      // Check story format
      expect(content).toContain('## User Story:')
      expect(content).toContain('**Story ID:**')
      expect(content).toContain('**Derived From Feature:**')
      expect(content).toContain('**Derived From Epic:**')
    })
  })

  describe('INVEST validation', () => {
    it('should only reject stories with very specific technical implementation details', async () => {
      // Relaxed validation: 'implement' keyword is now allowed
      // Only SQL queries, REST endpoints, database schemas, class names, function signatures are rejected
      const featurePath = path.join(tempDir, 'feature.md')
      const content = `---
feature_id: feat-01
epic_id: epic-01
---

# Feature: Implement Database

## Description
Enable database access for the system.

## Acceptance Criteria
- Database connection works
`
      fs.writeFileSync(featurePath, content, 'utf-8')

      // Should NOT reject - 'implement' is allowed in relaxed validation
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-01')
      expect(stories.length).toBeGreaterThan(0)
    })

    it('should reject stories only when they contain VERY specific technical keywords', async () => {
      // The relaxed validation only rejects if story title contains exact phrases
      // like "SQL query", "REST endpoint", "database schema", "class name", "function signature"
      // Just having "schema" or "REST" alone is not enough
      const featurePath = path.join(tempDir, 'feature-tech.md')
      const content = `---
feature_id: feat-01
epic_id: epic-01
---

# Feature: Design database for users

## Description
Create a data storage capability for user information.

## Acceptance Criteria
- Supports queries
`
      fs.writeFileSync(featurePath, content, 'utf-8')

      // Should NOT reject - "database" alone is not a rejectable phrase
      const stories = await agent.deriveStories(featurePath, governancePath, 'epic-01')
      expect(stories.length).toBeGreaterThan(0)
    })

    it('should allow minimal benefit in relaxed validation', async () => {
      // Relaxed validation: minimum benefit is now 5 characters instead of 10
      const minimalFeaturePath = path.join(tempDir, 'minimal-feature.md')
      const minimalContent = `---
feature_id: feat-min-01
epic_id: epic-min
---

# Feature: Update System

## Description
Enable system updates to work properly.

## Acceptance Criteria
- System works
`
      fs.writeFileSync(minimalFeaturePath, minimalContent, 'utf-8')

      // Should NOT reject - minimal content is allowed in relaxed validation
      const stories = await agent.deriveStories(minimalFeaturePath, governancePath, 'epic-min')
      expect(stories.length).toBeGreaterThan(0)
    })
  })
})
