import Anthropic from '@anthropic-ai/sdk'
import YAML from 'yaml'
import {
  GovernanceReference,
  validateFeatureHardening,
} from '../shared/ArtifactValidation'

/**
 * Schema for value-based Feature output
 */
export interface FeatureValueSchema {
  feature_id: string
  title: string
  business_value: string
  description: string
  acceptance_criteria: string[]
  risk_of_not_delivering: string[]
  governance_references: GovernanceReference[]
  derived_from_epic: string
}

/**
 * Agent output with metadata
 */
export interface FeatureValueOutput extends FeatureValueSchema {
  generated_at: string
}

/**
 * Error thrown when agent output fails validation
 */
export class FeatureValueValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeatureValueValidationError'
  }
}

/**
 * FeatureValueDerivationAgent — Derives PRODUCT FEATURES with CLEAR BUSINESS VALUE
 * 
 * This is NOT a summarization task.
 * This is NOT a restatement task.
 * This is a VALUE DEFINITION task.
 * 
 * Responsibilities:
 * - Derive features that deliver distinct business value
 * - Write features in terms of OUTCOMES, not implementation
 * - Provide outcome-based acceptance criteria
 * - Define risks of not delivering
 * - Reference governance documents explicitly
 * 
 * Constraints:
 * - NO generic acceptance criteria ("Feature is implemented")
 * - NO verbatim copying from governance documents
 * - NO descriptions of Muse, pipelines, uploads, or metadata
 * - MUST FAIL if meaningful business value cannot be identified
 */
export class FeatureValueDerivationAgent {
  private anthropic: Anthropic | null = null

  constructor() {
    // Initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    }
  }

