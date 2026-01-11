import Anthropic from '@anthropic-ai/sdk'

/**
 * Schema for Feature output
 */
export interface FeatureSchema {
  feature_id: string
  title: string
  description: string
  derived_from_epic: string
}

/**
 * Agent output with metadata
 */
export interface FeatureOutput extends FeatureSchema {
  generated_at: string
}

/**
 * Error thrown when agent output fails validation
 */
export class FeatureValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeatureValidationError'
  }
}

/**
 * EpicDecompositionAgent — Decomposes Epic into implementable Features
 * 
 * Takes a single Epic and breaks it down into a small set of implementable product features.
 * Each feature describes a SYSTEM CAPABILITY, not a task or story.
 * 
 * Constraints:
 * - Each Feature MUST describe a SYSTEM CAPABILITY
 * - Each Feature MUST include an actor, behavioral verb, and domain noun
 * - Does NOT repeat Epic text
 * - Does NOT describe pipeline steps
 * - Does NOT invent scope not implied by the Epic
 */
export class EpicDecompositionAgent {
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
   * Validate Feature output against schema
   */
  private validateFeatureSchema(feature: any): asserts feature is FeatureSchema {
    const errors: string[] = []

    if (!feature.feature_id || typeof feature.feature_id !== 'string') {
      errors.push('Missing or invalid feature_id')
    }

    if (!feature.title || typeof feature.title !== 'string') {
      errors.push('Missing or invalid title')
    }

    if (!feature.description || typeof feature.description !== 'string') {
      errors.push('Missing or invalid description')
    }

    if (!feature.derived_from_epic || typeof feature.derived_from_epic !== 'string') {
      errors.push('Missing or invalid derived_from_epic')
    }

    // Validate feature contains behavioral verb and domain noun
    const verbPattern = /(log|record|retain|query|export|protect|authenticate|authorize|validate|process|store|retrieve|monitor|track|audit|enable|ensure|provide|implement|establish|maintain|support|manage|control|define|document|review|update|create|enforce|verify|assess|report|notify|alert|configure|integrate|synchronize|backup|restore|archive|delete|remove|add|modify|change|approve|reject|execute|perform|conduct|demonstrate|require|allow|prevent|restrict|grant|revoke|assign|unassign|register|deregister|activate|deactivate|suspend|resume|lock|unlock|encrypt|decrypt|sign|certify|comply|adhere|follow|meet|satisfy|achieve|deliver|complete|finalize|initiate|start|stop|end|cancel|pause|continue|schedule|plan|organize|coordinate|communicate|inform|notify|escalate|resolve|address|handle|manage|oversee|govern|regulate|standardize|normalize|harmonize|align|integrate|consolidate|aggregate|summarize|analyze|evaluate|calculate|compute|measure|quantify|estimate|forecast|predict|recommend|suggest|advise|guide|instruct|train|educate|inform|warn|alert)/i
    const nounPattern = /(access|authentication|authorization|logs|data|events|records|users|sessions|credentials|policies|compliance|audit|security|privacy|confidentiality|integrity|availability|identity|role|permission|privilege|right|entitlement|resource|asset|document|file|folder|directory|database|system|application|service|interface|api|endpoint|connection|network|infrastructure|platform|environment|configuration|setting|parameter|option|preference|metadata|attribute|property|field|value|content|message|notification|alert|report|dashboard|metric|indicator|measure|threshold|limit|quota|capacity|performance|availability|reliability|scalability|maintainability|usability|accessibility|compatibility|interoperability|standard|guideline|procedure|process|workflow|lifecycle|phase|stage|step|task|activity|action|operation|transaction|request|response|input|output|result|outcome|status|state|condition|error|exception|warning|issue|incident|problem|defect|vulnerability|risk|threat|control|safeguard|countermeasure|mitigation|remediation|correction|improvement|enhancement|optimization|change|modification|update|upgrade|patch|fix|resolution|closure|approval|rejection|acceptance|verification|validation|certification|accreditation|attestation|declaration|statement|assertion|claim|evidence|proof|documentation|record|trail|history|log|archive|backup|snapshot|checkpoint|restore|recovery|rollback|version|revision|release|deployment|installation|configuration|setup|initialization|provisioning|deprovisioning|retirement|decommissioning|disposal|destruction|deletion|removal|purge|expiration|retention|preservation|archival|storage|repository|registry|catalog|inventory|index|directory|listing|manifest|schema|model|template|pattern|format|structure|layout|design|architecture|framework|component|module|library|package|bundle|artifact|deliverable|output|product|service|offering|capability|feature|function|functionality|behavior|characteristic|quality|requirement|specification|criteria|constraint|assumption|dependency|prerequisite|precondition|postcondition|invariant|rule|policy|regulation|law|statute|ordinance|code|standard|norm|convention|practice|custom|tradition|habit|routine|procedure)/i
    
    if (!verbPattern.test(feature.description) && !verbPattern.test(feature.title)) {
      errors.push('Feature description or title should contain an action verb describing the capability')
    }

    if (!nounPattern.test(feature.description) && !nounPattern.test(feature.title)) {
      errors.push('Feature description or title should reference a domain concept or artifact')
    }

    // No additional fields allowed
    const allowedFields = ['feature_id', 'title', 'description', 'derived_from_epic']
    const extraFields = Object.keys(feature).filter((key) => !allowedFields.includes(key))
    if (extraFields.length > 0) {
      errors.push(`Unexpected fields: ${extraFields.join(', ')}`)
    }

    if (errors.length > 0) {
      throw new FeatureValidationError(`Feature validation failed:\n${errors.join('\n')}`)
    }
  }

