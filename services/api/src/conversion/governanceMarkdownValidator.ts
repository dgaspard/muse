/**
 * Validation module for governance Markdown content.
 * Ensures that extracted content meets minimum quality standards
 * before agent execution.
 */

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean
  /** List of validation errors (empty if valid) */
  errors: ValidationError[]
  /** Character count of the content */
  contentLength: number
  /** Number of section headings found */
  headingCount: number
}

/**
 * Individual validation error
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string
  /** Human-readable error message */
  message: string
  /** Optional suggestion for remediation */
  suggestion?: string
}

/**
 * Configuration for governance markdown validation
 */
export interface ValidationConfig {
  /** Minimum character count for content to be considered complete */
  minContentLength: number
  /** List of placeholder markers that indicate incomplete extraction */
  placeholderMarkers: string[]
}

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: ValidationConfig = {
  minContentLength: 500,
  placeholderMarkers: [
    'full text extraction not yet implemented',
    'placeholder',
    '[pdf extracted from',
    'business logic will be implemented',
    'not implemented',
    'tbd',
    'todo',
  ],
}

/**
 * GovernanceMarkdownValidator - Validates governance Markdown before agent execution
 */
export class GovernanceMarkdownValidator {
  private config: ValidationConfig

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Validate governance Markdown content
   *
   * @param content - Markdown content to validate
   * @returns ValidationResult with detailed feedback
   */
  validate(content: string): ValidationResult {
    const errors: ValidationError[] = []

    // Extract just the body content (remove YAML front matter)
    const bodyContent = this.extractBodyContent(content)
    const contentLength = bodyContent.length
    const headingCount = this.countHeadings(bodyContent)

    // Check 1: Minimum content length
    if (contentLength < this.config.minContentLength) {
      errors.push({
        code: 'INSUFFICIENT_CONTENT',
        message: `Content is too short (${contentLength} characters). Minimum required: ${this.config.minContentLength} characters.`,
        suggestion:
          'Ensure the uploaded governance document contains substantial policy text. Empty or minimal documents cannot be processed.',
      })
    }

    // Check 2: Placeholder marker detection
    const detectedPlaceholders = this.detectPlaceholders(bodyContent)
    if (detectedPlaceholders.length > 0) {
      errors.push({
        code: 'PLACEHOLDER_DETECTED',
        message: `Content appears to be incomplete. Found placeholder markers: ${detectedPlaceholders.map((p) => `"${p}"`).join(', ')}`,
        suggestion:
          'The PDF extraction may have failed. Please try uploading a different PDF or verify the document is not image-based.',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      contentLength,
      headingCount,
    }
  }

  /**
   * Extract body content (remove YAML front matter)
   */
  private extractBodyContent(content: string): string {
    const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)
    return frontMatterMatch ? frontMatterMatch[2] : content
  }

  /**
   * Count section headings in markdown
   */
  private countHeadings(content: string): number {
    const headingRegex = /^#+\s+/gm
    const matches = content.match(headingRegex)
    return matches ? matches.length : 0
  }

  /**
   * Detect placeholder markers in content
   */
  private detectPlaceholders(content: string): string[] {
    const lowerContent = content.toLowerCase()
    return this.config.placeholderMarkers.filter(
      (marker) => lowerContent.indexOf(marker.toLowerCase()) !== -1
    )
  }

  /**
   * Get a summary of validation results for logging/debugging
   */
  getValidationSummary(result: ValidationResult): string {
    const status = result.isValid ? '✓ VALID' : '✗ INVALID'
    const lines = [
      `${status} - Governance Content Validation`,
      `Content length: ${result.contentLength} characters`,
      `Section headings: ${result.headingCount}`,
    ]

    if (!result.isValid) {
      lines.push(`Errors: ${result.errors.length}`)
      result.errors.forEach((err) => {
        lines.push(`  - [${err.code}] ${err.message}`)
      })
    }

    return lines.join('\n')
  }
}
