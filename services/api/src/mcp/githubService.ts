/**
 * GitHub Service for EPIC-003
 * Handles Copilot-initiated GitHub operations:
 * - Creating pull requests with materialized artifacts
 * - Staging changes to git
 * - Creating feature branches
 * 
 * Constraints:
 * - No direct pushes to main
 * - All changes flow through PR review
 * - Copilot cannot bypass governance
 */

import { execSync } from 'child_process'
import path from 'path'

export interface GitCommitOptions {
  branch: string
  commitMessage: string
  files: string[] // relative paths to commit
}

export interface GitPullRequestOptions {
  baseBranch: string
  headBranch: string
  title: string
  body: string
  labels?: string[]
  reviewers?: string[]
}

export interface GitOperationResult {
  success: boolean
  branch?: string
  commitHash?: string
  prUrl?: string
  error?: string
}

/**
 * Git and GitHub service for artifact materialization workflow
 */
export class GitHubService {
  private repoRoot: string

  constructor(repoRoot: string = process.cwd()) {
    // Validate and resolve the repo root to prevent path injection
    this.repoRoot = path.resolve(repoRoot)
  }

  /**
   * Safely escape a path for use in shell commands
   */
  private escapeShellPath(pathStr: string): string {
    // Use single quotes to prevent expansion, escape any single quotes in the path
    return `'${pathStr.replace(/'/g, "'\\''")}'`
  }

  /**
   * Create a feature branch for artifact materialization
   */
  createFeatureBranch(branchName: string): GitOperationResult {
    try {
      // Validate branch name (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(branchName)) {
        return {
          success: false,
          error: `Invalid branch name: ${branchName}`,
        }
      }

      // Check if branch already exists
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      try {
        execSync(`git -C ${escapedRepoRoot} rev-parse --verify ${branchName}`, { stdio: 'pipe' })
        // Branch exists, check it out
        execSync(`git -C ${escapedRepoRoot} checkout ${branchName}`, { stdio: 'pipe' })
      } catch {
        // Branch doesn't exist, create it
        execSync(`git -C ${escapedRepoRoot} checkout -b ${branchName}`, { stdio: 'pipe' })
      }

      return {
        success: true,
        branch: branchName,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to create branch: ${(err as Error).message}`,
      }
    }
  }

  /**
   * Stage artifacts for commit
   */
  stageFiles(files: string[]): GitOperationResult {
    try {
      // Only allow /docs/** paths for safety
      const validFiles: string[] = []

      for (const file of files) {
        const absPath = path.isAbsolute(file) ? file : path.join(this.repoRoot, file)
        const relPath = path.relative(this.repoRoot, absPath)

        // Ensure path is within /docs and doesn't escape via ..
        if (!relPath.startsWith('docs') || relPath.includes('..')) {
          console.warn(`[GitHubService] Rejecting unsafe path: ${relPath}`)
          continue
        }

        validFiles.push(relPath)
      }

      if (validFiles.length === 0) {
        return {
          success: false,
          error: 'No valid files to stage (only /docs/** allowed)',
        }
      }

      // Stage files
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      execSync(`git -C ${escapedRepoRoot} add ${validFiles.map(f => `"${f}"`).join(' ')}`, { stdio: 'pipe' })

      return {
        success: true,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to stage files: ${(err as Error).message}`,
      }
    }
  }

  /**
   * Commit staged artifacts
   */
  commitChanges(commitMessage: string): GitOperationResult {
    try {
      // Validate commit message (non-empty, reasonable length)
      if (!commitMessage || commitMessage.trim().length === 0) {
        return {
          success: false,
          error: 'Commit message cannot be empty',
        }
      }

      if (commitMessage.length > 1000) {
        return {
          success: false,
          error: 'Commit message too long (max 1000 characters)',
        }
      }

      // Create commit
      // Properly escape backslashes first, then quotes to prevent injection
      const escapedMessage = commitMessage.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      const output = execSync(`git -C ${escapedRepoRoot} commit -m "${escapedMessage}"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      // Extract commit hash from output
      const hashMatch = output.match(/\[[\w/]+ ([a-f0-9]{7})\]/)
      const commitHash = hashMatch ? hashMatch[1] : undefined

      return {
        success: true,
        commitHash,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to commit: ${(err as Error).message}`,
      }
    }
  }

  /**
   * Create a pull request (requires GitHub CLI: gh)
   */
  async createPullRequest(options: GitPullRequestOptions): Promise<GitOperationResult> {
    try {
      // Ensure gh CLI is available
      try {
        execSync('which gh', { stdio: 'pipe' })
      } catch {
        return {
          success: false,
          error: 'GitHub CLI (gh) not found. Install from https://cli.github.com/',
        }
      }

      // Build gh pr create command
      // Properly escape backslashes first, then quotes to prevent injection
      const escapedTitle = options.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const escapedBody = options.body.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const args = [
        `--base=${options.baseBranch}`,
        `--head=${options.headBranch}`,
        `-t "${escapedTitle}"`,
        `-b "${escapedBody}"`,
      ]

      if (options.labels && options.labels.length > 0) {
        args.push(`-l "${options.labels.join(',')}"`)
      }

      if (options.reviewers && options.reviewers.length > 0) {
        args.push(`-r "${options.reviewers.join(',')}"`)
      }

      const command = `gh pr create ${args.join(' ')}`
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      const output = execSync(`cd ${escapedRepoRoot} && ${command}`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      // Extract PR URL
      const prUrl = output.trim().split('\n')[0]

      return {
        success: true,
        prUrl,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to create PR: ${(err as Error).message}`,
      }
    }
  }

  /**
   * Get current branch
   */
  getCurrentBranch(): string | null {
    try {
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      return execSync(`git -C ${escapedRepoRoot} rev-parse --abbrev-ref HEAD`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      }).trim()
    } catch {
      return null
    }
  }

  /**
   * Check git status (staged/unstaged changes)
   */
  getStatus(): { staged: string[]; unstaged: string[] } {
    try {
      const escapedRepoRoot = this.escapeShellPath(this.repoRoot)
      const output = execSync(`git -C ${escapedRepoRoot} status --porcelain`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      const staged: string[] = []
      const unstaged: string[] = []

      for (const line of output.split('\n')) {
        if (!line.trim()) continue

        const status = line.substring(0, 2)
        const file = line.substring(3)

        if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file)
        } else if (status[1] !== ' ') {
          unstaged.push(file)
        }
      }

      return { staged, unstaged }
    } catch {
      return { staged: [], unstaged: [] }
    }
  }
}
