import matter from 'gray-matter'
import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Schema for Epic output
 */
export interface EpicSchema {
  epic_id: string
  derived_from: string
  source_markdown: string
  objective: string
  success_criteria: string[]
}

/**
 * Agent output with metadata
 */
export interface EpicOutput extends EpicSchema {
  generated_at: string
}

/**
 * Error thrown when agent output fails validation
 */
export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentValidationError'
  }
}

/**
 * GovernanceIntentAgent — First interpretive step in Muse
 * 
 * Extracts high-level Epic (objective + success criteria) from governance Markdown.
 * This is a bounded agent that operates under strict schema validation.
 * 
 * Constraints:
 * - Outputs exactly one Epic per governance document
 * - Does NOT invent features or stories
 * - Does NOT brainstorm or add implementation details
 * - Extracts intent directly supported by the source document
 */
export class GovernanceIntentAgent {
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
   * Read and parse governance Markdown
   */
  private readGovernanceMarkdown(markdownPath: string): { content: string; frontMatter: any } {
    if (!fs.existsSync(markdownPath)) {
      throw new Error(`Governance Markdown not found: ${markdownPath}`)
    }

    const fileContent = fs.readFileSync(markdownPath, 'utf-8')
    const parsed = matter(fileContent)

    return {
      content: parsed.content,
      frontMatter: parsed.data
    }
  }

  /**
   * Validate Epic output against schema
   */
  private validateEpicSchema(epic: any): asserts epic is EpicSchema {
    const errors: string[] = []

    if (!epic.epic_id || typeof epic.epic_id !== 'string') {
      errors.push('Missing or invalid epic_id')
    }

    if (!epic.derived_from || typeof epic.derived_from !== 'string') {
      errors.push('Missing or invalid derived_from')
    }

    if (!epic.source_markdown || typeof epic.source_markdown !== 'string') {
      errors.push('Missing or invalid source_markdown')
    }

    if (!epic.objective || typeof epic.objective !== 'string') {
      errors.push('Missing or invalid objective')
    }

    if (!Array.isArray(epic.success_criteria) || epic.success_criteria.length === 0) {
      errors.push('Missing or invalid success_criteria (must be non-empty array)')
    }

    if (epic.success_criteria && !epic.success_criteria.every((c: any) => typeof c === 'string')) {
      errors.push('All success_criteria must be strings')
    }

    // No additional fields allowed
    const allowedFields = ['epic_id', 'derived_from', 'source_markdown', 'objective', 'success_criteria']
    const extraFields = Object.keys(epic).filter(key => !allowedFields.includes(key))
    if (extraFields.length > 0) {
      errors.push(`Unexpected fields: ${extraFields.join(', ')}`)
    }

    if (errors.length > 0) {
      throw new AgentValidationError(`Epic validation failed:\n${errors.join('\n')}`)
    }
  }

  /**
   * Invoke agent to derive Epic from governance document
   * 
   * Uses Claude AI with strict validation prompt from Prompt-muse-Userstory-Validation.md
   */
  private async invokeAgent(governanceContent: string, documentId: string, markdownPath: string): Promise<EpicSchema> {
    const epicId = `epic-${documentId.substring(0, 8)}`

    // If Anthropic API is not configured, fall back to rule-based extraction
    if (!this.anthropic) {
      console.warn('[GovernanceIntentAgent] ANTHROPIC_API_KEY not set, using rule-based extraction')
      return this.ruleBasedExtractEpic(governanceContent, documentId, markdownPath, epicId)
    }

    // AI-powered epic derivation using validation prompt
    const systemPrompt = `You are the GovernanceIntentAgent in the Muse platform.

Your sole responsibility is to derive a SINGLE Epic that captures the
HIGH-LEVEL BUSINESS AND GOVERNANCE INTENT of the provided governance document.

This is an interpretive task, but it is NOT creative.

## HARD CONSTRAINTS (NON-NEGOTIABLE)

1. You may ONLY derive intent that is explicitly supported by the governance content.
2. You MUST NOT reference:
   - document upload
   - file storage
   - metadata capture
   - markdown conversion
   - pipelines
   - artifact generation
   - AI, agents, or automation
3. You MUST NOT describe how Muse works.
4. You MUST NOT invent requirements or outcomes.
5. If governance intent cannot be determined, you MUST FAIL.

## EPIC DEFINITION RULES

The Epic MUST:
- Describe a GOVERNANCE or BUSINESS OUTCOME
- Be phrased independently of implementation details
- Be meaningful to a product owner or compliance leader
- Include a concise Objective (1–2 sentences)
- Include 3–6 Success Criteria that reflect policy outcomes

## OUTPUT FORMAT (STRICT)

You MUST output ONLY valid YAML in this exact structure:

\`\`\`yaml
epic:
  epic_id: ${epicId}
  objective: <string>
  success_criteria:
    - <string>
    - <string>
    - <string>
  derived_from: ${documentId}
\`\`\`

No prose. No explanations. Only YAML.`

    const userPrompt = `Governance Markdown content:\n\n${governanceContent}\n\nDocument metadata:\n- document_id: ${documentId}\n- filename: ${markdownPath}`

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
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
        throw new AgentValidationError('Agent returned non-text response')
      }

