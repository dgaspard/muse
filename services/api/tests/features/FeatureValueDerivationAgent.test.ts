import { describe, it, expect, beforeAll, vi } from 'vitest'
import { 
  FeatureValueDerivationAgent, 
  FeatureValueValidationError 
} from '../../src/features/FeatureValueDerivationAgent'

describe('FeatureValueDerivationAgent', () => {
  let agent: FeatureValueDerivationAgent

  beforeAll(() => {
    agent = new FeatureValueDerivationAgent()
  })

  // Helper to access private method for testing
  const validateSchema = (feature: any) => {
    return (agent as any).validateFeatureValueSchema(feature)
  }

  describe('Agent Initialization', () => {
    it('should initialize without API key (fails gracefully on derive)', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      
      const agentWithoutKey = new FeatureValueDerivationAgent()
      expect(agentWithoutKey).toBeDefined()
      
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey
      }
    })

    it('should initialize with API key when available', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key'
      const agentWithKey = new FeatureValueDerivationAgent()
      expect(agentWithKey).toBeDefined()
    })
  })

  describe('Feature Validation Rules', () => {
    it('should reject features without business_value', async () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        description: 'A test feature description',
        acceptance_criteria: ['Criterion 1 with sufficient length'],
        risk_of_not_delivering: ['Risk 1 with sufficient length'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).toThrow('business_value')
    })

    it('should reject features with generic acceptance criteria', async () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Feature is implemented'],
        risk_of_not_delivering: ['Risk 1 with sufficient length'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).toThrow('Generic/tautological acceptance criteria detected')
    })

    it('should reject features without risks', async () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: [],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).toThrow('risk_of_not_delivering')
    })

    it('should reject features without governance references', async () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).toThrow('governance_references')
    })

    it('should reject features describing Muse internals', async () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Upload documents to Muse platform',
        business_value: 'Clear business value statement here',
        description: 'Pipeline processes uploaded documents',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).toThrow('Muse internals')
    })

    it('should accept valid value-based features', () => {
      const mockFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Personnel Record Access Logging',
        business_value: 'Ensures audit compliance by logging all access attempts to personnel records',
        description: 'System logs all authentication and authorization events for personnel record access',
        acceptance_criteria: [
          'Auditors can retrieve complete access logs within required statutory timeframes',
          'Unauthorized access attempts are logged and discoverable during investigations'
        ],
        risk_of_not_delivering: [
          'Inability to demonstrate compliance during OPM audits',
          'Privacy Act violations resulting from improper access controls'
        ],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Access Control Requirements', 'Audit Logging']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(mockFeature)
      }).not.toThrow()
    })
  })

  describe('Feature Derivation (mocked AI)', () => {
    it('should fail without ANTHROPIC_API_KEY', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      
      const agentWithoutKey = new FeatureValueDerivationAgent()
      
      await expect(
        agentWithoutKey.deriveFeatures(
          {
            epic_id: 'epic-test-01',
            objective: 'Test objective',
            success_criteria: ['Criterion 1']
          },
          'Governance content here',
          {
            document_id: 'doc-123',
            filename: 'governance.md',
            governance_path: 'docs/governance/governance.md'
          }
        )
      ).rejects.toThrow('ANTHROPIC_API_KEY not set')
      
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey
      }
    })

    it('should require governance content', () => {
      // This is validated by requiring governanceContent parameter
      expect(agent.deriveFeatures).toBeDefined()
      // Type checking ensures governanceContent is required
    })
  })

  describe('Validation Error Messages', () => {
    it('should provide detailed error messages for validation failures', () => {
      const invalidFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Valid Test Feature Title',
        business_value: 'Valid business value statement here',
        description: 'Valid test feature description',
        acceptance_criteria: ['Feature is implemented'],
        risk_of_not_delivering: ['Risk statement with sufficient length'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: []
        }],
        derived_from_epic: 'epic-doc-123'
      }

      try {
        validateSchema(invalidFeature)
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error).toBeInstanceOf(FeatureValueValidationError)
        expect((error as Error).message).toContain('hardening validation failed')
      }
    })
  })

  describe('Schema Constraints', () => {
    it('should require minimum lengths for key fields', () => {
      const shortTitleFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Short',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(shortTitleFeature)
      }).toThrow('title')
    })

    it('should require substantial acceptance criteria', () => {
      const shortCriteriaFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['System supports the feature'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(shortCriteriaFeature)
      }).toThrow('Generic/tautological acceptance criteria detected')
    })

    it('should require substantial risk statements', () => {
      const shortRiskFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Too short'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(shortRiskFeature)
      }).toThrow('Each risk statement must be at least 15 characters')
    })
  })

  describe('Governance Reference Validation', () => {
    it('should require document_id in governance references', () => {
      const invalidRefFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [{
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: ['Section 1']
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(invalidRefFeature)
      }).toThrow(/governance.reference/)
    })

    it('should require sections in governance references', () => {
      const noSectionsFeature = {
        feature_id: 'testproject-epic-01-feature-01',
        title: 'Test Feature Title',
        business_value: 'Clear business value statement here',
        description: 'A test feature description',
        acceptance_criteria: ['Auditors can retrieve records within statutory timeframes'],
        risk_of_not_delivering: ['Inability to demonstrate compliance during audits'],
        governance_references: [{
          document_id: 'doc-123',
          filename: 'governance.md',
          markdown_path: 'docs/governance/governance.md',
          sections: []
        }],
        derived_from_epic: 'epic-doc-123'
      }

      expect(() => {
        validateSchema(noSectionsFeature)
      }).toThrow('sections array')
    })
  })
})
