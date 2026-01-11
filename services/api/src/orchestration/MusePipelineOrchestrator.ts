import fs from 'fs'
import path from 'path'
import { DocumentStore, SaveOriginalInput } from '../storage/documentStore'
import { DocumentToMarkdownConverter, MarkdownOutput } from '../conversion/documentToMarkdownConverter'
import { GovernanceMarkdownValidator } from '../conversion/governanceMarkdownValidator'
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow'
import { FeatureDerivationWorkflow } from '../features/FeatureDerivationWorkflow'
import { StoryDerivationWorkflow } from '../stories/StoryDerivationWorkflow'

/**
 * Epic data structure returned by the pipeline
 */
export interface EpicData {
  epic_id: string
  title: string
  objective: string
  success_criteria: string[]
  governance_references: string[]
}

/**
 * Feature data structure returned by the pipeline
 */
export interface FeatureData {
  feature_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  epic_id: string
  governance_references: string[]
}

/**
 * User Story data structure returned by the pipeline
 */
export interface StoryData {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  acceptance_criteria: string[]
  derived_from_feature: string
  derived_from_epic: string
  governance_references: string[]
}

/**
 * Complete pipeline output
 */
export interface PipelineOutput {
  document: {
    document_id: string
    original_filename: string
  }
  markdown: {
    content: string
    path: string
  }
  validation: {
    isValid: boolean
    contentLength: number
    headingCount: number
    errors: Array<{ code: string; message: string; suggestion?: string }>
  }
  epic: EpicData
  features: FeatureData[]
  stories: StoryData[]
}

/**
 * MusePipelineOrchestrator — Coordinates the full Muse governance-to-delivery pipeline
 * 
 * Pipeline steps:
 * 1. Upload governance document (persist original)
 * 2. Convert document to governance Markdown
 * 3. Validate governance Markdown completeness (NEW - MUSE-QA-002)
 * 4. Derive Epic from Markdown (MUSE-005) - blocked if validation fails
 * 5. Derive Features from Epic (MUSE-006) - blocked if validation fails
 * 6. Derive User Stories from Features (MUSE-007) - blocked if validation fails
 * 7. Return structured output for UI rendering
 * 
 * Constraints:
 * - Sequential execution (fail fast)
 * - No Git commits (review-first experience)
 * - Reuses existing agents and workflows
 * - Deterministic and low-temperature
 * - VALIDATION GATING: Agents never run on incomplete or placeholder content
 */
export class MusePipelineOrchestrator {
  private documentStore: DocumentStore
  private converter: DocumentToMarkdownConverter
  private validator: GovernanceMarkdownValidator
  private repoRoot: string

  constructor(
    documentStore: DocumentStore,
    converter: DocumentToMarkdownConverter,
    repoRoot: string = process.cwd(),
    validator?: GovernanceMarkdownValidator
  ) {
    this.documentStore = documentStore
    this.converter = converter
    this.validator = validator || new GovernanceMarkdownValidator()
    this.repoRoot = repoRoot
  }

