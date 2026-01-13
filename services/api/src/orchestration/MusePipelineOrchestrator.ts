import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { DocumentStore, SaveOriginalInput } from '../storage/documentStore'
import { DocumentToMarkdownConverter, MarkdownOutput } from '../conversion/documentToMarkdownConverter'
import { GovernanceMarkdownValidator } from '../conversion/governanceMarkdownValidator'
import { EpicDerivationWorkflow } from '../governance/EpicDerivationWorkflow'
import { FeatureDerivationWorkflow } from '../features/FeatureDerivationWorkflow'
import { FeatureToStoryAgent } from '../stories/FeatureToStoryAgent'
import { getDocumentStore } from '../storage/documentStoreFactory'
import { validateArtifactHierarchy } from '../shared/ArtifactValidation'
import { SectionSplitter } from '../semantic/SectionSplitter'
import { SectionSummaryJob, SectionSummary } from '../semantic/SectionSummaryJob'
import { EpicDerivationJob } from '../semantic/EpicDerivationJob'
import { FeatureDerivationJob } from '../semantic/FeatureDerivationJob'
import { RateLimiter, retryWithBackoff } from '../semantic/RateLimiter'

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
  business_value: string
  description: string
  acceptance_criteria: string[]
  risk_of_not_delivering: string[]
    parent_feature_id?: string
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
  epics: EpicData[] // Changed from single 'epic' to multiple 'epics'
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
   * @param fileBuffer - Buffer of uploaded governance document
   * @param input - Metadata for the original document
   * @returns PipelineOutput - Structured data for UI rendering
   * @throws Error if any step fails, including validation failures
   */
  async executePipeline(
    fileBuffer: Buffer,
    input: SaveOriginalInput
  ): Promise<PipelineOutput> {
    // Step 1: Persist original document (MUSE-002)
    const documentMetadata = await this.documentStore.saveOriginalFromBuffer(fileBuffer, input)

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

    // Step 4+: Derivation stages
    // Choose staged semantic pipeline for large documents; fallback to existing agent workflows for smaller docs
    const useSemanticStages = validationResult.contentLength >= 2000

    let epicsData: EpicData[] = []
    let featuresData: FeatureData[] = []
    let storiesData: StoryData[] = []

    if (useSemanticStages) {
      console.log('[Pipeline] Large document detected. Using staged semantic pipeline...')

      // Section splitting (strip YAML front matter first to avoid polluting section content)
      const splitter = new SectionSplitter(governanceMarkdownPath)
      // Remove YAML front matter: match --- ... --- at start of document, with optional trailing newlines
      const contentWithoutFrontMatter = markdownOutput.content.replace(/^---\n[\s\S]*?\n---\n*/m, '')
      const sections = splitter.split(contentWithoutFrontMatter, documentMetadata.documentId)

      // Token-aware concurrency for summaries (heuristic: ~4 chars per token)
      const avgSectionTokens = Math.max(1, Math.floor(sections.reduce((sum, s) => sum + s.content.length, 0) / Math.max(1, sections.length) / 4))
      const maxConcurrent = Math.min(8, Math.max(1, Math.floor(30000 / Math.max(50, avgSectionTokens * 100))))
      const limiter = new RateLimiter(maxConcurrent)
      const summaryCache = new Map<string, SectionSummary>()
      const summaryJob = new SectionSummaryJob(summaryCache)

      const summaries: SectionSummary[] = []
      for (const sec of sections) {
        const summary = await limiter.run(() => retryWithBackoff(() => summaryJob.run(sec.id, sec.title, sec.content)))
        summaries.push(summary)
      }

      // Epics
      const epicJob = new EpicDerivationJob(documentMetadata.documentId)
      const epics = epicJob.run(summaries)
      // Persist epics for UI consumption via existing loaders
      const epicsDir = path.join(this.repoRoot, 'docs', 'epics')
      await fs.promises.mkdir(epicsDir, { recursive: true })
      const epicsDataFromFiles: EpicData[] = []
      for (let i = 0; i < epics.length; i++) {
        const e = epics[i]
        const epicTitle = `Epic ${String(i + 1).padStart(2, '0')}`
        const epicPath = path.join(epicsDir, `${e.epic_id}.md`)
        await this.writeSemanticEpic(epicPath, {
          epic_id: e.epic_id,
          title: epicTitle,
          objective: e.objective,
          success_criteria: e.success_criteria,
          governance_references: e.source_sections,
        })
        const data = await this.loadEpicData(epicPath)
        epicsDataFromFiles.push(data)
      }
      epicsData = epicsDataFromFiles

      // Features
      const featureJob = new FeatureDerivationJob()
      const features: ReturnType<typeof featureJob.run> = epics.flatMap(epic => featureJob.run(epic, summaries))

      // Build acceptance criteria from section obligations, persist features, then load via existing parser
      const featuresDir = path.join(this.repoRoot, 'docs', 'features')
      await fs.promises.mkdir(featuresDir, { recursive: true })
      const featuresDataFromFiles: FeatureData[] = []
      for (const f of features) {
        const criteria = summaries
          .filter(s => f.source_sections.includes(s.section_id))
          .flatMap(s => s.obligations)
          .slice(0, 10)
        const featurePath = path.join(featuresDir, `${f.feature_id}.md`)
        await this.writeSemanticFeature(featurePath, {
          feature_id: f.feature_id,
          title: f.title,
          description: f.description,
          epic_id: f.epic_id,
          acceptance_criteria: criteria.length ? criteria : [f.title],
          governance_references: f.source_sections,
          parent_feature_id: undefined,
        })
        const data = await this.loadFeatureData(featurePath)
        featuresDataFromFiles.push(...data)
      }
      featuresData = featuresDataFromFiles

      // Stories
      // Derive stories using existing MinIO-based agent for consistent formatting
      const storyAgent = new FeatureToStoryAgent()
      const minioStore = getDocumentStore()
      storiesData = []
      for (const feature of featuresData) {
        // Persisted file path for feature
        const featurePath = path.join(this.repoRoot, 'docs', 'features', `${feature.feature_id}.md`)
        try {
          const stats = await fs.promises.stat(featurePath)
          const featureDoc = await minioStore.saveOriginalFromPath(featurePath, {
            originalFilename: path.basename(featurePath),
            mimeType: 'text/markdown',
            sizeBytes: stats.size,
            projectId: input.projectId || 'project',
          })
          const stories = await storyAgent.deriveStoriesFromDocuments(
            featureDoc.documentId,
            documentMetadata.documentId,
            input.projectId || 'project',
            feature.epic_id,
            minioStore
          )
          for (const story of stories) {
            storiesData.push({
              story_id: story.story_id,
              title: story.title,
              role: story.role,
              capability: story.capability,
              benefit: story.benefit,
              acceptance_criteria: story.acceptance_criteria,
              derived_from_feature: story.derived_from_feature,
              derived_from_epic: story.derived_from_epic,
              governance_references: story.governance_references?.map(ref => typeof ref === 'string' ? ref : ref.document_id) || [],
            })
          }
        } catch (err) {
          console.warn('[Pipeline] Story derivation failed for feature', feature.feature_id, err)
        }
      }

      // Fallback: if MinIO-based story derivation failed, derive basic stories from acceptance criteria
      if (storiesData.length === 0) {
        const toKebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        for (const feature of featuresData) {
          const criteria = feature.acceptance_criteria && feature.acceptance_criteria.length
            ? feature.acceptance_criteria
            : [feature.title]
          for (let i = 0; i < Math.min(5, criteria.length); i++) {
            const nn = String(i + 1).padStart(2, '0')
            const title = criteria[i]
            const story_id = `${feature.feature_id}-story-${nn}-${toKebab(title)}`
            storiesData.push({
              story_id,
              title,
              role: 'user',
              capability: feature.title,
              benefit: 'business value',
              acceptance_criteria: [title],
              derived_from_feature: feature.feature_id,
              derived_from_epic: feature.epic_id,
              governance_references: feature.governance_references,
            })
          }
        }
      }

      console.log(`[Pipeline] Semantic stages complete: ${epicsData.length} epics, ${featuresData.length} features, ${storiesData.length} stories`)
    } else {
      // Existing agent-based workflows (smaller docs)
      console.log('[Pipeline] Validation passed. Proceeding to Epic derivation (agent workflows)...')
      const epicWorkflow = new EpicDerivationWorkflow(this.repoRoot)

      const epicArtifacts = await epicWorkflow.deriveEpicsMulti(
        governanceMarkdownPath,
        undefined,
        { commitToGit: false }
      )

      console.log(`[Pipeline] Derived ${epicArtifacts.length} Epic(s)`) 
      for (const epicArtifact of epicArtifacts) {
        const epicData = await this.loadEpicData(path.join(this.repoRoot, epicArtifact.epic_path))
        epicsData.push(epicData)
      }

      const featureWorkflow = new FeatureDerivationWorkflow(this.repoRoot)
      const allFeatureArtifacts = []

      for (const epicArtifact of epicArtifacts) {
        const featureArtifacts = await featureWorkflow.deriveFeaturesFromEpic(
          epicArtifact.epic_path,
          { governancePath: governanceMarkdownPath }
        )
        allFeatureArtifacts.push(...featureArtifacts)
      }

      for (const featureArtifact of allFeatureArtifacts) {
        const featureData = await this.loadFeatureData(path.join(this.repoRoot, featureArtifact.feature_path))
        featuresData.push(...featureData)
      }

      console.log('[Pipeline] Deriving user stories from features...')
      const storyAgent = new FeatureToStoryAgent()
      const minioStore = getDocumentStore()

      for (const featureArtifact of allFeatureArtifacts) {
        const featurePath = path.join(this.repoRoot, featureArtifact.feature_path)
        
        try {
          const featureStats = await fs.promises.stat(featurePath)
          const featureFilename = path.basename(featurePath)
          
          const featureDoc = await minioStore.saveOriginalFromPath(featurePath, {
            originalFilename: featureFilename,
            mimeType: 'text/markdown',
            sizeBytes: featureStats.size,
            projectId: input.projectId || 'project',
          })

          const stories = await storyAgent.deriveStoriesFromDocuments(
            featureDoc.documentId,
            documentMetadata.documentId,
            input.projectId || 'project',
            featureArtifact.epic_id,
            minioStore
          )

          for (const story of stories) {
            storiesData.push({
              story_id: story.story_id,
              title: story.title,
              role: story.role,
              capability: story.capability,
              benefit: story.benefit,
              acceptance_criteria: story.acceptance_criteria,
              derived_from_feature: story.derived_from_feature,
              derived_from_epic: story.derived_from_epic,
              governance_references: story.governance_references?.map(ref => 
                typeof ref === 'string' ? ref : ref.document_id
              ) || [],
            })
          }

          console.log(`[Pipeline] Generated ${stories.length} stories for feature ${featureArtifact.feature_id}`)
        } catch (error) {
          console.warn(`[Pipeline] Failed to derive stories for feature ${featureArtifact.feature_id}:`, error)
        }
      }

      console.log(`[Pipeline] Total stories generated: ${storiesData.length}`)
    }

    // Step 7: Validate hierarchy (Epics → Features → Stories)
    const hierarchyReport = validateArtifactHierarchy({
      epics: epicsData.map(e => ({ epic_id: e.epic_id, document_id: documentMetadata.documentId })),
      features: featuresData.map(f => ({
        feature_id: f.feature_id,
        derived_from_epic: f.epic_id,
        parent_feature_id: f.parent_feature_id,
      })),
      stories: storiesData.map(s => ({
        story_id: s.story_id,
        derived_from_feature: s.derived_from_feature,
      })),
    })

    if (!hierarchyReport.valid) {
      throw new Error(
        'Hierarchy validation failed:\n' + hierarchyReport.errors.join('\n')
      )
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
      epics: epicsData, // Now returns array of epics
      features: featuresData,
      stories: storiesData,
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
   * Write a semantic Epic markdown artifact to disk (no git commit)
   */
  private async writeSemanticEpic(epicPath: string, epic: {
    epic_id: string
    title: string
    objective: string
    success_criteria: string[]
    governance_references: string[]
  }): Promise<void> {
    const dir = path.dirname(epicPath)
    await fs.promises.mkdir(dir, { recursive: true })

    const frontMatter = `---\nepic_id: ${epic.epic_id}\nderived_artifact: epic_markdown\n---\n`
    const body = `# Epic: ${epic.title}\n\n## Objective\n${epic.objective}\n\n## Success Criteria\n${epic.success_criteria.map(s => `- ${s}`).join('\n')}\n\n## Governance References\n${epic.governance_references.map(r => `- ${r}`).join('\n')}\n`
    await fs.promises.writeFile(epicPath, frontMatter + '\n' + body, 'utf-8')
  }

  /**
   * Write a semantic Feature markdown artifact to disk (no git commit)
   */
  private async writeSemanticFeature(featurePath: string, feature: {
    feature_id: string
    title: string
    description: string
    epic_id: string
    acceptance_criteria: string[]
    governance_references: string[]
    parent_feature_id?: string
  }): Promise<void> {
    const dir = path.dirname(featurePath)
    await fs.promises.mkdir(dir, { recursive: true })

    const fmLines = [
      `feature_id: ${feature.feature_id}`,
      `epic_id: ${feature.epic_id}`,
      feature.parent_feature_id ? `parent_feature_id: ${feature.parent_feature_id}` : undefined,
      'derived_artifact: feature_markdown',
    ].filter(Boolean).join('\n')
    const frontMatter = `---\n${fmLines}\n---\n`
    const body = `# Feature: ${feature.title}\n\n## Description\n${feature.description}\n\n## Acceptance Criteria\n${feature.acceptance_criteria.map(s => `- ${s}`).join('\n')}\n\n## Governance References\n${feature.governance_references.map(r => `- ${r}`).join('\n')}\n`
    await fs.promises.writeFile(featurePath, frontMatter + '\n' + body, 'utf-8')
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

    const frontMatter = YAML.parse(frontMatterMatch[1])

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

    const frontMatter = YAML.parse(frontMatterMatch[1])

    const features: FeatureData[] = []
    const lines = content.split('\n')

    let currentFeature: Partial<FeatureData> | null = null
    let inDescription = false
    let inCriteria = false
    let inRisks = false
    let inGovernanceRefs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('# Feature:')) {
        if (currentFeature && currentFeature.feature_id) {
          features.push(currentFeature as FeatureData)
        }

        const title = line.replace('# Feature:', '').trim()
        // Use feature_id from front matter if available, otherwise extract from title or generate
        const featureId = frontMatter.feature_id || 
          (title.match(/\(([^)]+)\)/) ? title.match(/\(([^)]+)\)/)?.[1] : undefined) ||
          `feature-${features.length + 1}`

        currentFeature = {
          feature_id: featureId,
          title: title.replace(/\([^)]+\)/, '').trim(),
          business_value: '',
          description: '',
          acceptance_criteria: [],
          risk_of_not_delivering: [],
          epic_id: frontMatter.derived_from_epic || frontMatter.epic_id,
          governance_references: [],
          parent_feature_id: frontMatter.parent_feature_id,
        }

        inDescription = false
        inCriteria = false
        inRisks = false
        inGovernanceRefs = false
      } else if (line.startsWith('## Business Value')) {
        inDescription = false
        inCriteria = false
        inGovernanceRefs = false
        // Next line contains business value
        if (i + 1 < lines.length && lines[i + 1].trim()) {
          currentFeature!.business_value = lines[i + 1].trim()
        }
      } else if (line.startsWith('## Description')) {
        inDescription = true
        inCriteria = false
        inRisks = false
        inGovernanceRefs = false
      } else if (line.startsWith('## Acceptance Criteria')) {
        inDescription = false
        inCriteria = true
        inRisks = false
        inGovernanceRefs = false
      } else if (line.startsWith('## Risk of Not Delivering')) {
        inDescription = false
        inCriteria = false
        inRisks = true
        inGovernanceRefs = false
      } else if (line.startsWith('## Governance References')) {
        inDescription = false
        inCriteria = false
        inRisks = false
        inGovernanceRefs = true
      } else if (line.startsWith('##')) {
        inDescription = false
        inCriteria = false
        inRisks = false
        inGovernanceRefs = false
      } else if (currentFeature) {
        if (inDescription && line.trim() && !line.startsWith('##')) {
          currentFeature.description = (currentFeature.description || '') + line.trim() + ' '
        } else if (inCriteria && line.startsWith('- ')) {
          currentFeature.acceptance_criteria!.push(line.replace('- ', '').trim())
        } else if (inRisks && line.startsWith('- ')) {
          currentFeature.risk_of_not_delivering!.push(line.replace('- ', '').trim())
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

}
