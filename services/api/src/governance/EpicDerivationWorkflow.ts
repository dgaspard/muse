import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { GovernanceIntentAgent } from './GovernanceIntentAgent'
import { GovernanceCommitService } from './GovernanceCommitService'

/**
 * Epic artifact record in muse.yaml
 */
export interface EpicArtifact {
  epic_id: string
  derived_from: string
  source_markdown: string
  epic_path: string
  generated_at: string
}

/**
 * Structure of muse.yaml
 */
interface MuseYaml {
  artifacts?: {
    governance_markdown?: any[]
    epics?: EpicArtifact[]
  }
}

/**
 * EpicDerivationWorkflow — Orchestrates Epic generation from governance documents
 * 
 * Workflow steps:
 * 1. Load governance Markdown
 * 2. Invoke GovernanceIntentAgent
 * 3. Validate output
 * 4. Write Epic Markdown
 * 5. Register artifact in muse.yaml
 * 6. Optionally commit to Git
 */
export class EpicDerivationWorkflow {
  private agent: GovernanceIntentAgent
  private gitService: GovernanceCommitService | null
  private repoRoot: string

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot
    this.agent = new GovernanceIntentAgent()
    
    try {
      this.gitService = new GovernanceCommitService(repoRoot)
    } catch {
      // Git service optional if not in a Git repo
      this.gitService = null
    }
  }

  /**
   * Get muse.yaml path
   */
  private getMuseYamlPath(): string {
    return path.join(this.repoRoot, 'muse.yaml')
  }

  /**
   * Load existing muse.yaml or create new structure
   */
  private loadMuseYaml(): MuseYaml {
    const yamlPath = this.getMuseYamlPath()
    
    if (!fs.existsSync(yamlPath)) {
      return { artifacts: { epics: [] } }
    }

    const content = fs.readFileSync(yamlPath, 'utf-8')
    const data = YAML.parse(content) as MuseYaml
    
    if (!data.artifacts) {
      data.artifacts = {}
    }
    if (!data.artifacts.epics) {
      data.artifacts.epics = []
    }

    return data
  }

  /**
   * Update muse.yaml with Epic artifact
   */
  private updateMuseYaml(epicArtifact: EpicArtifact): void {
    const data = this.loadMuseYaml()
    
    // Remove existing entry for same derived_from if it exists
    if (data.artifacts?.epics) {
      data.artifacts.epics = data.artifacts.epics.filter(
        e => e.derived_from !== epicArtifact.derived_from
      )
      
      // Add new artifact
      data.artifacts.epics.push(epicArtifact)
    }

    // Write back to file
    const yamlPath = this.getMuseYamlPath()
    const yamlContent = YAML.stringify(data, { indent: 2 })
    fs.writeFileSync(yamlPath, yamlContent, 'utf-8')
  }

  /**
   * Get Epic artifact metadata from muse.yaml
   */
  getEpicMetadata(documentId: string): EpicArtifact | null {
    const data = this.loadMuseYaml()
    
    if (!data.artifacts?.epics) {
      return null
    }

    return data.artifacts.epics.find(e => e.derived_from === documentId) || null
  }

  /**
   * Derive Epic from governance document
   * 
   * @param governanceMarkdownPath Path to governance Markdown file
   * @param documentId Document ID (optional, will be read from front matter)
   * @param options Workflow options
   * @returns Epic artifact metadata
   */
  async deriveEpic(
    governanceMarkdownPath: string,
    documentId?: string,
    options: {
      outputDir?: string
      commitToGit?: boolean
      branchName?: string
    } = {}
  ): Promise<EpicArtifact> {
    const {
      outputDir = path.join(this.repoRoot, 'docs/epics'),
      commitToGit = false,
      branchName
    } = options

    // Resolve absolute paths
    const absoluteGovernancePath = path.isAbsolute(governanceMarkdownPath)
      ? governanceMarkdownPath
      : path.join(this.repoRoot, governanceMarkdownPath)

    // Step 1-4: Derive and write Epic
    const { epic, epicPath } = await this.agent.deriveAndWriteEpic(
      absoluteGovernancePath,
      documentId,
      outputDir
    )

    // Step 5: Register in muse.yaml
    const epicArtifact: EpicArtifact = {
      epic_id: epic.epic_id,
      derived_from: epic.derived_from,
      source_markdown: epic.source_markdown,
      epic_path: path.relative(this.repoRoot, epicPath),
      generated_at: epic.generated_at
    }

    this.updateMuseYaml(epicArtifact)

    // Step 6: Optionally commit to Git
    if (commitToGit && this.gitService) {
      if (branchName) {
        // TODO: Create and checkout branch
        // For now, just log warning
        console.warn('Branch creation not yet implemented, committing to current branch')
      }

      // Stage Epic and muse.yaml
      const relativeEpicPath = path.relative(this.repoRoot, epicPath)

      // TODO: Use Git service to commit both files with message:
      // `muse-005: derive epic from ${epic.derived_from}\n\nSource: ${epic.source_markdown}\nEpic: ${relativeEpicPath}`
      // For now, files are written but not committed
      console.log(`Epic derived successfully. Files ready to commit:\n- ${relativeEpicPath}\n- muse.yaml`)
    }

    return epicArtifact
  }

  /**
   * Derive Epics from all governance documents
   */
  async deriveAllEpics(
    governanceDir: string = 'docs/governance',
    options: {
      outputDir?: string
      commitToGit?: boolean
    } = {}
  ): Promise<EpicArtifact[]> {
    const absoluteGovernanceDir = path.isAbsolute(governanceDir)
      ? governanceDir
      : path.join(this.repoRoot, governanceDir)

    if (!fs.existsSync(absoluteGovernanceDir)) {
      throw new Error(`Governance directory not found: ${absoluteGovernanceDir}`)
    }

    const files = fs.readdirSync(absoluteGovernanceDir)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(absoluteGovernanceDir, file))

    const results: EpicArtifact[] = []

    for (const file of files) {
      try {
        const artifact = await this.deriveEpic(file, undefined, options)
        results.push(artifact)
      } catch (error) {
        console.error(`Failed to derive Epic from ${file}:`, error)
        // Continue with next file
      }
    }

    return results
  }
}
