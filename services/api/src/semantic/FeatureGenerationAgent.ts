import Anthropic from '@anthropic-ai/sdk'
import { Epic } from './EpicDerivationAgent'
import { SectionSummary } from './SectionSummaryJob'

export interface GeneratedFeature {
  feature_id: string
  epic_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  governance_references: string[]
}

/**
 * FeatureGenerationAgent — On-demand AI-powered feature derivation from Epic
 * 
 * Decomposes an approved Epic into implementation-ready Features.
 * Uses Claude when available, falls back to rule-based extraction.
 * 
 * Hard Constraints (enforced):
 * 1. Epic Alignment Is Mandatory — Every feature directly supports epic objective
 * 2. Features Must Represent Capabilities, Not Sections — System behavior, not governance structure
 * 3. Governance Is Context, Not Content — References inform behavior, not copied into descriptions
 * 4. Feature Count Discipline — 3–7 features max; produce fewer if sufficient
 * 5. Language and Quality Requirements — Complete sentences, clear verbs, testable criteria
 */
export class FeatureGenerationAgent {
  private client: Anthropic | null

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    } else {
      this.client = null
    }
  }

  /**
   * AI-powered feature generation using Claude
   */
  private async generateWithAI(
    epic: Epic,
    summaries: SectionSummary[]
  ): Promise<GeneratedFeature[]> {
    if (!this.client) {
      return this.generateRuleBased(epic, summaries)
    }

    // Format summaries for the prompt
    const formattedSummaries = summaries
      .map(
        (s) => `### Section: ${s.section_id} | ${s.title}
Obligations: ${s.obligations.join('; ') || 'None'}
Outcomes: ${s.outcomes.join('; ') || 'None'}
Actors: ${s.actors.join('; ') || 'None'}
Constraints: ${s.constraints.join('; ') || 'None'}`
      )
      .join('\n\n')

    const systemPrompt = `You are a Senior Product Manager and Federal Compliance SME decomposing an approved Epic into implementation-ready Features.

You are not summarizing policy text.
You are defining concrete product capabilities that fulfill the Epic's objective.

Output strict JSON. Each feature has:
- title: Capability-oriented, clear system behavior verb
- description: 1–2 sentences describing the system capability and purpose
- acceptance_criteria: Array of 2–3 observable, testable outcomes
- governance_references: Array of governance section IDs that inform this feature

HARD CONSTRAINTS (Must Follow):

1. Epic Alignment Is Mandatory — Every Feature must clearly support the Epic's objective. If a Feature does not directly advance the Epic, do not include it.

2. Features Must Represent Capabilities, Not Sections
   - A Feature must describe: What the system enables, enforces, or automates
   - How this capability contributes to compliance or operational outcomes
   - 🚫 Invalid Features: "Introduction", "Overview", Policy section titles, Lists of agencies or citations

3. Governance Is Context, Not Content
   - Governance references inform Feature behavior
   - Governance citations must NOT appear in Feature descriptions or acceptance criteria
   - Governance references are listed only in the dedicated section

4. Feature Count Discipline
   - Produce 3–7 Features maximum
   - If fewer are sufficient, produce fewer
   - Do not create artificial Features to inflate counts

5. Language and Quality Requirements
   - Descriptions and acceptance criteria: complete, clear sentences
   - Use verbs that describe system behavior (create, retain, validate, restrict, audit)
   - Be testable and implementation-oriented`

    const userPrompt = `Epic Details:
ID: ${epic.epic_id}
Title: ${epic.title}
Objective: ${epic.objective}
Success Criteria: ${epic.success_criteria.join('; ')}

Governance Context (read to understand intent, do NOT copy governance text into features):
${formattedSummaries}

Task: Derive a complete and minimal set of Features (3–7 max) that collectively satisfy the Epic's objective and success criteria.

Each Feature must represent a distinct, user- or system-facing capability that can be delivered independently.

Return a JSON array with this structure:
[
  {
    "title": "Feature Title",
    "description": "1-2 sentence description of what system enables/enforces/automates",
    "acceptance_criteria": ["observable outcome 1", "observable outcome 2", "observable outcome 3"],
    "governance_references": ["section-id-1", "section-id-2"]
  }
]

Return ONLY the JSON array. No markdown, no extra text.`

    try {
      const response = await this.client.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 2000,
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
        console.warn('[FeatureGenerationAgent] Unexpected response type, falling back to rule-based')
        return this.generateRuleBased(epic, summaries)
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('[FeatureGenerationAgent] No JSON array found in response, using fallback')
        return this.generateRuleBased(epic, summaries)
      }

      const features = JSON.parse(jsonMatch[0])

      if (!Array.isArray(features)) {
        console.warn('[FeatureGenerationAgent] Invalid response format, using fallback')
        return this.generateRuleBased(epic, summaries)
      }

      // Convert to GeneratedFeature with stable IDs
      return features
        .slice(0, 7) // Hard limit of 7 features
        .map((f, idx) => ({
          feature_id: `${epic.epic_id}-feature-${String(idx + 1).padStart(2, '0')}`,
          epic_id: epic.epic_id,
          title: f.title || `Feature ${idx + 1}`,
          description: f.description || '',
          acceptance_criteria: Array.isArray(f.acceptance_criteria) ? f.acceptance_criteria : [],
          governance_references: Array.isArray(f.governance_references)
            ? f.governance_references
            : [],
        }))
    } catch (error) {
      console.error('[FeatureGenerationAgent] AI generation failed:', error)
      return this.generateRuleBased(epic, summaries)
    }
  }

  /**
   * Rule-based feature generation (fallback when no API key or AI fails)
   */
  private generateRuleBased(epic: Epic, summaries: SectionSummary[]): GeneratedFeature[] {
    const features: GeneratedFeature[] = []

    // Group summaries into 2–3 summaries per feature (to stay in 3–7 range)
    const groupSize = Math.max(2, Math.ceil(summaries.length / 5))

    for (let i = 0; i < summaries.length && features.length < 7; i += groupSize) {
      const group = summaries.slice(i, i + groupSize)
      const idx = features.length + 1

      // Title: Derive from obligations or outcomes
      let title = `Feature ${idx}`
      if (group[0]?.obligations.length > 0) {
        title = this.titleFromObligation(group[0].obligations[0])
      } else if (group[0]?.outcomes.length > 0) {
        title = this.titleFromOutcome(group[0].outcomes[0])
      }

      // Description: Combine key outcomes and obligations
      const descParts: string[] = []
      for (const summary of group) {
        if (summary.outcomes.length > 0) {
          descParts.push(`${summary.title}: ${summary.outcomes[0]}`)
        }
      }
      const description = descParts.slice(0, 2).join('. ') || 'System capability derived from governance requirements.'

      // Acceptance criteria: Observable outcomes
      const criteria: string[] = []
      for (const summary of group) {
        for (const outcome of summary.outcomes.slice(0, 1)) {
          criteria.push(outcome)
        }
      }
      if (criteria.length === 0) {
        criteria.push('System implements requirements as specified')
      }

      // Governance references: Section IDs from group
      const govRefs = group.map((s) => s.section_id)

      features.push({
        feature_id: `${epic.epic_id}-feature-${String(idx).padStart(2, '0')}`,
        epic_id: epic.epic_id,
        title,
        description,
        acceptance_criteria: criteria.slice(0, 3),
        governance_references: govRefs,
      })
    }

    return features
  }

  /**
   * Derive a feature title from an obligation statement
   */
  private titleFromObligation(obligation: string): string {
    // Extract action verb and key noun
    const match = obligation.match(/(?:must|shall|will|shall\s+be)\s+(\w+)(?:\s+(\w+))?\s*(.+?)(?:\.|$)/i)
    if (match) {
      const verb = match[1]
      const obj = match[2] || match[3]?.split(/\s+/)[0] || 'requirement'
      return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${obj}`
    }
    return obligation.split(/\W+/).slice(0, 3).join(' ')
  }

  /**
   * Derive a feature title from an outcome statement
   */
  private titleFromOutcome(outcome: string): string {
    // Outcomes often describe results; extract key nouns/actions
    const words = outcome.split(/\W+/).filter((w) => w.length > 3)
    return words.slice(0, 3).join(' ') || 'Capability'
  }

  /**
   * Generate features for an Epic
   * - Tries AI first (if ANTHROPIC_API_KEY set)
   * - Falls back to rule-based generation
   */
  async run(epic: Epic, summaries: SectionSummary[]): Promise<GeneratedFeature[]> {
    return this.generateWithAI(epic, summaries)
  }
}