  /**
   * Execute the full pipeline from uploaded file to derived artifacts
   * 
   * @param filePath - Path to uploaded governance document
   * @param input - Metadata for the original document
   * @returns PipelineOutput - Structured data for UI rendering
   * @throws Error if any step fails, including validation failures
   */
  async executePipeline(
    filePath: string,
    input: SaveOriginalInput
  ): Promise<PipelineOutput> {
    // Step 1: Persist original document (MUSE-002)
    const documentMetadata = await this.documentStore.saveOriginalFromPath(filePath, input)

    // Step 2: Convert to governance Markdown (MUSE-003)
    const { stream } = await this.documentStore.getOriginal(documentMetadata.documentId)
    const markdownOutput = await this.converter.convert(stream, documentMetadata.mimeType, {
      documentId: documentMetadata.documentId,
      checksumSha256: documentMetadata.checksumSha256,
      originalFilename: documentMetadata.originalFilename,
    })

    // Write governance markdown to file
    const governanceMarkdownPath = await this.writeGovernanceMarkdown(markdownOutput)

    // Step 3: Validate governance Markdown completeness (MUSE-QA-002)
    // This is a GATING STEP - agents do not run if validation fails
    const validationResult = this.validator.validate(markdownOutput.content)
    
    console.log('[Pipeline] Governance Markdown Validation:')
    console.log(this.validator.getValidationSummary(validationResult))

    if (!validationResult.isValid) {
      // Validation failed - block agent execution
      const errorMessages = validationResult.errors
        .map((e) => `${e.code}: ${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`)
        .join('\n')
      
      throw new Error(
        `Governance content validation failed. Pipeline blocked at agent gating.\n${errorMessages}`
      )
    }

    // Step 4: Derive Epic (MUSE-005) - only runs if validation passes
    console.log('[Pipeline] Validation passed. Proceeding to Epic derivation...')
    const epicWorkflow = new EpicDerivationWorkflow(this.repoRoot)
    const epicArtifact = await epicWorkflow.deriveEpic(
      governanceMarkdownPath,
      undefined, // Document ID read from front matter
      { commitToGit: false } // No Git commit
    )
    const epicData = await this.loadEpicData(path.join(this.repoRoot, epicArtifact.epic_path))

    // Step 5: Derive Features from Epic (MUSE-006)
    const featureWorkflow = new FeatureDerivationWorkflow(this.repoRoot)
    const featureArtifacts = await featureWorkflow.deriveFeaturesFromEpic(
      epicArtifact.epic_path
    )

    const featuresData: FeatureData[] = []
    for (const featureArtifact of featureArtifacts) {
      const featureData = await this.loadFeatureData(path.join(this.repoRoot, featureArtifact.feature_path))
      featuresData.push(...featureData)
    }

    // Step 6: Derive User Stories from Features (MUSE-007)
    const storyWorkflow = new StoryDerivationWorkflow(this.repoRoot)
    const allStories: StoryData[] = []

    for (const featureArtifact of featureArtifacts) {
      const storyArtifacts = await storyWorkflow.deriveStoriesFromFeatures(
        featureArtifact.feature_path,
        governanceMarkdownPath
      )

      for (const storyArtifact of storyArtifacts) {
        const storyData = await this.loadStoryData(path.join(this.repoRoot, storyArtifact.story_path))
        allStories.push(storyData)
      }
    }

    // Return structured output with validation status
    return {
      document: {
        document_id: documentMetadata.documentId,
        original_filename: documentMetadata.originalFilename,
      },
      markdown: {
        content: markdownOutput.content,
        path: governanceMarkdownPath,
      },
      validation: {
        isValid: validationResult.isValid,
        contentLength: validationResult.contentLength,
        headingCount: validationResult.headingCount,
        errors: validationResult.errors,
      },
      epic: epicData,
      features: featuresData,
      stories: allStories,
    }
  }

  /**
   * Write governance markdown to file system
   */
  private async writeGovernanceMarkdown(markdownOutput: MarkdownOutput): Promise<string> {
    const governanceDir = path.join(this.repoRoot, 'docs', 'governance')
    if (!fs.existsSync(governanceDir)) {
      fs.mkdirSync(governanceDir, { recursive: true })
    }

    const markdownPath = path.join(governanceDir, markdownOutput.suggestedFilename)
    await fs.promises.writeFile(markdownPath, markdownOutput.content, 'utf-8')

    return markdownPath
  }

