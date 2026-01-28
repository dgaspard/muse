/**
 * Centralized project path utilities for MUSE artifact storage
 * 
 * File structure:
 * /docs/projects/{project-id}/
 *   governance/           - Original governance documents
 *   epics/
 *     {epic-name-epic-id}/
 *       epic.yaml         - Epic metadata
 *       features/
 *         {feature-name-feature-id}/
 *           feature.yaml  - Feature metadata
 *           userstories/
 *             {story-name-story-id}/
 *               story.yaml      - User story metadata
 *               aiprompts/
 *                 {prompt-name-prompt-id}.md - AI prompt files
 */

import path from 'path'

/**
 * Create a safe slug from a name for use in paths
 * Removes special characters, converts spaces to hyphens
 */
function createSlug(name: string, maxLength: number = 60): string {
  if (!name || typeof name !== 'string') {
    return 'untitled'
  }
  
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')          // Convert spaces to hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .substring(0, maxLength)
}

/**
 * Create folder name with format: {slug-name-id}
 */
function createFolderName(name: string, id: string): string {
  const slug = createSlug(name)
  return `${slug}-${id}`
}

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
export function getEpicPaths(
  repoRoot: string, 
  projectId: string, 
  epicId: string,
  epicName?: string
): EpicPaths {
  const { epics } = getProjectPaths(repoRoot, projectId)
  const folderName = epicName ? createFolderName(epicName, epicId) : epicId
  const epicRoot = path.join(epics, folderName)
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
  featureId: string,
  epicName?: string,
  featureName?: string
): FeaturePaths {
  const { features } = getEpicPaths(repoRoot, projectId, epicId, epicName)
  const folderName = featureName ? createFolderName(featureName, featureId) : featureId
  const featureRoot = path.join(features, folderName)
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
  storyId: string,
  epicName?: string,
  featureName?: string,
  storyTitle?: string
): StoryPaths {
  const { userstories } = getFeaturePaths(repoRoot, projectId, epicId, featureId, epicName, featureName)
  const folderName = storyTitle ? createFolderName(storyTitle, storyId) : storyId
  const storyRoot = path.join(userstories, folderName)
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
  promptId: string,
  epicName?: string,
  featureName?: string,
  storyTitle?: string,
  promptRole?: string
): string {
  const { aiprompts } = getStoryPaths(repoRoot, projectId, epicId, featureId, storyId, epicName, featureName, storyTitle)
  const fileName = promptRole ? `${createSlug(promptRole)}-${promptId}.md` : `${promptId}.md`
  return path.join(aiprompts, fileName)
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
