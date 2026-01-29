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
 * Validate that a constructed path is within the allowed base directory
 * Prevents path traversal attacks
 */
function validatePath(basePath: string, targetPath: string): string {
  // Resolve both paths to absolute paths
  const resolvedBase = path.resolve(basePath)
  const resolvedTarget = path.resolve(targetPath)
  
  // Check if the target path starts with the base path
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`Path traversal detected: ${targetPath} is outside allowed directory`)
  }
  
  return resolvedTarget
}

/**
 * Sanitize ID to prevent path traversal
 * Only allows alphanumeric, hyphens, and underscores
 */
function sanitizeId(id: string, fieldName: string = 'id'): string {
  if (!id || typeof id !== 'string') {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  
  // Remove any path separators and parent directory references
  const sanitized = id.replace(/[/\\.]/g, '-')
  
  // Validate it only contains safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error(`${fieldName} contains invalid characters: ${id}`)
  }
  
  return sanitized
}

/**
 * Create a safe slug from a name for use in paths
 * Removes special characters, converts spaces to hyphens
 */
function createSlug(name: string, maxLength: number = 60): string {
  if (!name || typeof name !== 'string') {
    return 'untitled'
  }
  
  let result = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')          // Convert spaces to hyphens
    .replace(/-{2,}/g, '-')        // Collapse multiple hyphens
  
  // Remove leading/trailing hyphens without ReDoS risk
  while (result.startsWith('-')) {
    result = result.slice(1)
  }
  while (result.endsWith('-')) {
    result = result.slice(0, -1)
  }
  
  return result.substring(0, maxLength)
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
  const sanitizedProjectId = sanitizeId(projectId, 'projectId')
  const projectRoot = path.join(repoRoot, 'docs', 'projects', sanitizedProjectId)
  
  // Validate paths are within repo
  validatePath(repoRoot, projectRoot)
  
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
  const sanitizedEpicId = sanitizeId(epicId, 'epicId')
  const { epics } = getProjectPaths(repoRoot, projectId)
  const folderName = epicName ? createFolderName(epicName, sanitizedEpicId) : sanitizedEpicId
  const epicRoot = path.join(epics, folderName)
  
  // Validate path is within expected directory
  validatePath(repoRoot, epicRoot)
  
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
  const sanitizedFeatureId = sanitizeId(featureId, 'featureId')
  const { features } = getEpicPaths(repoRoot, projectId, epicId, epicName)
  const folderName = featureName ? createFolderName(featureName, sanitizedFeatureId) : sanitizedFeatureId
  const featureRoot = path.join(features, folderName)
  
  // Validate path is within expected directory
  validatePath(repoRoot, featureRoot)
  
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
  const sanitizedStoryId = sanitizeId(storyId, 'storyId')
  const { userstories } = getFeaturePaths(repoRoot, projectId, epicId, featureId, epicName, featureName)
  const folderName = storyTitle ? createFolderName(storyTitle, sanitizedStoryId) : sanitizedStoryId
  const storyRoot = path.join(userstories, folderName)
  
  // Validate path is within expected directory
  validatePath(repoRoot, storyRoot)
  
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
  const sanitizedPromptId = sanitizeId(promptId, 'promptId')
  const { aiprompts } = getStoryPaths(repoRoot, projectId, epicId, featureId, storyId, epicName, featureName, storyTitle)
  const fileName = promptRole ? `${createSlug(promptRole)}-${sanitizedPromptId}.md` : `${sanitizedPromptId}.md`
  const promptPath = path.join(aiprompts, fileName)
  
  // Validate path is within expected directory
  validatePath(repoRoot, promptPath)
  
  return promptPath
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
