import Anthropic from '@anthropic-ai/sdk'
import { SectionSummary } from './SectionSummaryJob'

export interface Epic {
  epic_id: string
  title: string
  objective: string
  success_criteria: string[]
  source_sections: string[]
}

/**
 * EpicDerivationAgent — AI-powered epic derivation from governance summaries
 * 
 * Translates curated governance section summaries into implementation-ready Epics.
 * Uses Claude (via Anthropic API) when available, falls back to rule-based extraction.
 */
export class EpicDerivationAgent {
  private client: Anthropic | null

  constructor(private readonly docId: string) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    } else {
      this.client = null
    }
  }

  /**
   * AI-powered epic derivation using Claude
   */
  private async deriveWithAI(summaries: SectionSummary[]): Promise<Epic[]> {
    if (!this.client) {
      return this.deriveRuleBased(summaries)
    }

    // Format summaries for the prompt
    const formattedSummaries = summaries
      .map(
        (s) => `## Section: ${s.section_id} | Title: ${s.title}
Obligations: ${s.obligations.join('; ')}
Outcomes: ${s.outcomes.join('; ')}
Actors: ${s.actors.join('; ')}
Constraints: ${s.constraints.join('; ')}`
      )
      .join('\n\n')

    const systemPrompt = `You are a Senior Product Manager and Federal Compliance SME translating governance and policy requirements into implementation-ready product epics.

You are NOT summarizing the document. You are deriving business capabilities required to operationalize it.

HARD CONSTRAINTS:
1. Coverage Is Mandatory: Every governance section must be addressed by at least one Epic. If a section's intent is not clearly covered, create a new Epic. Do not merge unrelated obligations just to reduce the number of Epics.

2. Epics Must Express Business Capability: Each Epic must describe what capability is being established, explain why it matters operationally, and be understandable to a product manager, engineer, and auditor.

3. No Structural or Source Artifacts: Do not include section numbers, program names without verbs, page references, agency lists without context, or table-of-contents language. Governance citations belong only in the Governance References section.

4. Language Requirements: Epic Objectives and Success Criteria must be written in complete sentences, contain clear verbs (e.g., manage, retain, control, audit, protect), and describe observable outcomes. If a sentence cannot be tested or reasoned about, rewrite it.

Output Format (STRICT):
For each Epic, produce JSON with these fields:
{
  "title": "Concise capability-oriented title",
  "objective": "1–2 sentences describing the business capability and its operational value",
  "success_criteria": ["Observable outcome 1", "Observable outcome 2", "Observable outcome 3"],
  "source_sections": ["sec-...", "sec-..."]
}

Quality Bar (Self-Check Before Responding):
- Every Epic objective could reasonably be implemented by a product team
- Success criteria describe outcomes, not citations
- No Epic reads like a paraphrase of policy text
- A compliance reviewer could trace each Epic back to governance sections`

    const userPrompt = `Derive a complete and minimal set of Epics from these governance summaries. Ensure 100% coverage of business value and obligations.

${formattedSummaries}

Return a JSON array of Epic objects with exactly this structure (no markdown, no extra text):
[
  {
    "title": "...",
    "objective": "...",
    "success_criteria": ["...", "..."],
    "source_sections": ["sec-...", "sec-..."]
  }
]`

    try {
      console.log('[EpicDerivationAgent] Calling Claude API for epic derivation')
      const response = await this.client.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.error('[EpicDerivationAgent] No JSON found in response:', content.text.substring(0, 200))
        return this.deriveRuleBased(summaries)
      }

      const derivedEpics = JSON.parse(jsonMatch[0]) as Array<{
        title: string
        objective: string
        success_criteria: string[]
        source_sections: string[]
      }>

      // Convert to Epic objects with IDs
      return derivedEpics.map((e, idx) => ({
        epic_id: `epic-${this.docId.substring(0, 8)}-${String(idx + 1).padStart(2, '0')}`,
        title: e.title,
        objective: e.objective,
        success_criteria: e.success_criteria.slice(0, 6),
        source_sections: e.source_sections,
      }))
    } catch (error) {
      console.error('[EpicDerivationAgent] Error calling Claude API:', error)
      return this.deriveRuleBased(summaries)
    }
  }

  /**
   * Rule-based fallback for epic derivation (used in testing, no API key)
   */
  private deriveRuleBased(summaries: SectionSummary[]): Epic[] {
    console.log('[EpicDerivationAgent] ANTHROPIC_API_KEY not set, using rule-based extraction')

    const epics: Epic[] = []

    // Group summaries by similar obligations/outcomes
    for (let i = 0; i < summaries.length; i += 5) {
      const group = summaries.slice(i, i + 5)
      const num = String(epics.length + 1).padStart(2, '0')
      const epic_id = `epic-${this.docId.substring(0, 8)}-${num}`

      // Title: Use first section title or derive from obligations
      const title =
        group[0]?.title ||
        group
          .flatMap((s) => s.obligations)
          .filter((o) => o.length > 10)
          .slice(0, 1)[0]
          ?.substring(0, 50) ||
        `Governance Capability ${num}`

      // Objective: Derive from first outcome or obligation
      let objective = 'Establish governance control'
      if (group[0]?.outcomes.length > 0) {
        objective = group[0].outcomes[0]
      } else if (group[0]?.obligations.length > 0) {
        objective = group[0].obligations[0]
      }

      // Success criteria: Combine outcomes and key obligations
      const success_criteria: string[] = []
      for (const summary of group) {
        for (const outcome of summary.outcomes.slice(0, 2)) {
          if (!success_criteria.includes(outcome)) {
            success_criteria.push(outcome)
          }
        }
        for (const obligation of summary.obligations.slice(0, 1)) {
          if (!success_criteria.includes(obligation) && success_criteria.length < 6) {
            success_criteria.push(obligation)
          }
        }
      }

      const source_sections = group.map((s) => s.section_id)
      epics.push({
        epic_id,
        title,
        objective,
        success_criteria: success_criteria.slice(0, 6),
        source_sections,
      })
    }

    return epics.slice(0, 12)
  }

  /**
   * Main entry point: derive epics from summaries
   */
  async run(summaries: SectionSummary[]): Promise<Epic[]> {
    return this.deriveWithAI(summaries)
  }
}
