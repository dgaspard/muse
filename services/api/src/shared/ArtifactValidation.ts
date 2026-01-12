/**
 * Shared Artifact Validation Utilities
 * 
 * Implements strict hardening rules for:
 * - ID format and uniqueness
 * - Feature distinctness from epics
 * - Story compliance with canonical format
 * - Governance reference tracking
 * - Failure conditions detection
 */

/**
 * Standardized governance reference with markdown path and sections
 */
export interface GovernanceReference {
  document_id: string
  filename: string
  markdown_path: string  // Full path to markdown file
  sections: string[]     // Section headers referenced
}

/**
 * Validate Epic ID format: epic-<document_id>
 */
export function validateEpicIdFormat(epicId: string, documentId: string): boolean {
  const expectedPrefix = `epic-${documentId}`
  return epicId.startsWith(expectedPrefix)
}

/**
 * Validate Feature ID format: <project>-<epic_id>-feature-<NN>
 * 
 * Example: project1-epic-doc123-feature-01
 */
export function validateFeatureIdFormat(featureId: string): boolean {
  const featurePattern = /^[\w-]+-feature-\d{2}$/
  const subFeaturePattern = /^[\w-]+-feature-\d{2}-subfeature-\d{2}$/
  return featurePattern.test(featureId) || subFeaturePattern.test(featureId)
}

/**
 * Extract feature number from ID: <project>-<epic>-feature-<NN>
 */
export function extractFeatureNumber(featureId: string): number | null {
  const match = featureId.match(/-feature-(\d{2})$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Validate Story ID format: <project>-<feature_id>-story-<NN>-<short-name>
 * 
 * Example: project1-epic-doc123-feature-01-story-01-user-authentication
 */
export function validateStoryIdFormat(storyId: string): boolean {
  const pattern = /^[\w-]+-story-\d{2}-[\w-]+$/
  return pattern.test(storyId)
}

/**
 * Extract story number from ID
 */
export function extractStoryNumber(storyId: string): number | null {
  const match = storyId.match(/-story-(\d{2})-/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Validate governance references have required structure
 */
export function validateGovernanceReferences(refs: unknown[]): boolean {
  if (!Array.isArray(refs) || refs.length === 0) {
    return false
  }
  
  return refs.every((ref) => {
    const r = ref as Record<string, unknown>
    return (
      typeof r.document_id === 'string' &&
      typeof r.filename === 'string' &&
      typeof r.markdown_path === 'string' &&
      Array.isArray(r.sections) &&
      r.sections.length > 0 &&
      (r.sections as unknown[]).every((s) => typeof s === 'string')
    )
  })
}

/**
 * Detect if feature text is tautological (just restates epic language)
 */
export function isFeatureTautological(featureText: string, epicText: string): boolean {
  // Normalize both texts
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  }
  
  const normalizedFeature = normalizeText(featureText)
  const normalizedEpic = normalizeText(epicText)
  
  // Check if feature is >70% similar to epic (word-level similarity)
  const epicWords = normalizedEpic.split(/\s+/)
  const featureWords = normalizedFeature.split(/\s+/)
  
  const minLength = Math.min(epicWords.length, featureWords.length)
  let matchCount = 0
  
  for (let i = 0; i < minLength; i++) {
    if (epicWords[i] === featureWords[i]) {
      matchCount++
    }
  }
  
  const similarity = matchCount / Math.max(epicWords.length, featureWords.length)
  return similarity > 0.7
}

/**
 * Detect if story text is tautological (just restates feature language)
 */
export function isStoryTautological(storyText: string, featureText: string): boolean {
  return isFeatureTautological(storyText, featureText)
}

/**
 * Validate acceptance criteria is not generic/tautological
 */
export function validateAcceptanceCriteria(criteria: string[]): { valid: boolean; genericMatches: string[] } {
  const genericPatterns = [
    /^feature is implemented$/i,
    /^system supports/i,
    /^as described/i,
    /^works correctly$/i,
    /^functions properly$/i,
    /^(test|verify|ensure) (that )?the .* (works|functions|is implemented)$/i,
    /^(the|this) .* (works|is implemented|functions)$/i
  ]
  
  const genericMatches: string[] = []
  
  for (const criterion of criteria) {
    for (const pattern of genericPatterns) {
      if (pattern.test(criterion)) {
        genericMatches.push(criterion)
        break
      }
    }
  }
  
  return {
    valid: genericMatches.length === 0,
    genericMatches
  }
}

/**
 * Validate business value is distinct (not just restatement of description)
 */
export function isBusinessValueDistinct(businessValue: string, description: string): boolean {
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  }
  
  const normalizedValue = normalizeText(businessValue)
  const normalizedDesc = normalizeText(description)
  
  // Check word-level similarity
  const valueWords = normalizedValue.split(/\s+/)
  const descWords = normalizedDesc.split(/\s+/)
  
  const minLength = Math.min(valueWords.length, descWords.length)
  let matchCount = 0
  
  for (let i = 0; i < minLength; i++) {
    if (valueWords[i] === descWords[i]) {
      matchCount++
    }
  }
  
  const similarity = matchCount / Math.max(valueWords.length, descWords.length)
  
  // Business value must be distinct enough (< 60% similarity)
  return similarity < 0.6
}

/**
 * Check for duplicate feature IDs in a collection
 */
export function findDuplicateFeatureIds(features: Array<{ feature_id: string }>): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  
  for (const feature of features) {
    if (seen.has(feature.feature_id)) {
      if (!duplicates.includes(feature.feature_id)) {
        duplicates.push(feature.feature_id)
      }
    } else {
      seen.add(feature.feature_id)
    }
  }
  
  return duplicates
}

/**
 * Check for duplicate story IDs in a collection
 */
export function findDuplicateStoryIds(stories: Array<{ story_id: string }>): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  
  for (const story of stories) {
    if (seen.has(story.story_id)) {
      if (!duplicates.includes(story.story_id)) {
        duplicates.push(story.story_id)
      }
    } else {
      seen.add(story.story_id)
    }
  }
  
  return duplicates
}

