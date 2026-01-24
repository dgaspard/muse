/**
 * EPIC-003 MCP Server Initialization
 * 
 * Exposes MCP tools for Copilot to retrieve and materialize artifacts without regenerating them.
 * 
 * Tools exposed:
 * - list_derived_epics, get_derived_epic
 * - list_derived_features, get_derived_feature
 * - list_derived_user_stories, get_derived_user_story
 * - list_derived_prompts, get_derived_prompt
 * - validate_artifact_lineage
 * - materialize_artifacts
 * - commit_artifacts_to_github
 */

import { MCPToolServer } from './mcpToolServer'
import { GitHubService } from './githubService'

export const mcpToolServer = new MCPToolServer()
export const githubService = new GitHubService()

/**
 * Register MCP tools with Copilot
 * This function should be called during server initialization
 */
export function registerMCPTools(): Record<string, any> {
  return {
    'list_derived_epics': {
      description: 'List all epics derived from governance documents (read-only)',
      handler: () => mcpToolServer.listDerivedEpics(),
    },
    'get_derived_epic': {
      description: 'Get details of a specific epic (read-only)',
      parameters: {
        epic_id: {
          type: 'string',
          description: 'The epic ID',
        },
      },
      handler: (params: { epic_id: string }) => mcpToolServer.getDerivedEpic(params.epic_id),
    },
    'list_derived_features': {
      description: 'List all features derived from epics (read-only, optionally filter by epic)',
      parameters: {
        epic_id: {
          type: 'string',
          description: 'Optional: filter features by epic_id',
          required: false,
        },
      },
      handler: (params?: { epic_id?: string }) => mcpToolServer.listDerivedFeatures(params?.epic_id),
    },
    'get_derived_feature': {
      description: 'Get details of a specific feature (read-only)',
      parameters: {
        feature_id: {
          type: 'string',
          description: 'The feature ID',
        },
      },
      handler: (params: { feature_id: string }) => mcpToolServer.getDerivedFeature(params.feature_id),
    },
    'list_derived_user_stories': {
      description: 'List all user stories derived from features (read-only)',
      parameters: {
        feature_id: {
          type: 'string',
          description: 'Optional: filter stories by feature_id',
          required: false,
        },
        epic_id: {
          type: 'string',
          description: 'Optional: filter stories by epic_id',
          required: false,
        },
      },
      handler: (params?: { feature_id?: string; epic_id?: string }) =>
        mcpToolServer.listDerivedUserStories(params?.feature_id, params?.epic_id),
    },
    'get_derived_user_story': {
      description: 'Get details of a specific user story (read-only)',
      parameters: {
        story_id: {
          type: 'string',
          description: 'The story ID',
        },
      },
      handler: (params: { story_id: string }) => mcpToolServer.getDerivedUserStory(params.story_id),
    },
    'list_derived_prompts': {
      description: 'List all AI prompts derived from user stories (read-only)',
      parameters: {
        story_id: {
          type: 'string',
          description: 'Optional: filter prompts by story_id',
          required: false,
        },
      },
      handler: (params?: { story_id?: string }) => mcpToolServer.listDerivedPrompts(params?.story_id),
    },
    'get_derived_prompt': {
      description: 'Get full content of a specific AI prompt (read-only)',
      parameters: {
        prompt_id: {
          type: 'string',
          description: 'The prompt ID',
        },
      },
      handler: (params: { prompt_id: string }) => mcpToolServer.getDerivedPrompt(params.prompt_id),
    },
    'validate_artifact_lineage': {
      description: 'Validate epic → feature → story → prompt lineage (read-only)',
      parameters: {
        epic_id: {
          type: 'string',
          description: 'The epic ID to validate',
        },
      },
      handler: (params: { epic_id: string }) => mcpToolServer.validateArtifactLineage(params.epic_id),
    },
    'materialize_artifacts': {
      description:
        'Render all persisted artifacts from muse.yaml to /docs Markdown files (write operation)',
      handler: () => mcpToolServer.materializeArtifacts(),
    },
    'commit_artifacts_to_github': {
      description: 'Stage and commit materialized artifacts to GitHub via feature branch and PR',
      parameters: {
        branch_name: {
          type: 'string',
          description: 'Feature branch name (e.g., epic-003-materialization)',
        },
        pr_title: {
          type: 'string',
          description: 'Pull request title',
        },
        pr_body: {
          type: 'string',
          description: 'Pull request body/description',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: GitHub PR labels',
          required: false,
        },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: GitHub usernames to request review',
          required: false,
        },
      },
      handler: async (params: {
        branch_name: string
        pr_title: string
        pr_body: string
        labels?: string[]
        reviewers?: string[]
      }) => {
        // Create feature branch
        const branchResult = githubService.createFeatureBranch(params.branch_name)
        if (!branchResult.success) {
          return branchResult
        }

        // Get files to stage
        const status = githubService.getStatus()
        const filesToStage = [...status.staged, ...status.unstaged]

        if (filesToStage.length === 0) {
          return {
            success: false,
            error: 'No files to commit',
          }
        }

        // Stage files
        const stageResult = githubService.stageFiles(filesToStage)
        if (!stageResult.success) {
          return stageResult
        }

        // Commit
        const commitResult = githubService.commitChanges(params.pr_title)
        if (!commitResult.success) {
          return commitResult
        }

        // Create PR
        const prResult = await githubService.createPullRequest({
          baseBranch: 'main',
          headBranch: params.branch_name,
          title: params.pr_title,
          body: params.pr_body,
          labels: params.labels,
          reviewers: params.reviewers,
        })

        return prResult
      },
    },
  }
}

/**
 * Initialize and start MCP server
 * This would be called by the API to expose tools to Copilot
 */
export async function initializeMCPServer(): Promise<void> {
  console.log('[MCP] Initializing EPIC-003 MCP Tool Server')
  console.log('[MCP] Available tools:')
  console.log('  - list_derived_epics (read-only)')
  console.log('  - get_derived_epic (read-only)')
  console.log('  - list_derived_features (read-only)')
  console.log('  - get_derived_feature (read-only)')
  console.log('  - list_derived_user_stories (read-only)')
  console.log('  - get_derived_user_story (read-only)')
  console.log('  - list_derived_prompts (read-only)')
  console.log('  - get_derived_prompt (read-only)')
  console.log('  - validate_artifact_lineage (read-only)')
  console.log('  - materialize_artifacts (write)')
  console.log('  - commit_artifacts_to_github (write, requires gh CLI)')
}
