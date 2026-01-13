import { describe, it, expect } from 'vitest'
import { FeatureGenerationAgent, type GeneratedFeature } from '../../src/semantic/FeatureGenerationAgent'
import type { Epic } from '../../src/semantic/EpicDerivationAgent'
import type { SectionSummary } from '../../src/semantic/SectionSummaryJob'

describe('FeatureGenerationAgent', () => {
  it('generates features from an epic and governance summaries (rule-based fallback)', async () => {
    const agent = new FeatureGenerationAgent()

    const epic: Epic = {
      epic_id: 'epic-test-01',
      title: 'Document Management System',
      objective: 'Enable secure document upload, processing, and retrieval with audit compliance',
      success_criteria: [
        'Documents uploaded successfully',
        'Documents processed into metadata and content',
        'Audit trail maintained',
      ],
      source_sections: ['sec-001', 'sec-002', 'sec-003'],
    }

    const summaries: SectionSummary[] = [
      {
        section_id: 'sec-001',
        title: 'File Upload Requirements',
        obligations: [
          'System shall validate file types before storage',
          'System must reject files exceeding size limits',
        ],
        outcomes: [
          'Users can securely upload documents',
          'Invalid files are rejected with clear feedback',
        ],
        actors: ['Document Uploader', 'System Administrator'],
        constraints: [
          'Maximum file size 100MB',
          'Supported formats: PDF, DOCX, TXT',
        ],
        references: [],
        cached: false,
      },
      {
        section_id: 'sec-002',
        title: 'Content Processing Requirements',
        obligations: [
          'System must extract metadata from documents',
          'System shall convert documents to standard formats',
        ],
        outcomes: [
          'Documents are processed into searchable content',
          'Metadata is available for discovery',
        ],
        actors: ['System Administrator', 'Document Processor'],
        constraints: [
          'Processing must complete within 5 minutes',
          'Metadata extraction accuracy must exceed 95%',
        ],
        references: [],
        cached: false,
      },
      {
        section_id: 'sec-003',
        title: 'Audit and Compliance Requirements',
        obligations: [
          'System shall maintain immutable audit logs',
          'System must record all document access events',
        ],
        outcomes: [
          'Complete audit trail is available for compliance verification',
          'Access patterns can be analyzed for security',
        ],
        actors: ['Compliance Officer', 'Security Auditor'],
        constraints: [
          'Audit logs must be retained for 7 years',
          'Tamper-evident storage required',
        ],
        references: [],
        cached: false,
      },
    ]

    const features: GeneratedFeature[] = await agent.run(epic, summaries)

    // Validation: Rule-based fallback should produce 3-5 features
    expect(features.length).toBeGreaterThanOrEqual(1)
    expect(features.length).toBeLessThanOrEqual(7)

    // Each feature must have required fields
    for (const feature of features) {
      expect(feature.feature_id).toBeDefined()
      expect(feature.epic_id).toBe('epic-test-01')
      expect(feature.title).toBeDefined()
      expect(feature.title.length).toBeGreaterThan(0)
      expect(feature.description).toBeDefined()
      expect(Array.isArray(feature.acceptance_criteria)).toBe(true)
      expect(Array.isArray(feature.governance_references)).toBe(true)
      expect(feature.governance_references.length).toBeGreaterThan(0)
    }

    // Feature IDs should follow pattern
    for (const feature of features) {
      expect(feature.feature_id).toMatch(/^epic-test-01-feature-\d{2}$/)
    }

    // At least one feature should reference each section
    const allRefs = features.flatMap((f) => f.governance_references)
    expect(allRefs).toContain('sec-001')
    expect(allRefs).toContain('sec-002')
    expect(allRefs).toContain('sec-003')

    console.log('[FeatureGenerationAgent Test] Generated features:')
    features.forEach((f) => {
      console.log(`  ${f.feature_id}: ${f.title}`)
      console.log(`    Description: ${f.description.substring(0, 60)}...`)
      console.log(`    Acceptance Criteria: ${f.acceptance_criteria.length} items`)
      console.log(`    Governance References: ${f.governance_references.join(', ')}`)
    })
  })

  it('respects the 7-feature maximum constraint', async () => {
    const agent = new FeatureGenerationAgent()

    const epic: Epic = {
      epic_id: 'epic-large',
      title: 'Large Epic',
      objective: 'Implement complex system',
      success_criteria: ['Complete'],
      source_sections: Array.from({ length: 20 }, (_, i) => `sec-${i}`),
    }

    // Create 20 summaries to test the constraint
    const summaries: SectionSummary[] = Array.from({ length: 20 }, (_, i) => ({
      section_id: `sec-${i}`,
      title: `Section ${i}`,
      obligations: [`Must support requirement ${i}`],
      outcomes: [`Enable capability ${i}`],
      actors: ['Actor'],
      constraints: [`Constraint ${i}`],
      references: [],
      cached: false,
    }))

    const features = await agent.run(epic, summaries)

    // Should never exceed 7 features
    expect(features.length).toBeLessThanOrEqual(7)
    console.log(`[FeatureGenerationAgent Test] Large epic with 20 sections produced ${features.length} features (max 7)`)
  })
})