/**
 * Comprehensive validation report
 */
export interface ValidationReport {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate complete feature against all hardening rules
 */
export function validateFeatureHardening(feature: {
  feature_id: string
  title: string
  business_value?: string
  description: string
  acceptance_criteria?: string[]
  risk_of_not_delivering?: string[]
  governance_references?: unknown[]
  derived_from_epic: string
  epic_text?: string
}): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  // ID format
  if (!validateFeatureIdFormat(feature.feature_id)) {
    errors.push(
      `Feature ID format invalid: "${feature.feature_id}". ` +
      `Expected format: <project>-<epic_id>-feature-<NN>`
    )
  }
  
  // Business value requirement
  if (!feature.business_value || feature.business_value.trim().length < 20) {
    errors.push('Missing or insufficient business_value (minimum 20 characters)')
  }
  
  // Business value must be distinct from description
  if (feature.business_value && feature.epic_text && !isBusinessValueDistinct(feature.business_value, feature.epic_text)) {
    errors.push('business_value is too similar to epic text (must be distinct)')
  }
  
  // Check feature doesn't tautologically restate epic
  if (feature.epic_text && isFeatureTautological(feature.title, feature.epic_text)) {
    errors.push('Feature title appears to tautologically restate epic language')
  }
  
  // Acceptance criteria validation
  if (!feature.acceptance_criteria || feature.acceptance_criteria.length === 0) {
    errors.push('Missing acceptance_criteria (required)')
  } else {
    const { valid, genericMatches } = validateAcceptanceCriteria(feature.acceptance_criteria)
    if (!valid) {
      errors.push(
        `Generic/tautological acceptance criteria detected:\n` +
        genericMatches.map((m) => `  - "${m}"`).join('\n')
      )
    }
  }
  
  // Risk of not delivering requirement
  if (!feature.risk_of_not_delivering || feature.risk_of_not_delivering.length === 0) {
    errors.push('Missing risk_of_not_delivering (REQUIRED - minimum 1 risk statement)')
  } else {
    for (const risk of feature.risk_of_not_delivering) {
      if (typeof risk !== 'string' || risk.trim().length < 15) {
        errors.push('Each risk statement must be at least 15 characters')
      }
    }
  }
  