      // Extract YAML from code block if present
      const yamlMatch = content.text.match(/```(?:yaml)?\n([\s\S]+?)\n```/)
      const yamlText = yamlMatch ? yamlMatch[1] : content.text

      // Parse YAML response
      const YAML = require('yaml')
      const parsed = YAML.parse(yamlText)

      if (!parsed || !parsed.epic) {
        throw new AgentValidationError('Agent response missing epic structure')
      }

      const epic: EpicSchema = {
        epic_id: parsed.epic.epic_id || epicId,
        derived_from: parsed.epic.derived_from || documentId,
        source_markdown: markdownPath,
        objective: parsed.epic.objective,
        success_criteria: parsed.epic.success_criteria,
      }

      return epic
    } catch (error) {
      if (error instanceof AgentValidationError) {
        throw error
      }
      console.error('[GovernanceIntentAgent] AI derivation failed:', error)
      console.warn('[GovernanceIntentAgent] Falling back to rule-based extraction')
      return this.ruleBasedExtractEpic(governanceContent, documentId, markdownPath, epicId)
    }
  }

  /**
   * Rule-based fallback for epic extraction
   */
  private ruleBasedExtractEpic(
    governanceContent: string,
    documentId: string,
    markdownPath: string,
    epicId: string
  ): EpicSchema {
    const lines = governanceContent.split('\n')
    const contentLines = lines.filter((line) => line.trim() && !line.startsWith('#'))
    const objective =
      contentLines.slice(0, 3).join(' ').trim() ||
      'Enable governance-driven development through automated document processing and traceability'

    const criteriaPattern = /^[-*\d.]\s+(.+)/
    const criteria = lines
      .filter((line) => criteriaPattern.test(line.trim()))
      .map((line) => line.trim().replace(criteriaPattern, '$1'))
      .filter((c) => c.length > 10)
      .slice(0, 5)

    return {
      epic_id: epicId,
      derived_from: documentId,
      source_markdown: markdownPath,
      objective: objective.substring(0, 500),
      success_criteria:
        criteria.length > 0
          ? criteria
          : [
              'Governance documents are successfully uploaded and stored',
              'Document metadata is accurately captured and retrievable',
              'Markdown conversion preserves document structure and intent',
              'Traceability links are established between artifacts',
            ],
    }
  }

  /**
   * Generate Epic Markdown with YAML front matter
   */
  private generateEpicMarkdown(epic: EpicOutput): string {
    const frontMatter = {
      epic_id: epic.epic_id,
      derived_from: epic.derived_from,
      source_markdown: epic.source_markdown,
      generated_at: epic.generated_at
    }

    const markdown = [
      '---',
      ...Object.entries(frontMatter).map(([key, value]) => `${key}: ${value}`),
      '---',
      '',
      `# Epic: ${epic.objective.split('.')[0]}`,
      '',
      '## Objective',
      '',
      epic.objective,
      '',
      '## Success Criteria',
      '',
      ...epic.success_criteria.map(criterion => `- ${criterion}`),
      ''
    ].join('\n')

    return markdown
  }

  /**
   * Write Epic Markdown to file
   */
  private writeEpicMarkdown(epic: EpicOutput, outputPath: string): void {
    const markdown = this.generateEpicMarkdown(epic)
    const dir = path.dirname(outputPath)
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, markdown, 'utf-8')
  }

  /**
   * Derive Epic from governance document with retry logic
   * 
   * @param markdownPath Path to governance Markdown file
   * @param documentId Document ID (from front matter or filename)
   * @returns Epic output with metadata
   */
  async deriveEpic(markdownPath: string, documentId?: string): Promise<EpicOutput> {
    const { content, frontMatter } = this.readGovernanceMarkdown(markdownPath)
    
    // Use document_id from front matter if not provided
    const docId = documentId || frontMatter.document_id || path.basename(markdownPath, '.md')

    let lastError: Error | null = null
    const maxAttempts = 2

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const epic = await this.invokeAgent(content, docId, markdownPath)
        this.validateEpicSchema(epic)

        // Add metadata
        const epicOutput: EpicOutput = {
          ...epic,
          generated_at: new Date().toISOString()
        }

        return epicOutput
      } catch (error) {
        lastError = error as Error
        if (attempt === maxAttempts) {
          throw new AgentValidationError(
            `Epic derivation failed after ${maxAttempts} attempts: ${lastError.message}`
          )
        }
        // Retry once on failure
      }
    }

    throw lastError!
  }

  /**
   * Derive Epic and write to file
   */
  async deriveAndWriteEpic(
    markdownPath: string,
    documentId?: string,
    outputDir: string = 'docs/epics'
  ): Promise<{ epic: EpicOutput; epicPath: string }> {
    const epic = await this.deriveEpic(markdownPath, documentId)
    const epicPath = path.join(outputDir, `${epic.derived_from}-epic.md`)
    
    this.writeEpicMarkdown(epic, epicPath)

    return { epic, epicPath }
  }
}
