/**
 * Centralized project path utilities for MUSE artifact storage
 * 
 * File structure:
 * /docs/projects/{project-id}/
 *   governance/           - Original governance documents
 *   epics/
 *     {epic-id}/
 *       epic.yaml         - Epic metadata
 *       features/
 *         {feature-id}/
 *           feature.yaml  - Feature metadata
 *           userstories/
 *             {story-id}/
 *               story.yaml      - User story metadata
 *               aiprompts/
 *                 {prompt-id}.md - AI prompt files
 */

import path from 'path'

export interface ProjectPaths {
  projectRoot: string
  governance: string
  epics: string
}

export interface EpicPaths {
  epicRoot: string
  epicFile: string
  features: string
}

export interface FeaturePaths {
  featureRoot: string
  featureFile: string
  userstories: string
}

export interface StoryPaths {
  storyRoot: string
  storyFile: string
  aiprompts: string
}

/**
 * Get base paths for a project
 */
export function getProjectPaths(repoRoot: string, projectId: string): ProjectPaths {
  const projectRoot = path.join(repoRoot, 'docs', 'projects', projectId)
  return {
    projectRoot,
    governance: path.join(projectRoot, 'governance'),
    epics: path.join(projectRoot, 'epics'),
  }
}

/**
 * Get paths for an epic within a project
 */
export function getEpicPaths(repoRoot: string, projectId: string, epicId: string): EpicPaths {
  const { epics } = getProjectPaths(repoRoot, projectId)
  const epicRoot = path.join(epics, epicId)
  return {
    epicRoot,
    epicFile: path.join(epicRoot, 'epic.yaml'),
    features: path.join(epicRoot, 'features'),
  }
}

/**
 * Get paths for a feature within an epic
 */
export function getFeaturePaths(
  repoRoot: string,
  projectId: string,
  epicId: string,
  featureId: string
): FeaturePaths {
  const { features } = getEpicPaths(repoRoot, projectId, epicId)
  const featureRoot = path.join(features, featureId)
  return {
    featureRoot,
    featureFile: path.join(featureRoot, 'feature.yaml'),
    userstories: path.join(featureRoot, 'userstories'),
  }
}

/**
 * Get paths for a user story within a feature
 */
export function getStoryPaths(
  repoRoot: string,
  projectId: string,
  epicId: string,
  featureId: string,
  storyId: string
): StoryPaths {
  const { userstories } = getFeaturePaths(repoRoot, projectId, epicId, featureId)
  const storyRoot = path.join(userstories, storyId)
  return {
    storyRoot,
    storyFile: path.join(storyRoot, 'story.yaml'),
    aiprompts: path.join(storyRoot, 'aiprompts'),
  }
}

/**
 * Get full path for an AI prompt file
 */
export function getPromptPath(
  repoRoot: string,
  projectId: string,
  epicId: string,
  featureId: string,
  storyId: string,
  promptId: string
): string {
  const { aiprompts } = getStoryPaths(repoRoot, projectId, epicId, featureId, storyId)
  return path.join(aiprompts, `${promptId}.md`)
}

/**
 * Extract IDs from artifact data for path resolution
 */
export interface ArtifactIds {
  projectId: string
  epicId: string
  featureId?: string
  storyId?: string
}

/**
 * Create slug from title for human-readable filenames
 * (Keeping this here for potential future use with alternate naming)
 */
export function createSlug(text: string, maxLength: number = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength)
}
