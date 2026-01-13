import crypto from 'crypto'

export interface SectionSummary {
  section_id: string
  title: string
  obligations: string[]
  outcomes: string[]
  actors: string[]
  constraints: string[]
  references: string[]
  cached: boolean
}

/**
 * SectionSummaryJob — Curated semantic summaries for governance sections
 * 
 * STEP 5: Extract structured obligations, outcomes, actors, and constraints.
 * This is what epic derivation actually consumes (not raw markdown).
 */
export class SectionSummaryJob {
  constructor(private readonly cache: Map<string, SectionSummary>) {}

  private key(sectionId: string, content: string): string {
    const hash = crypto.createHash('sha256').update(sectionId + content).digest('hex').slice(0,16)
    return `summary:${sectionId}:${hash}`
  }

  /**
   * Extract obligations: actionable requirements or mandates.
   * Look for modal verbs (must, shall, will, should) and bullet lists.
   */
  private extractObligations(content: string): string[] {
    const obligations: string[] = []

    // Extract from bullet lists (cleaned content should have meaningful bullets)
    const bulletMatches = content.match(/-\s+(.+)/g) || []
    for (const match of bulletMatches) {
      const text = match.replace(/-\s+/, '').trim()
      // Filter out structural noise that survived normalization
      if (text.length > 20 && !/^\d+\.?$/.test(text) && !/^\.{3,}/.test(text)) {
        obligations.push(text)
      }
    }

    // Extract sentences with modal verbs (must, shall, will, should)
    const modalPattern = /([^.!?]+(?:must|shall|will|should)[^.!?]+[.!?])/gi
    const modalMatches = content.match(modalPattern) || []
    for (const sentence of modalMatches) {
      const cleaned = sentence.trim()
      if (cleaned.length > 30 && !obligations.includes(cleaned)) {
        obligations.push(cleaned)
      }
    }

    return obligations.slice(0, 8) // Cap at 8 obligations per section
  }

  /**
   * Extract outcomes: expected results or consequences.
   * Look for result-oriented language.
   */
  private extractOutcomes(content: string): string[] {
    const outcomes: string[] = []

    // Look for outcome-oriented patterns
    const outcomePatterns = [
      /(?:ensure|ensures|ensuring)\s+([^.!?]+[.!?])/gi,
      /(?:result in|results in)\s+([^.!?]+[.!?])/gi,
      /(?:achieve|achieves|achieving)\s+([^.!?]+[.!?])/gi,
      /(?:maintain|maintains|maintaining)\s+([^.!?]+[.!?])/gi,
      /(?:remain|remains)\s+([^.!?]+[.!?])/gi,
    ]

    for (const pattern of outcomePatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        const cleaned = match.trim()
        if (cleaned.length > 20 && !outcomes.includes(cleaned)) {
          outcomes.push(cleaned)
        }
      }
    }

    return outcomes.slice(0, 5) // Cap at 5 outcomes per section
  }

  /**
   * Extract actors: who is responsible.
   * Look for organizational entities and role references.
   */
  private extractActors(content: string): string[] {
    const actors = new Set<string>()

    // Common governance actor patterns
    const actorPatterns = [
      /\b(agencies|agency)\b/gi,
      /\b(federal\s+\w+)\b/gi,
      /\b(departments?|offices?)\b/gi,
      /\b(administrators?|officers?)\b/gi,
      /\b(personnel|employees?)\b/gi,
      /\b(systems?|platforms?)\b/gi,
    ]

    for (const pattern of actorPatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        actors.add(match.trim().toLowerCase())
      }
    }

    return Array.from(actors).slice(0, 5)
  }

  /**
   * Extract constraints: limitations, conditions, or compliance requirements.
   */
  private extractConstraints(content: string): string[] {
    const constraints: string[] = []

    // Look for constraint patterns
    const constraintPatterns = [
      /(?:in accordance with|per|pursuant to)\s+([^.!?,]+)/gi,
      /(?:comply with|compliant with)\s+([^.!?,]+)/gi,
      /(?:subject to)\s+([^.!?,]+)/gi,
    ]

    for (const pattern of constraintPatterns) {
      const matches = content.match(pattern) || []
      for (const match of matches) {
        const cleaned = match.trim()
        if (cleaned.length > 15 && !constraints.includes(cleaned)) {
          constraints.push(cleaned)
        }
      }
    }

    return constraints.slice(0, 5)
  }

  async run(sectionId: string, title: string, content: string): Promise<SectionSummary> {
    const k = this.key(sectionId, content)
    const cached = this.cache.get(k)
    if (cached) {
      return { ...cached, cached: true }
    }

    // STEP 5: Curated semantic extraction
    const summary: SectionSummary = {
      section_id: sectionId,
      title,
      obligations: this.extractObligations(content),
      outcomes: this.extractOutcomes(content),
      actors: this.extractActors(content),
      constraints: this.extractConstraints(content),
      references: [], // Can be enhanced to extract cross-references
      cached: false,
    }

    this.cache.set(k, summary)
    return summary
  }
}