  /**
   * Validate Feature output against strict hardening requirements
   * 
   * Enforces:
   * - Feature ID format: <project>-<epic_id>-feature-<NN>
   * - Business value is distinct and meaningful
   * - Acceptance criteria are outcome-based (not generic)
   * - Risk statements are present
   * - Governance references with markdown paths
   * - No prohibited Muse-internal descriptions
   */
  private validateFeatureValueSchema(feature: unknown, epicText?: string): asserts feature is FeatureValueSchema {
    if (typeof feature !== 'object' || feature === null) {
      throw new FeatureValueValidationError('Feature must be an object')
    }

    const f = feature as Record<string, unknown>

    // Basic structure validation
    if (!f.feature_id || typeof f.feature_id !== 'string') {
      throw new FeatureValueValidationError('Missing or invalid feature_id')
    }

    if (!f.title || typeof f.title !== 'string' || (f.title as string).length < 10) {
      throw new FeatureValueValidationError('Missing or invalid title (must be at least 10 characters)')
    }

    if (!f.business_value || typeof f.business_value !== 'string' || (f.business_value as string).length < 20) {
      throw new FeatureValueValidationError('Missing or invalid business_value (must be at least 20 characters)')
    }

    if (!f.description || typeof f.description !== 'string' || (f.description as string).length < 20) {
      throw new FeatureValueValidationError('Missing or invalid description (must be at least 20 characters)')
    }

    if (!Array.isArray(f.acceptance_criteria) || f.acceptance_criteria.length === 0) {
      throw new FeatureValueValidationError('Missing or empty acceptance_criteria array')
    }

    if (!Array.isArray(f.risk_of_not_delivering) || f.risk_of_not_delivering.length === 0) {
      throw new FeatureValueValidationError('Missing or empty risk_of_not_delivering array (REQUIRED)')
    }

    if (!Array.isArray(f.governance_references) || f.governance_references.length === 0) {
      throw new FeatureValueValidationError('Missing or empty governance_references array (REQUIRED)')
    }

    if (!f.derived_from_epic || typeof f.derived_from_epic !== 'string') {
      throw new FeatureValueValidationError('Missing or invalid derived_from_epic')
    }

    // Use comprehensive hardening validator
    const hardeningReport = validateFeatureHardening({
      feature_id: f.feature_id as string,
      title: f.title as string,
      business_value: f.business_value as string,
      description: f.description as string,
      acceptance_criteria: f.acceptance_criteria as string[],
      risk_of_not_delivering: f.risk_of_not_delivering as string[],
      governance_references: f.governance_references,
      derived_from_epic: f.derived_from_epic as string,
      epic_text: epicText,
    })

    if (!hardeningReport.valid) {
      throw new FeatureValueValidationError(`Feature hardening validation failed:\n${hardeningReport.errors.join('\n')}`)
    }

    // Check for prohibited descriptions (Muse internals)
    const prohibitedPatterns = [
      /muse platform/i,
      /pipeline/i,
      /upload/i,
      /metadata tracking/i,
      /markdown generation/i
    ]
    
    const titleStr = f.title as string
    const descStr = f.description as string
    const valueStr = f.business_value as string
    const descriptionText = `${titleStr} ${descStr} ${valueStr}`
    
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(descriptionText)) {
        throw new FeatureValueValidationError(
          `Feature describes Muse internals (prohibited): matched pattern ${pattern}`
        )
      }
    }

    // Validate governance references have markdown paths
    for (const ref of f.governance_references as unknown[]) {
      const refObj = ref as Record<string, unknown>
      if (!refObj.document_id || !refObj.filename || !Array.isArray(refObj.sections) || refObj.sections.length === 0) {
        throw new FeatureValueValidationError(
          'Each governance reference must include document_id, filename, and non-empty sections array'
        )
      }
      if (!refObj.markdown_path || typeof refObj.markdown_path !== 'string') {
        throw new FeatureValueValidationError(
          'Each governance reference must include markdown_path (full path to markdown file)'
        )
      }
    }
  }

  /**
   * Derive value-based features from Epic and governance content
   * 
   * @param epic Epic to decompose
   * @param governanceContent Full governance markdown content (authoritative source)
   * @param documentMetadata Document ID, filename, and paths for traceability
   */
  async deriveFeatures(
    epic: {
      epic_id: string
      objective: string
      success_criteria: string[]
    },
    governanceContent: string,
    documentMetadata: {
      document_id: string
      filename: string
      governance_path: string
    }
  ): Promise<FeatureValueOutput[]> {
    // If Anthropic API is not configured, fail explicitly
    if (!this.anthropic) {
      throw new FeatureValueValidationError(
        'ANTHROPIC_API_KEY not set - Feature derivation requires AI model'
      )
    }

    const systemPrompt = `You are the FeatureValueDerivationAgent in the Muse platform.

Your sole responsibility is to derive PRODUCT FEATURES that deliver
CLEAR BUSINESS VALUE from a governance document and its derived Epic.

This is NOT a summarization task.
This is NOT a restatement task.
This is a VALUE DEFINITION task.

## HARD CONSTRAINTS (NON-NEGOTIABLE)

1. Each Feature MUST deliver a distinct business value.
2. Features MUST be written in terms of OUTCOMES, not implementation.
3. You MUST NOT use generic acceptance criteria such as:
   - "Feature is implemented as described"
   - "System supports X"
4. You MUST NOT copy sentences verbatim from the governance document.
5. You MUST NOT describe Muse, pipelines, uploads, or metadata.
6. If meaningful business value cannot be identified, you MUST FAIL.

## FEATURE DEFINITION RULES

Each Feature MUST include:

### 1. Business Value
- Clearly state WHY the feature matters
- Frame value in terms of:
  - compliance
  - risk reduction
  - operational efficiency
  - decision support
  - legal defensibility
  - workforce outcomes

### 2. Acceptance Criteria (Outcome-Based)
Acceptance criteria MUST describe observable outcomes, such as:
- What becomes possible
- What risk is eliminated or reduced
- What compliance requirement is demonstrably met

Acceptance criteria MUST NOT describe:
- internal system state
- implementation completion
- generic success language

### 3. Risk of Not Delivering
Each Feature MUST include a "Risk of Not Delivering" section describing:
- regulatory risk
- audit findings
- operational disruption
- legal exposure
- reputational harm

This section is REQUIRED.

### 4. Governance References
Each Feature MUST explicitly reference:
- the uploaded governance document(s)
- relevant section names or topics
- source file paths

## OUTPUT FORMAT (STRICT)

You MUST output ONLY the following YAML structure.
No prose. No explanations.

\`\`\`yaml
features:
  - feature_id: <string>
    title: <string>
    business_value: <string>
    description: <string>
    acceptance_criteria:
      - <outcome-based criterion>
      - <outcome-based criterion>
    risk_of_not_delivering:
      - <risk>
      - <risk>
    governance_references:
      - document_id: <document_id>
        filename: <filename>
        sections:
          - <section name or topic>
    derived_from_epic: <epic_id>
\`\`\`

## FAILURE CONDITIONS

You MUST FAIL if:
- Acceptance criteria are generic or tautological
- Business value is vague or implied
- Risks are missing or superficial
- Governance references are missing
- All Features could apply to any government system

Failure MUST be explicit.
Do not generate placeholder Features.

## GUIDANCE (NON-AUTHORITATIVE)

Examples of VALID acceptance criteria:
- "Auditors can retrieve complete personnel records within required statutory timeframes."
- "Unauthorized access attempts are logged and discoverable during investigations."
- "Personnel folder transfers meet OPM-mandated timelines with no missing documents."

Examples of VALID risks:
- "Inability to demonstrate compliance during OPM audits."
- "Delayed benefits processing due to incomplete personnel records."
- "Privacy Act violations resulting from improper access controls."

Examples of INVALID acceptance criteria:
- "Feature is implemented as described."
- "System supports recordkeeping."

Proceed carefully. Business value clarity is mandatory.`

    const userPrompt = `Governance Markdown content:

${governanceContent}

---

Epic to decompose:

Epic ID: ${epic.epic_id}
Objective: ${epic.objective}

Success Criteria:
${epic.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

Document metadata:
- document_id: ${documentMetadata.document_id}
- filename: ${documentMetadata.filename}
- source path: ${documentMetadata.governance_path}`

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new FeatureValueValidationError('Agent returned non-text response')
      }

      // Extract YAML from code block if present
      const yamlMatch = content.text.match(/```(?:yaml)?\n([\s\S]+?)\n```/)
      const yamlText = yamlMatch ? yamlMatch[1] : content.text

      // Parse YAML response
      const parsed = YAML.parse(yamlText)

      if (!parsed || !parsed.features || !Array.isArray(parsed.features)) {
        throw new FeatureValueValidationError('Agent response missing features array')
      }

      if (parsed.features.length === 0) {
        throw new FeatureValueValidationError('Agent returned zero features - Epic may lack identifiable business value')
      }

      // Validate each feature
      const outputs: FeatureValueOutput[] = []
      for (let i = 0; i < parsed.features.length; i++) {
        const feature = parsed.features[i]
        
        // Ensure feature_id is set
        if (!feature.feature_id) {
          feature.feature_id = `feat-${epic.epic_id}-${String(i + 1).padStart(2, '0')}`
        }

        // Ensure derived_from_epic is set
        if (!feature.derived_from_epic) {
          feature.derived_from_epic = epic.epic_id
        }

        this.validateFeatureValueSchema(feature)

        outputs.push({
          ...feature,
          generated_at: new Date().toISOString(),
        })
      }

      console.log(`[FeatureValueDerivationAgent] Derived ${outputs.length} value-based features from epic ${epic.epic_id}`)
      return outputs
    } catch (error) {
      if (error instanceof FeatureValueValidationError) {
        throw error
      }
      console.error('[FeatureValueDerivationAgent] AI derivation failed:', error)
      throw new FeatureValueValidationError(`Feature derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
