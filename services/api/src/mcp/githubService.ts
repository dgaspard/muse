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
    this.repoRoot = repoRoot
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
      try {
        execSync(`git -C ${this.repoRoot} rev-parse --verify ${branchName}`, { stdio: 'pipe' })
        // Branch exists, check it out
        execSync(`git -C ${this.repoRoot} checkout ${branchName}`, { stdio: 'pipe' })
      } catch {
        // Branch doesn't exist, create it
        execSync(`git -C ${this.repoRoot} checkout -b ${branchName}`, { stdio: 'pipe' })
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
      execSync(`git -C ${this.repoRoot} add ${validFiles.map(f => `"${f}"`).join(' ')}`, { stdio: 'pipe' })

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
      const output = execSync(`git -C ${this.repoRoot} commit -m "${escapedMessage}"`, {
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
      const output = execSync(`cd ${this.repoRoot} && ${command}`, {
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
      return execSync(`git -C ${this.repoRoot} rev-parse --abbrev-ref HEAD`, {
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
      const output = execSync(`git -C ${this.repoRoot} status --porcelain`, {
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
