import Anthropic from '@anthropic-ai/sdk'

export interface GeneratedStory {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  acceptance_criteria: string[]
  governance_references: string[]
}

/**
 * UserStoryGenerationAgent — On-demand AI-powered user story derivation from Feature
 * 
 * Decomposes an approved Feature into implementation-ready User Stories.
 * Uses Claude with strict discipline prompt to ensure stories are:
 * - Independently implementable
 * - Testable
 * - Traceable to governance
 * 
 * Hard Constraints (enforced):
 * 1. Scope Discipline — Stories implement only the Feature
 * 2. Story Size and Count — 2–6 stories; generate fewer if sufficient
 * 3. User Story Structure — Standard "As a/I want/so that" format
 * 4. Acceptance Criteria Quality — Observable behavior, no compliance citations
 * 5. Governance Is Context, Not Content — References inform, not copied
 */
export class UserStoryGenerationAgent {
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
   * AI-powered story generation using Claude with strict prompt
   */
  private async generateWithAI(
    feature: {
      feature_id: string
      title: string
      description: string
      acceptance_criteria: string[]
      governance_references?: string[]
    },
    epic: {
      epic_id: string
      objective?: string
      success_criteria?: string[]
    },
    governanceContent: string
  ): Promise<GeneratedStory[]> {
    if (!this.client) {
      return this.generateRuleBased(feature)
    }

    // Ensure epic has required fields with safe defaults
    const epicObjective = epic.objective || 'Support the Feature implementation'
    const epicSuccessCriteria = epic.success_criteria && Array.isArray(epic.success_criteria) ? epic.success_criteria : ['Feature successfully implemented']
    const featureGovernanceRefs = feature.governance_references && Array.isArray(feature.governance_references) ? feature.governance_references : []

    const systemPrompt = `You are a Senior Product Owner and Federal Compliance SME translating an approved Feature into implementation-ready User Stories suitable for engineering teams working in regulated environments.

You are not rewriting policy.
You are defining small, testable units of behavior that collectively implement the Feature.

## HARD CONSTRAINTS (Must Follow)

1. Scope Discipline
   - User Stories must implement only the provided Feature
   - Do not introduce new capabilities
   - Do not restate the Feature as a single large story

2. Story Size and Count
   - Generate 2–6 User Stories
   - Each story must represent a single responsibility
   - If fewer stories are sufficient, generate fewer

3. User Story Structure (Strict)
   Each User Story must follow this format:
   - As a <role>,
   - I want <system behavior>,
   - so that <measurable outcome>.
   Roles must be realistic (e.g., system, HR specialist, records manager, auditor).

4. Acceptance Criteria Quality
   - Describe observable system behavior
   - Be written in clear, complete sentences
   - Avoid policy citations, section numbers, or agency lists
   - Be testable by an engineer or QA analyst
   
   🚫 Invalid acceptance criteria include:
   - "Meets OMB guidance"
   - "Ensures compliance"
   - "According to Section X"

5. Governance Is Context, Not Content
   - Governance references inform behavior
   - Governance citations must appear only in the Governance References section
   - Do not embed citations in story text or acceptance criteria

## Output Format (Strict JSON)

Return ONLY a JSON array. No markdown, no extra text.

[
  {
    "title": "Concise behavioral title",
    "role": "realistic role",
    "capability": "system behavior (2-3 words)",
    "benefit": "measurable outcome (2-3 words)",
    "acceptance_criteria": ["Observable behavior 1", "Observable behavior 2", "Observable behavior 3"],
    "governance_references": ["section-id-1", "section-id-2"]
  }
]

Each acceptance criterion must be observable and testable.
Each story must be independently implementable.`

    const userPrompt = `Feature to decompose:

Feature ID: ${feature.feature_id}
Title: ${feature.title}
Description: ${feature.description}

Acceptance Criteria:
${feature.acceptance_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Parent Epic:

Epic ID: ${epic.epic_id}
Objective: ${epicObjective}
Success Criteria: ${epicSuccessCriteria.join('; ')}

Governance References: ${featureGovernanceRefs.join(', ')}

---

Governance Context (read to understand intent, do NOT copy governance text into stories):

${governanceContent.slice(0, 5000)}

---

Task: Derive a complete but minimal set of User Stories (2–6 max) that, collectively, implement the Feature while honoring the Epic's intent and applicable governance requirements.

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
        console.warn('[UserStoryGenerationAgent] Unexpected response type, falling back to rule-based')
        return this.generateRuleBased(feature)
      }

      // Parse JSON response
      let stories: Array<{
        title: string
        role: string
        capability: string
        benefit: string
        acceptance_criteria: string[]
        governance_references: string[]
      }>

      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('[UserStoryGenerationAgent] No JSON array found in response, using fallback')
        return this.generateRuleBased(feature)
      }

      const stories = JSON.parse(jsonMatch[0])

      if (!Array.isArray(stories)) {
        console.warn('[UserStoryGenerationAgent] Invalid response format, using fallback')
        return this.generateRuleBased(feature)
      }

      // Convert to GeneratedStory with stable IDs
      return stories
        .slice(0, 6) // Hard limit of 6 stories
        .map((s, idx) => ({
          story_id: `${feature.feature_id}-story-${String(idx + 1).padStart(2, '0')}`,
          title: s.title || `Story ${idx + 1}`,
          role: s.role || 'user',
          capability: s.capability || '',
          benefit: s.benefit || '',
          acceptance_criteria: Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria : [],
          governance_references: Array.isArray(s.governance_references) ? s.governance_references : [],
        }))
    } catch (error) {
      console.error('[UserStoryGenerationAgent] AI generation failed:', error)
      return this.generateRuleBased(feature)
    }
  }

  /**
   * Rule-based story generation (fallback when no API key or AI fails)
   */
  private generateRuleBased(
    feature: {
      feature_id: string
      title: string
      acceptance_criteria: string[]
      governance_references?: string[]
    }
  ): GeneratedStory[] {
    const stories: GeneratedStory[] = []
    const featureGovernanceRefs = feature.governance_references && Array.isArray(feature.governance_references) ? feature.governance_references : []

    // Generate 2-4 stories based on acceptance criteria count
    const storyCount = Math.min(4, Math.max(2, feature.acceptance_criteria.length))

    for (let i = 0; i < storyCount && i < feature.acceptance_criteria.length; i++) {
      const criterion = feature.acceptance_criteria[i]
      const nn = String(i + 1).padStart(2, '0')

      stories.push({
        story_id: `${feature.feature_id}-story-${nn}`,
        title: `Implement ${feature.title} - Part ${i + 1}`,
        role: 'system',
        capability: `ensure ${criterion.toLowerCase().slice(0, 30)}`,
        benefit: 'compliance and functionality',
        acceptance_criteria: [criterion],
        governance_references: featureGovernanceRefs,
      })
    }

    return stories
  }

  /**
   * Generate user stories from a feature and epic
   */
  async run(
    feature: {
      feature_id: string
      title: string
      description: string
      acceptance_criteria: string[]
      governance_references?: string[]
    },
    epic: {
      epic_id: string
      objective?: string
      success_criteria?: string[]
    },
    governanceContent: string
  ): Promise<GeneratedStory[]> {
    return this.generateWithAI(feature, epic, governanceContent)
  }
}