  // Governance references requirement
  if (!validateGovernanceReferences(feature.governance_references || [])) {
    errors.push(
      'Missing or invalid governance_references. ' +
      'Each reference must have: document_id, filename, markdown_path, and non-empty sections array'
    )
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate complete story against all hardening rules
 */
export function validateStoryHardening(story: {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  acceptance_criteria?: string[]
  governance_references?: unknown[]
  derived_from_feature: string
  feature_text?: string
}): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  // ID format
  if (!validateStoryIdFormat(story.story_id)) {
    errors.push(
      `Story ID format invalid: "${story.story_id}". ` +
      `Expected format: <project>-<feature_id>-story-<NN>-<short-name>`
    )
  }
  
  // Canonical format validation (role, capability, benefit)
  if (!story.role || story.role.trim().length === 0) {
    errors.push('Missing or empty role (required for canonical format)')
  }
  
  if (!story.capability || story.capability.trim().length === 0) {
    errors.push('Missing or empty capability (required for canonical format)')
  }
  
  if (!story.benefit || story.benefit.trim().length === 0) {
    errors.push('Missing or empty benefit (required for canonical format)')
  }
  
  // Check story doesn't tautologically restate feature
  if (story.feature_text && isStoryTautological(story.title, story.feature_text)) {
    errors.push('Story title appears to tautologically restate feature language')
  }
  
  // Acceptance criteria must be testable and specific
  if (!story.acceptance_criteria || story.acceptance_criteria.length === 0) {
    errors.push('Missing acceptance_criteria (REQUIRED for testability)')
  } else {
    const { valid, genericMatches } = validateAcceptanceCriteria(story.acceptance_criteria)
    if (!valid) {
      errors.push(
        `Generic/tautological acceptance criteria detected:\n` +
        genericMatches.map((m) => `  - "${m}"`).join('\n')
      )
    }
  }
  
  // Governance references requirement
  if (!validateGovernanceReferences(story.governance_references || [])) {
    errors.push(
      'Missing or invalid governance_references. ' +
      'Each reference must have: document_id, filename, markdown_path, and non-empty sections array'
    )
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Enhanced Hierarchy Validation
 * Per Prompt-muse-Increased-Feature-User-Story-Rules.md
 */

/**
 * Validate Epic has 1-5 Features (no more, no less)
 */
export function validateEpicFeatureCount(
  epicId: string,
  features: Array<{ derived_from_epic?: string; epic_id?: string }>
): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  const epicFeatures = features.filter(
    f => f.derived_from_epic === epicId || f.epic_id === epicId
  )
  const count = epicFeatures.length
  
  if (count < 1) {
    errors.push(
      `Epic "${epicId}" has no Features. Every Epic must have 1-5 Features.`
    )
  } else if (count > 5) {
    errors.push(
      `Epic "${epicId}" has ${count} Features, exceeding maximum of 5. ` +
      `Consider splitting this Epic or consolidating Features.`
    )
  }
  
  if (count === 1) {
    warnings.push(
      `Epic "${epicId}" has only 1 Feature. Verify this Epic is properly scoped.`
    )
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate Feature hierarchy: must have either Sub-Features OR Stories (not both, not neither)
 */
export function validateFeatureHierarchy(
  featureId: string,
  allFeatures: Array<{ feature_id: string; parent_feature_id?: string }>,
  stories: Array<{ derived_from_feature: string }>
): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Find Sub-Features (features that have this feature as parent)
  const subFeatures = allFeatures.filter(f => f.parent_feature_id === featureId)
  
  // Find direct Stories
  const directStories = stories.filter(s => s.derived_from_feature === featureId)
  
  const hasSubFeatures = subFeatures.length > 0
  const hasStories = directStories.length > 0
  
  if (!hasSubFeatures && !hasStories) {
    errors.push(
      `Feature "${featureId}" has neither Sub-Features nor Stories. ` +
      `Every Feature must have either Sub-Features or Stories.`
    )
  } else if (hasSubFeatures && hasStories) {
    errors.push(
      `Feature "${featureId}" has both Sub-Features and direct Stories. ` +
      `A Feature must have either Sub-Features (which contain Stories) OR direct Stories, not both.`
    )
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate Sub-Feature ID format
 * Expected: <project>-<epic_id>-feature-<NN>-subfeature-<MM>
 */
export function validateSubFeatureIdFormat(subFeatureId: string, parentFeatureId: string): boolean {
  // Sub-Feature ID should be: parent_feature_id + "-subfeature-<MM>"
  const pattern = new RegExp(`^${parentFeatureId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-subfeature-\\d{2}$`)
  return pattern.test(subFeatureId)
}

/**
 * Detect orphaned artifacts (Features without Epic, Stories without Feature)
 */
export function detectOrphanedArtifacts(
  epics: Array<{ epic_id: string }>,
  features: Array<{ feature_id: string; derived_from_epic: string; parent_feature_id?: string }>,
  stories: Array<{ story_id: string; derived_from_feature: string }>
): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Build ID sets
  const epicIds = new Set(epics.map(e => e.epic_id))
  const featureIds = new Set(features.map(f => f.feature_id))
  
  // Check for orphaned Features
  const orphanedFeatures = features.filter(f => {
    // Only check top-level Features (no parent)
    if (f.parent_feature_id) return false
    return !epicIds.has(f.derived_from_epic)
  })
  
  if (orphanedFeatures.length > 0) {
    errors.push(
      `Found ${orphanedFeatures.length} orphaned Feature(s) with non-existent Epic:\n` +
      orphanedFeatures.map(f => `  - ${f.feature_id} → Epic "${f.derived_from_epic}"`).join('\n')
    )
  }
  
  // Check for orphaned Sub-Features
  const orphanedSubFeatures = features.filter(f => {
    if (!f.parent_feature_id) return false
    return !featureIds.has(f.parent_feature_id)
  })
  
  if (orphanedSubFeatures.length > 0) {
    errors.push(
      `Found ${orphanedSubFeatures.length} orphaned Sub-Feature(s) with non-existent parent Feature:\n` +
      orphanedSubFeatures.map(f => `  - ${f.feature_id} → Parent "${f.parent_feature_id}"`).join('\n')
    )
  }
  
  // Check for orphaned Stories
  const orphanedStories = stories.filter(s => !featureIds.has(s.derived_from_feature))
  
  if (orphanedStories.length > 0) {
    errors.push(
      `Found ${orphanedStories.length} orphaned Story/Stories with non-existent Feature:\n` +
      orphanedStories.map(s => `  - ${s.story_id} → Feature "${s.derived_from_feature}"`).join('\n')
    )
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Comprehensive hierarchy validation for entire artifact set
 */
export function validateArtifactHierarchy(hierarchy: {
  epics: Array<{ epic_id: string; document_id: string }>
  features: Array<{ 
    feature_id: string
    derived_from_epic: string
    parent_feature_id?: string
  }>
  stories: Array<{ 
    story_id: string
    derived_from_feature: string
  }>
}): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  
  // 1. Check for orphaned artifacts
  const orphanReport = detectOrphanedArtifacts(hierarchy.epics, hierarchy.features, hierarchy.stories)
  errors.push(...orphanReport.errors)
  warnings.push(...orphanReport.warnings)
  
  // 2. Validate each Epic has 1-5 Features
  for (const epic of hierarchy.epics) {
    const featureCountReport = validateEpicFeatureCount(epic.epic_id, hierarchy.features)
    errors.push(...featureCountReport.errors)
    warnings.push(...featureCountReport.warnings)
  }
  
  // 3. Validate each top-level Feature has either Sub-Features or Stories
  const topLevelFeatures = hierarchy.features.filter(f => !f.parent_feature_id)
  for (const feature of topLevelFeatures) {
    const hierarchyReport = validateFeatureHierarchy(
      feature.feature_id,
      hierarchy.features,
      hierarchy.stories
    )
    errors.push(...hierarchyReport.errors)
    warnings.push(...hierarchyReport.warnings)
  }
  
  // 4. Validate each Sub-Feature has Stories
  const subFeatures = hierarchy.features.filter(f => f.parent_feature_id)
  for (const subFeature of subFeatures) {
    const subFeatureStories = hierarchy.stories.filter(
      s => s.derived_from_feature === subFeature.feature_id
    )
    if (subFeatureStories.length === 0) {
      errors.push(
        `Sub-Feature "${subFeature.feature_id}" has no Stories. ` +
        `Every Sub-Feature must have at least one Story.`
      )
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
