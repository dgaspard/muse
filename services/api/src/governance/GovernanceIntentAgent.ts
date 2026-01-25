import matter from 'gray-matter'
import * as fs from 'fs'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import YAML from 'yaml'

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
 * Epic boundary identified by AI analysis
 */
export interface EpicBoundary {
  title: string
  startLine?: number
  endLine?: number
  contentPreview: string
  rationale: string
}

/**
 * Multi-Epic analysis result
 */
export interface MultiEpicAnalysis {
  shouldSplit: boolean
  suggestedEpics: EpicBoundary[]
  reasoning: string
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

  constructor(private options: { multiEpicThreshold?: number; maxEpicsPerDocument?: number } = {}) {
    // Initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })
    }
    // Default: documents > 10,000 chars should be analyzed for multiple Epics
    this.options.multiEpicThreshold = options.multiEpicThreshold ?? 10000
    // Default: max 10 Epics per document
    this.options.maxEpicsPerDocument = options.maxEpicsPerDocument ?? 10
  }

  /**
   * Retry helper with exponential backoff for rate limit errors
   * @param fn Function to retry
   * @param maxRetries Maximum number of retry attempts
   * @param baseDelay Initial delay in milliseconds (doubles on each retry)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const isRateLimit = errorMessage.includes('rate_limit_error') || errorMessage.includes('RateLimitError')
        
        if (!isRateLimit || attempt === maxRetries) {
          throw error
        }
        
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`[GovernanceIntentAgent] Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    throw new Error('Retry logic failed unexpectedly')
  }

  /**
   * Read and parse governance Markdown
   */
  private readGovernanceMarkdown(markdownPath: string): { content: string; frontMatter: Record<string, unknown> } {
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
  private validateEpicSchema(epic: unknown): asserts epic is EpicSchema {
    if (typeof epic !== 'object' || epic === null) {
      throw new AgentValidationError('Epic must be an object')
    }

    const errors: string[] = []
    const e = epic as Record<string, unknown>

    if (!e.epic_id || typeof e.epic_id !== 'string') {
      errors.push('Missing or invalid epic_id')
    }

    if (!e.derived_from || typeof e.derived_from !== 'string') {
      errors.push('Missing or invalid derived_from')
    }

    if (!e.source_markdown || typeof e.source_markdown !== 'string') {
      errors.push('Missing or invalid source_markdown')
    }

    if (!e.objective || typeof e.objective !== 'string') {
      errors.push('Missing or invalid objective')
    }

    if (!Array.isArray(e.success_criteria) || e.success_criteria.length === 0) {
      errors.push('Missing or invalid success_criteria (must be non-empty array)')
    }

    if (e.success_criteria && !Array.isArray(e.success_criteria)) {
      errors.push('success_criteria must be an array')
    } else if (Array.isArray(e.success_criteria) && !e.success_criteria.every((c: unknown) => typeof c === 'string')) {
      errors.push('All success_criteria must be strings')
    }

    // No additional fields allowed
    const allowedFields = ['epic_id', 'derived_from', 'source_markdown', 'objective', 'success_criteria']
    const extraFields = Object.keys(e).filter(key => !allowedFields.includes(key))
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
      // Wrap Anthropic API call with retry logic for rate limits
      const response = await this.retryWithBackoff(async () => {
        return await this.anthropic!.messages.create({
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
      }, 3, 2000)

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new AgentValidationError('Agent returned non-text response')
      }

      // Extract YAML from code block if present
      const yamlMatch = content.text.match(/```(?:yaml)?\n([\s\S]+?)\n```/)
      const yamlText = yamlMatch ? yamlMatch[1] : content.text

      // Parse YAML response
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
      
      // Check if this is a rate limit error that should be retried
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('rate_limit_error') || errorMessage.includes('RateLimitError')) {
        console.warn('[GovernanceIntentAgent] Rate limit hit during Epic derivation')
        console.warn('[GovernanceIntentAgent] Consider implementing retry logic or reducing document size')
        // For now, fall back to rule-based - caller can implement retry at higher level
      } else {
        console.error('[GovernanceIntentAgent] AI derivation failed:', error)
      }
      
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
    const fmObj = frontMatter as Record<string, unknown>
    const docId = documentId || (typeof fmObj.document_id === 'string' ? fmObj.document_id : null) || path.basename(markdownPath, '.md')

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
    outputDir: string = 'tmp/epics'
  ): Promise<{ epic: EpicOutput; epicPath: string }> {
    const epic = await this.deriveEpic(markdownPath, documentId)
    const epicPath = path.join(outputDir, `${epic.derived_from}-epic.md`)
    
    this.writeEpicMarkdown(epic, epicPath)

    return { epic, epicPath }
  }

  /**
   * Analyze governance document to identify multiple Epic boundaries
   * Uses AI to intelligently split large documents into logical Epics
   */
  async analyzeEpicBoundaries(governanceContent: string, documentId: string): Promise<MultiEpicAnalysis> {
    if (!this.anthropic) {
      // No AI available - return single Epic recommendation
      return {
        shouldSplit: false,
        suggestedEpics: [],
        reasoning: 'AI analysis not available - will generate single Epic'
      }
    }

    // Check if document is large enough to warrant splitting
    if (governanceContent.length < this.options.multiEpicThreshold!) {
      return {
        shouldSplit: false,
        suggestedEpics: [],
        reasoning: `Document size (${governanceContent.length} chars) below threshold (${this.options.multiEpicThreshold} chars)`
      }
    }

    const systemPrompt = `You are a governance document analyzer for the Muse platform.

Your task is to analyze a governance document and determine if it should be split into MULTIPLE EPICs.

An Epic represents a distinct, high-level business or governance outcome. Large governance documents
often contain multiple independent areas of governance that should be treated as separate Epics.

## ANALYSIS CRITERIA

Consider splitting into multiple Epics if the document:
1. Covers multiple distinct regulatory domains or policy areas
2. Has clear chapter/section boundaries for different governance topics
3. Contains requirements for different business capabilities or systems
4. Addresses multiple independent compliance frameworks or standards
5. Is very long (> ${this.options.multiEpicThreshold} characters) with diverse content

## DO NOT SPLIT if:
- The document describes a single cohesive policy or regulation
- All sections relate to the same governance outcome
- Splitting would create artificial boundaries

## OUTPUT FORMAT

Respond with ONLY valid JSON in this structure:

\`\`\`json
{
  "shouldSplit": true/false,
  "reasoning": "<brief explanation>",
  "suggestedEpics": [
    {
      "title": "<Epic title>",
      "contentPreview": "<first 200 chars of relevant section>",
      "rationale": "<why this is a distinct Epic>"
    }
  ]
}
\`\`\`

Limit to ${this.options.maxEpicsPerDocument} Epics maximum.`

    const userPrompt = `Analyze this governance document and determine if it should be split into multiple Epics:

Document ID: ${documentId}
Document Length: ${governanceContent.length} characters

--- DOCUMENT CONTENT (first 15000 chars) ---
${governanceContent.substring(0, 15000)}
${governanceContent.length > 15000 ? '\n\n[... content truncated for analysis ...]' : ''}
--- END DOCUMENT ---`

    try {
      // Wrap Anthropic API call with retry logic for rate limits
      const response = await this.retryWithBackoff(async () => {
        return await this.anthropic!.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
      }, 3, 2000)

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('AI returned non-text response')
      }

      // Extract JSON from code block if present
      const jsonMatch = content.text.match(/```(?:json)?\n([\s\S]+?)\n```/)
      const jsonText = jsonMatch ? jsonMatch[1] : content.text

      const analysis = JSON.parse(jsonText) as MultiEpicAnalysis

      console.log(`[GovernanceIntentAgent] Epic boundary analysis: shouldSplit=${analysis.shouldSplit}, suggested=${analysis.suggestedEpics?.length || 0} Epics`)

      return analysis
    } catch (error) {
      console.error('[GovernanceIntentAgent] Epic boundary analysis failed:', error)
      // Fallback to single Epic
      return {
        shouldSplit: false,
        suggestedEpics: [],
        reasoning: `Analysis failed: ${(error as Error).message}`
      }
    }
  }

  /**
   * Derive multiple Epics from a governance document by intelligently splitting it
   * Uses AI analysis to identify natural Epic boundaries
   */
  async deriveMultipleEpics(markdownPath: string, documentId?: string): Promise<EpicOutput[]> {
    const { content, frontMatter } = this.readGovernanceMarkdown(markdownPath)
    
    // Use document_id from front matter if not provided
    const fmObj = frontMatter as Record<string, unknown>
    const docId = documentId || (typeof fmObj.document_id === 'string' ? fmObj.document_id : null) || path.basename(markdownPath, '.md')

    // First, analyze if we should split into multiple Epics
    const analysis = await this.analyzeEpicBoundaries(content, docId)

    if (!analysis.shouldSplit || analysis.suggestedEpics.length === 0) {
      // Generate single Epic
      console.log(`[GovernanceIntentAgent] Generating single Epic: ${analysis.reasoning}`)
      const singleEpic = await this.deriveEpic(markdownPath, docId)
      return [singleEpic]
    }

    console.log(`[GovernanceIntentAgent] Generating ${analysis.suggestedEpics.length} Epics from document`)

    // For each suggested Epic boundary, derive an Epic
    const epics: EpicOutput[] = []
    
    for (let i = 0; i < analysis.suggestedEpics.length; i++) {
      const boundary = analysis.suggestedEpics[i]
      const epicNumber = String(i + 1).padStart(2, '0')
      const epicId = `epic-${docId.substring(0, 8)}-${epicNumber}`

      try {
        // Create focused prompt for this specific Epic
        const focusedPrompt = `You are deriving Epic #${i + 1} of ${analysis.suggestedEpics.length} from a governance document.

Focus area: ${boundary.title}
Rationale: ${boundary.rationale}

Derive a SINGLE Epic that captures the governance intent for THIS SPECIFIC AREA ONLY.

## OUTPUT FORMAT (STRICT)

You MUST output ONLY valid YAML in this exact structure:

\`\`\`yaml
epic:
  epic_id: ${epicId}
  objective: <string - specific to "${boundary.title}">
  success_criteria:
    - <string>
    - <string>
    - <string>
  derived_from: ${docId}
\`\`\`

No prose. No explanations. Only YAML.`

        const response = await this.retryWithBackoff(async () => {
          return await this.anthropic!.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            temperature: 0,
            system: focusedPrompt,
            messages: [
              {
                role: 'user',
                content: `Governance document content:\n\n${content}\n\nExtract Epic for: ${boundary.title}`,
              },
            ],
          })
        }, 3, 2000)

        const responseContent = response.content[0]
        if (responseContent.type !== 'text') {
          throw new Error('AI returned non-text response')
        }

        // Extract YAML from code block if present
        const yamlMatch = responseContent.text.match(/```(?:yaml)?\n([\s\S]+?)\n```/)
        const yamlText = yamlMatch ? yamlMatch[1] : responseContent.text

        // Parse YAML response
        const parsed = YAML.parse(yamlText)

        if (!parsed || !parsed.epic) {
          throw new Error('AI response missing epic structure')
        }

        const epic: EpicSchema = {
          epic_id: parsed.epic.epic_id || epicId,
          derived_from: parsed.epic.derived_from || docId,
          source_markdown: markdownPath,
          objective: parsed.epic.objective,
          success_criteria: parsed.epic.success_criteria,
        }

        this.validateEpicSchema(epic)

        const epicOutput: EpicOutput = {
          ...epic,
          generated_at: new Date().toISOString()
        }

        epics.push(epicOutput)
        console.log(`[GovernanceIntentAgent] ✓ Epic ${i + 1}/${analysis.suggestedEpics.length} generated: ${epic.epic_id}`)
      } catch (error) {
        console.error(`[GovernanceIntentAgent] Failed to generate Epic ${i + 1}:`, error)
        // Continue with remaining Epics
      }
    }

    if (epics.length === 0) {
      // Fallback: generate single Epic if all multi-Epic attempts failed
      console.warn('[GovernanceIntentAgent] Multi-Epic generation failed, falling back to single Epic')
      const singleEpic = await this.deriveEpic(markdownPath, docId)
      return [singleEpic]
    }

    return epics
  }

  /**
   * Derive multiple Epics and write to files
   */
  async deriveAndWriteMultipleEpics(
    markdownPath: string,
    documentId?: string,
    outputDir: string = 'tmp/epics'
  ): Promise<Array<{ epic: EpicOutput; epicPath: string }>> {
    const epics = await this.deriveMultipleEpics(markdownPath, documentId)
    
    const results: Array<{ epic: EpicOutput; epicPath: string }> = []
    
    for (const epic of epics) {
      const epicPath = path.join(outputDir, `${epic.epic_id}.md`)
      this.writeEpicMarkdown(epic, epicPath)
      results.push({ epic, epicPath })
    }

    return results
  }
}