  /**
   * Invoke agent to decompose Epic into Features
   * 
   * Uses Claude AI with strict validation prompt from Prompt-muse-Userstory-Validation.md
   */
  async deriveFeatures(epic: {
    epic_id: string
    objective: string
    success_criteria: string[]
  }): Promise<FeatureOutput[]> {
    // If Anthropic API is not configured, fail explicitly
    if (!this.anthropic) {
      throw new FeatureValidationError(
        'ANTHROPIC_API_KEY not set - Feature derivation requires AI model'
      )
    }

    const systemPrompt = `You are the EpicDecompositionAgent in the Muse platform.

Your sole responsibility is to decompose a SINGLE Epic into a SMALL SET
of IMPLEMENTABLE PRODUCT FEATURES.

This is NOT task breakdown and NOT story creation.

## HARD CONSTRAINTS (NON-NEGOTIABLE)

1. Each Feature MUST describe a SYSTEM CAPABILITY.
2. Each Feature MUST:
   - Include an actor (system, user, auditor, service)
   - Include a behavioral verb (e.g. log, record, retain, query, export, protect)
   - Include a domain noun (e.g. access, authentication, authorization, logs)
3. You MUST NOT:
   - Repeat the Epic text
   - Describe pipeline steps
   - Describe documentation or metadata handling
   - Describe implementation tasks
4. You MUST NOT invent scope not implied by the Epic.
5. If you cannot derive implementable capabilities, you MUST FAIL.

## FEATURE DEFINITION RULES

Features represent:
- Capabilities that could be implemented by software
- Units that can be decomposed into user stories

Features are NOT:
- Epics
- Tasks
- User stories
- Acceptance criteria

## OUTPUT FORMAT (STRICT)

You MUST output ONLY valid YAML in this exact structure:

\`\`\`yaml
features:
  - feature_id: <string>
    title: <string>
    description: <string>
    derived_from_epic: ${epic.epic_id}
  - feature_id: <string>
    title: <string>
    description: <string>
    derived_from_epic: ${epic.epic_id}
\`\`\`

No prose. No explanations. Only YAML.

## VALIDATION EXPECTATIONS

Each Feature description MUST clearly answer:
- What capability exists?
- Who or what uses it?
- What governance outcome does it support?

## FAILURE CONDITIONS

You MUST FAIL if:
- Feature descriptions are vague or generic
- Features lack verbs or domain nouns
- Features describe Muse behavior instead of system behavior
- All features could apply to any governance document

Examples of VALID Features:
- "Log all authentication and authorization events for system access."
- "Retain access logs for a minimum of 365 days to support audits."
- "Allow authorized auditors to query and export access logs."

Examples of INVALID Features:
- "Governance documents are stored."
- "Metadata is tracked."
- "Markdown is generated."`

    const userPrompt = `Epic to decompose:

Epic ID: ${epic.epic_id}
Objective: ${epic.objective}

Success Criteria:
${epic.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
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
        throw new FeatureValidationError('Agent returned non-text response')
      }

      // Extract YAML from code block if present
      const yamlMatch = content.text.match(/```(?:yaml)?\n([\s\S]+?)\n```/)
      const yamlText = yamlMatch ? yamlMatch[1] : content.text

      // Parse YAML response
      const YAML = require('yaml')
      const parsed = YAML.parse(yamlText)

      if (!parsed || !parsed.features || !Array.isArray(parsed.features)) {
        throw new FeatureValidationError('Agent response missing features array')
      }

      if (parsed.features.length === 0) {
        throw new FeatureValidationError('Agent returned zero features - Epic may be undecomposable')
      }

      // Validate each feature
      const outputs: FeatureOutput[] = []
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

        this.validateFeatureSchema(feature)

        outputs.push({
          ...feature,
          generated_at: new Date().toISOString(),
        })
      }

      console.log(`[EpicDecompositionAgent] Derived ${outputs.length} features from epic ${epic.epic_id}`)
      return outputs
    } catch (error) {
      if (error instanceof FeatureValidationError) {
        throw error
      }
      console.error('[EpicDecompositionAgent] AI derivation failed:', error)
      throw new FeatureValidationError(`Feature derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
