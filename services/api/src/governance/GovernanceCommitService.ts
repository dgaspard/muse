import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import YAML from 'yaml'

/**
 * Error thrown when Git repository is not initialized or not found
 */
export class GitRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitRepositoryError'
  }
}

/**
 * Error thrown when working tree has conflicts
 */
export class DirtyWorkingTreeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirtyWorkingTreeError'
  }
}

/**
 * Error thrown when artifact registration fails
 */
export class ArtifactRegistrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArtifactRegistrationError'
  }
}

/**
 * Metadata for a committed governance artifact
 */
export type CommitMetadata = {
  commit_hash: string
  committed_at: string
  artifact_path: string
  document_id: string
  original_filename: string
}

/**
 * GovernanceCommitService handles staging, committing, and tracking
 * governance Markdown artifacts in the Git repository.
 *
 * Responsibilities:
 * - Stage governance Markdown files
 * - Create deterministic commits with proper message format
 * - Return commit hash for traceability
 * - Update muse.yaml with artifact metadata
 * - Fail gracefully on Git errors
 */
export class GovernanceCommitService {
  private repositoryRoot: string

  constructor(repositoryRoot: string = process.cwd()) {
    this.repositoryRoot = repositoryRoot
  }

  /**
   * Checks if the repository is a valid Git repository
   * @throws GitRepositoryError if not a valid Git repository
   */
  private validateRepository(): void {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.repositoryRoot,
        stdio: 'pipe',
      })
    } catch (error) {
      throw new GitRepositoryError(
        `Not a valid Git repository at ${this.repositoryRoot}. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Checks if the working tree is clean (no uncommitted changes)
   * that would conflict with governance files
   * @throws DirtyWorkingTreeError if working tree has uncommitted changes
   */
  private checkWorkingTree(): void {
    try {
      const status = execSync('git status --porcelain', {
        cwd: this.repositoryRoot,
        encoding: 'utf-8',
      })

      if (status.trim().length > 0) {
        // Allow untracked files, but fail if there are modified tracked files
        const modifiedLines = status
          .split('\n')
          .filter((line) => line.startsWith(' M') || line.startsWith('M ') || line.startsWith('MM'))

        if (modifiedLines.length > 0) {
          throw new DirtyWorkingTreeError(
            `Working tree has uncommitted changes:\n${modifiedLines.join('\n')}`,
          )
        }
      }
    } catch (error) {
      if (error instanceof DirtyWorkingTreeError) {
        throw error
      }
      throw new GitRepositoryError(
        `Failed to check Git status: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Stages and commits a governance Markdown file to Git
   *
   * @param markdownFilePath - Absolute path to the Markdown file to commit
   * @param documentId - Document ID for traceability
   * @param originalFilename - Original filename of the source document
   * @returns CommitMetadata with commit hash and artifact path
   * @throws GitRepositoryError if repository is invalid
   * @throws DirtyWorkingTreeError if working tree has conflicts
   * @throws Error if Git operations fail
   */
  async commitGovernanceMarkdown(
    markdownFilePath: string,
    documentId: string,
    originalFilename: string,
  ): Promise<CommitMetadata> {
    // Validate repository and working tree
    this.validateRepository()
    this.checkWorkingTree()

    // Verify the file exists
    if (!fs.existsSync(markdownFilePath)) {
      throw new Error(`Markdown file not found: ${markdownFilePath}`)
    }

    try {
      // Get the relative path for Git operations
      const relativePath = path.relative(this.repositoryRoot, markdownFilePath)

      // Stage the file
      execSync(`git add "${relativePath}"`, {
        cwd: this.repositoryRoot,
      })

      // Create deterministic commit message
      const commitMessage = `docs(governance): add markdown derived from ${documentId}\n\nSource: ${originalFilename}`

      // Create the commit with explicit configuration for deterministic behavior
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: this.repositoryRoot,
        env: {
          ...process.env,
          GIT_AUTHOR_DATE: new Date().toISOString(),
          GIT_COMMITTER_DATE: new Date().toISOString(),
        },
      })

      // Get the commit hash
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: this.repositoryRoot,
        encoding: 'utf-8',
      }).trim()

      // Prepare metadata
      const metadata: CommitMetadata = {
        commit_hash: commitHash,
        committed_at: new Date().toISOString(),
        artifact_path: `docs/governance/${path.basename(markdownFilePath)}`,
        document_id: documentId,
        original_filename: originalFilename,
      }

      // Update muse.yaml with artifact metadata
      await this.updateMuseYaml(metadata)

      return metadata
    } catch (error) {
      // If commit failed due to nothing to commit, that's OK
      if (error instanceof Error && error.message.includes('nothing to commit')) {
        const commitHash = execSync('git rev-parse HEAD', {
          cwd: this.repositoryRoot,
          encoding: 'utf-8',
        }).trim()

        const metadata: CommitMetadata = {
          commit_hash: commitHash,
          committed_at: new Date().toISOString(),
          artifact_path: `docs/governance/${path.basename(markdownFilePath)}`,
          document_id: documentId,
          original_filename: originalFilename,
        }

        await this.updateMuseYaml(metadata)
        return metadata
      }

      throw error
    }
  }

  /**
   * Updates muse.yaml with governance artifact commit metadata
   *
   * @param metadata - Commit metadata to record
   * @throws ArtifactRegistrationError if update fails
   */
  private async updateMuseYaml(metadata: CommitMetadata): Promise<void> {
    const museYamlPath = path.join(this.repositoryRoot, 'muse.yaml')

    try {
      // Read existing muse.yaml or create new structure
      let museConfig: any = { artifacts: { governance_markdown: [] } }

      if (fs.existsSync(museYamlPath)) {
        const content = fs.readFileSync(museYamlPath, 'utf-8')
        museConfig = YAML.parse(content) || museConfig
      }

      // Ensure artifacts structure exists
      if (!museConfig.artifacts) {
        museConfig.artifacts = {}
      }

      if (!museConfig.artifacts.governance_markdown) {
        museConfig.artifacts.governance_markdown = []
      }

      // Ensure it's an array
      if (!Array.isArray(museConfig.artifacts.governance_markdown)) {
        museConfig.artifacts.governance_markdown = []
      }

      // Add or update artifact record
      const existingIndex = museConfig.artifacts.governance_markdown.findIndex(
        (item: any) => item.document_id === metadata.document_id,
      )

      const record = {
        document_id: metadata.document_id,
        original_filename: metadata.original_filename,
        artifact_path: metadata.artifact_path,
        derived_from: metadata.document_id,
        committed: {
          commit_hash: metadata.commit_hash,
          committed_at: metadata.committed_at,
        },
      }

      if (existingIndex >= 0) {
        museConfig.artifacts.governance_markdown[existingIndex] = record
      } else {
        museConfig.artifacts.governance_markdown.push(record)
      }

      // Write back to muse.yaml
      const yamlContent = YAML.stringify(museConfig, { lineWidth: 0 })
      fs.writeFileSync(museYamlPath, yamlContent, 'utf-8')
    } catch (error) {
      throw new ArtifactRegistrationError(
        `Failed to update muse.yaml: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Retrieves the current commit metadata from muse.yaml for a document
   *
   * @param documentId - Document ID to look up
   * @returns CommitMetadata or null if not found
   */
  getCommitMetadata(documentId: string): CommitMetadata | null {
    const museYamlPath = path.join(this.repositoryRoot, 'muse.yaml')

    if (!fs.existsSync(museYamlPath)) {
      return null
    }

    try {
      const content = fs.readFileSync(museYamlPath, 'utf-8')
      const museConfig = YAML.parse(content)

      if (!museConfig?.artifacts?.governance_markdown) {
        return null
      }

      const record = museConfig.artifacts.governance_markdown.find(
        (item: any) => item.document_id === documentId,
      )

      if (!record) {
        return null
      }

      return {
        commit_hash: record.committed.commit_hash,
        committed_at: record.committed.committed_at,
        artifact_path: record.artifact_path,
        document_id: record.document_id,
        original_filename: record.original_filename,
      }
    } catch (error) {
      console.error(
        `Failed to read muse.yaml: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }
}
