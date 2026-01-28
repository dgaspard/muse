/**
 * MCP Tool Server for EPIC-003: Copilot-Orchestrated Artifact Materialization
 * 
 * Exposes MCP tools for:
 * - Listing derived artifacts from muse.yaml (read-only)
 * - Retrieving artifact details
 * - Validating artifact lineage
 * - Staging artifacts for GitHub commit
 * 
 * Copilot never regenerates artifacts; it only retrieves and commits existing work.
 */

import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { MaterializationService } from './materializationService'

/**
 * Tool response format for MCP compliance
 */
export interface MCPToolResponse {
  success: boolean
  data?: unknown
  error?: string
  details?: Record<string, unknown>
}

/**
 * MCP-compliant tool server for artifact retrieval and materialization
 */
export class MCPToolServer {
  private repoRoot: string
  private materialization: MaterializationService

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = repoRoot
    this.materialization = new MaterializationService(repoRoot)
  }

  /**
   * MCP Tool: list_derived_epics
   * Returns all epics persisted in muse.yaml (read-only)
   */
  async listDerivedEpics(): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const epics = data.artifacts?.epics || []

      return {
        success: true,
        data: {
          epic_count: epics.length,
          epics: epics.map((e: any) => ({
            epic_id: e.epic_id,
            title: e.title,
            objective: e.objective,
            governance_references: e.governance_references,
            derived_from: e.derived_from,
            generated_at: e.generated_at,
          })),
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to list epics: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: get_derived_epic
   * Returns detailed epic data for a specific epic_id (read-only)
   */
  async getDerivedEpic(epicId: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const epic = data.artifacts?.epics?.find((e: any) => e.epic_id === epicId)

      if (!epic) {
        return {
          success: false,
          error: `Epic ${epicId} not found in muse.yaml`,
        }
      }

      return {
        success: true,
        data: epic,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to get epic: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: list_derived_features
   * Returns all features persisted in muse.yaml with parent epic references (read-only)
   */
  async listDerivedFeatures(epicId?: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      let features = data.artifacts?.features || []

      // Filter by epic_id if provided
      if (epicId) {
        features = features.filter((f: any) => f.epic_id === epicId)
      }

      return {
        success: true,
        data: {
          feature_count: features.length,
          epic_id: epicId,
          features: features.map((f: any) => ({
            feature_id: f.feature_id,
            title: f.title,
            epic_id: f.epic_id,
            description: f.description,
            user_story_ids: f.user_story_ids || [],
            governance_references: f.governance_references,
          })),
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to list features: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: get_derived_feature
   * Returns detailed feature data (read-only)
   */
  async getDerivedFeature(featureId: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const feature = data.artifacts?.features?.find((f: any) => f.feature_id === featureId)

      if (!feature) {
        return {
          success: false,
          error: `Feature ${featureId} not found in muse.yaml`,
        }
      }

      return {
        success: true,
        data: feature,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to get feature: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: list_derived_user_stories
   * Returns all user stories persisted in muse.yaml with hierarchy references (read-only)
   */
  async listDerivedUserStories(featureId?: string, epicId?: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      let stories = data.artifacts?.stories || []

      // Filter by feature_id if provided
      if (featureId) {
        stories = stories.filter((s: any) => s.feature_id === featureId)
      }

      // Filter by epic_id if provided
      if (epicId) {
        stories = stories.filter((s: any) => s.epic_id === epicId)
      }

      return {
        success: true,
        data: {
          story_count: stories.length,
          feature_id: featureId,
          epic_id: epicId,
          stories: stories.map((s: any) => ({
            story_id: s.story_id,
            title: s.title,
            role: s.role,
            capability: s.capability,
            benefit: s.benefit,
            feature_id: s.feature_id,
            epic_id: s.epic_id,
            acceptance_criteria: s.acceptance_criteria,
            governance_reference: s.governance_reference,
          })),
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to list user stories: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: get_derived_user_story
   * Returns detailed user story data (read-only)
   */
  async getDerivedUserStory(storyId: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const story = data.artifacts?.stories?.find((s: any) => s.story_id === storyId)

      if (!story) {
        return {
          success: false,
          error: `User story ${storyId} not found in muse.yaml`,
        }
      }

      return {
        success: true,
        data: story,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to get user story: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: list_derived_prompts
   * Returns all AI prompts persisted in muse.yaml (read-only)
   */
  async listDerivedPrompts(storyId?: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      let prompts = data.artifacts?.prompts || []

      // Filter by story_id if provided
      if (storyId) {
        prompts = prompts.filter((p: any) => p.story_id === storyId)
      }

      return {
        success: true,
        data: {
          prompt_count: prompts.length,
          story_id: storyId,
          prompts: prompts.map((p: any) => ({
            prompt_id: p.prompt_id,
            story_id: p.story_id,
            feature_id: p.feature_id,
            epic_id: p.epic_id,
            role: p.role,
            task: p.task,
            generated_at: p.generated_at,
            template: p.template,
          })),
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to list prompts: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: get_derived_prompt
   * Returns full prompt content (read-only)
   */
  async getDerivedPrompt(promptId: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const prompt = data.artifacts?.prompts?.find((p: any) => p.prompt_id === promptId)

      if (!prompt) {
        return {
          success: false,
          error: `Prompt ${promptId} not found in muse.yaml`,
        }
      }

      return {
        success: true,
        data: prompt,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to get prompt: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: validate_artifact_lineage
   * Validates epic → feature → story → prompt lineage (read-only)
   */
  async validateArtifactLineage(epicId: string): Promise<MCPToolResponse> {
    try {
      const data = this.loadMuseYaml()
      const epic = data.artifacts?.epics?.find((e: any) => e.epic_id === epicId)

      if (!epic) {
        return {
          success: false,
          error: `Epic ${epicId} not found`,
        }
      }

      const features = (data.artifacts?.features || []).filter((f: any) => f.epic_id === epicId)
      const stories = (data.artifacts?.stories || []).filter((s: any) => s.epic_id === epicId)
      const prompts = (data.artifacts?.prompts || []).filter((p: any) => p.epic_id === epicId)

      // Validate lineage
      const errors: string[] = []

      // Check features have parent epic
      for (const f of features) {
        if (f.epic_id !== epicId) {
          errors.push(`Feature ${f.feature_id} epic_id mismatch`)
        }
      }

      // Check stories have parent feature and epic
      for (const s of stories) {
        if (!features.some((f: any) => f.feature_id === s.feature_id)) {
          errors.push(`Story ${s.story_id} parent feature ${s.feature_id} not found`)
        }
        if (s.epic_id !== epicId) {
          errors.push(`Story ${s.story_id} epic_id mismatch`)
        }
      }

      // Check prompts have parent story
      for (const p of prompts) {
        if (!stories.some((s: any) => s.story_id === p.story_id)) {
          errors.push(`Prompt ${p.prompt_id} parent story ${p.story_id} not found`)
        }
      }

      return {
        success: errors.length === 0,
        data: {
          epic_id: epicId,
          valid: errors.length === 0,
          feature_count: features.length,
          story_count: stories.length,
          prompt_count: prompts.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        details: {
          epic: {
            id: epic.epic_id,
            title: epic.title,
          },
          features: features.map((f: any) => f.feature_id),
          stories: stories.map((s: any) => s.story_id),
          prompts: prompts.map((p: any) => p.prompt_id),
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Lineage validation failed: ${(err as Error).message}`,
      }
    }
  }

  /**
   * MCP Tool: materialize_artifacts
   * Renders persisted artifacts to /docs Markdown files (write operation - GATED)
   * Called by Copilot to stage artifacts for GitHub PR
   */
  async materializeArtifacts(): Promise<MCPToolResponse> {
    try {
      console.log('[MCPToolServer] Materializing artifacts to /docs')
      
      const result = await this.materialization.materialize()

      if (!result.success) {
        return {
          success: false,
          error: 'Materialization failed',
          data: result,
        }
      }

      return {
        success: true,
        data: {
          files_created: result.filesCreated,
          summary: result.summary,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      }
    } catch (err) {
      return {
        success: false,
        error: `Materialization failed: ${(err as Error).message}`,
      }
    }
  }

  /**
   * Internal: Load muse.yaml
   */
  private loadMuseYaml(): any {
    const museYamlPath = path.join(this.repoRoot, 'muse.yaml')

    if (!fs.existsSync(museYamlPath)) {
      return { artifacts: {} }
    }

    const content = fs.readFileSync(museYamlPath, 'utf-8')
    return YAML.parse(content) || { artifacts: {} }
  }
}