  /**
   * Load Epic data from markdown file
   */
  private async loadEpicData(epicPath: string): Promise<EpicData> {
    const content = await fs.promises.readFile(epicPath, 'utf-8')
    
    // Parse YAML front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---/)
    if (!frontMatterMatch) {
      throw new Error('Invalid epic markdown: missing front matter')
    }

    const yaml = require('yaml')
    const frontMatter = yaml.parse(frontMatterMatch[1])

    // Extract epic data from content
    const lines = content.split('\n')
    let title = ''
    let objective = ''
    const successCriteria: string[] = []
    const governanceReferences: string[] = []

    let inSuccessCriteria = false
    let inGovernanceRefs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('# Epic:')) {
        title = line.replace('# Epic:', '').trim()
      } else if (line.startsWith('## Objective')) {
        objective = lines[i + 1]?.trim() || ''
      } else if (line.startsWith('## Success Criteria')) {
        inSuccessCriteria = true
        inGovernanceRefs = false
      } else if (line.startsWith('## Governance References')) {
        inSuccessCriteria = false
        inGovernanceRefs = true
      } else if (line.startsWith('##')) {
        inSuccessCriteria = false
        inGovernanceRefs = false
      } else if (inSuccessCriteria && line.startsWith('- ')) {
        successCriteria.push(line.replace('- ', '').trim())
      } else if (inGovernanceRefs && line.startsWith('- ')) {
        governanceReferences.push(line.replace('- ', '').trim())
      }
    }

    return {
      epic_id: frontMatter.epic_id,
      title,
      objective,
      success_criteria: successCriteria,
      governance_references: governanceReferences,
    }
  }

  /**
   * Load Feature data from markdown file
   */
  private async loadFeatureData(featurePath: string): Promise<FeatureData[]> {
    const content = await fs.promises.readFile(featurePath, 'utf-8')
    
    // Parse YAML front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---/)
    if (!frontMatterMatch) {
      throw new Error('Invalid feature markdown: missing front matter')
    }

    const yaml = require('yaml')
    const frontMatter = yaml.parse(frontMatterMatch[1])

    const features: FeatureData[] = []
    const lines = content.split('\n')

    let currentFeature: Partial<FeatureData> | null = null
    let inDescription = false
    let inCriteria = false
    let inGovernanceRefs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('# Feature:')) {
        if (currentFeature && currentFeature.feature_id) {
          features.push(currentFeature as FeatureData)
        }

        const title = line.replace('# Feature:', '').trim()
        const featureIdMatch = title.match(/\(([^)]+)\)/)
        const featureId = featureIdMatch ? featureIdMatch[1] : `feature-${features.length + 1}`

        currentFeature = {
          feature_id: featureId,
          title: title.replace(/\([^)]+\)/, '').trim(),
          description: '',
          acceptance_criteria: [],
          epic_id: frontMatter.derived_from_epic || frontMatter.epic_id,
          governance_references: [],
        }

        inDescription = false
        inCriteria = false
        inGovernanceRefs = false
      } else if (line.startsWith('## Description')) {
        inDescription = true
        inCriteria = false
        inGovernanceRefs = false
      } else if (line.startsWith('## Acceptance Criteria')) {
        inDescription = false
        inCriteria = true
        inGovernanceRefs = false
      } else if (line.startsWith('## Governance References')) {
        inDescription = false
        inCriteria = false
        inGovernanceRefs = true
      } else if (line.startsWith('##')) {
        inDescription = false
        inCriteria = false
        inGovernanceRefs = false
      } else if (currentFeature) {
        if (inDescription && line.trim() && !line.startsWith('##')) {
          currentFeature.description = (currentFeature.description || '') + line.trim() + ' '
        } else if (inCriteria && line.startsWith('- ')) {
          currentFeature.acceptance_criteria!.push(line.replace('- ', '').trim())
        } else if (inGovernanceRefs && line.startsWith('- ')) {
          currentFeature.governance_references!.push(line.replace('- ', '').trim())
        }
      }
    }

    if (currentFeature && currentFeature.feature_id) {
      features.push(currentFeature as FeatureData)
    }

    return features
  }

  /**
   * Load Story data from markdown file
   */
  private async loadStoryData(storyPath: string): Promise<StoryData> {
    const content = await fs.promises.readFile(storyPath, 'utf-8')
    
    // Parse YAML front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---/)
    if (!frontMatterMatch) {
      throw new Error('Invalid story markdown: missing front matter')
    }

    const yaml = require('yaml')
    const frontMatter = yaml.parse(frontMatterMatch[1])

    const lines = content.split('\n')
    let title = ''
    let role = ''
    let capability = ''
    let benefit = ''
    const acceptanceCriteria: string[] = []
    const governanceReferences: string[] = []

    let inStory = false
    let inCriteria = false
    let inGovernanceRefs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('## User Story:')) {
        title = line.replace('## User Story:', '').trim()
        inStory = true  // Start parsing story details
        inCriteria = false
        inGovernanceRefs = false
      } else if (line.startsWith('### Acceptance Criteria')) {
        inStory = false
        inCriteria = true
        inGovernanceRefs = false
      } else if (line.startsWith('### Governance References')) {
        inStory = false
        inCriteria = false
        inGovernanceRefs = true
      } else if (line.startsWith('##')) {
        // Another story section - don't reset inStory yet
        if (!line.startsWith('## User Story:')) {
          inStory = false
        }
        inCriteria = false
        inGovernanceRefs = false
      } else if (inStory) {
        if (line.startsWith('**As a**')) {
          role = line.replace('**As a**', '').replace(/,?\s*$/, '').trim()
        } else if (line.startsWith('**I want**')) {
          capability = line.replace('**I want**', '').replace(/,?\s*$/, '').trim()
        } else if (line.startsWith('**So that**')) {
          benefit = line.replace('**So that**', '').replace(/\.\s*$/, '').trim()
        }
      } else if (inCriteria && line.startsWith('- ')) {
        acceptanceCriteria.push(line.replace('- ', '').trim())
      } else if (inGovernanceRefs && line.startsWith('- ')) {
        governanceReferences.push(line.replace('- ', '').trim())
      }
    }

    return {
      story_id: frontMatter.story_id,
      title,
      role,
      capability,
      benefit,
      acceptance_criteria: acceptanceCriteria,
      derived_from_feature: frontMatter.derived_from_feature,
      derived_from_epic: frontMatter.derived_from_epic,
      governance_references: governanceReferences,
    }
  }
}
