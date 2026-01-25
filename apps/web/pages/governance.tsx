import React, { useState } from 'react'

interface EpicData {
  epic_id: string
  title: string
  objective: string
  success_criteria: string[]
  governance_references: string[]
}

interface FeatureData {
  feature_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  epic_id: string
  governance_references: string[]
}

/**
 * StoryData: Pure product artifact describing what users want.
 * MUST NOT contain:
 * - Execution instructions
 * - AI role language ("you are")
 * - Implementation steps
 * References are optional and used for traceability only.
 */
interface StoryData {
  story_id: string
  title: string
  role: string // "As a..."
  capability: string // "I want to..."
  benefit: string // "So that..."
  acceptance_criteria: string[]
  derived_from_feature: string
  derived_from_epic: string
  governance_references: string[]
}

/**
 * AIPrompt: Executable instructions for AI agents.
 * MUST contain:
 * - Explicit role declaration ("You are...")
 * - Specific task ("Your task is...")
 * - Output expectations
 * - Story references by ID (not duplication)
 * References are resolved and validated.
 */
interface AIPrompt {
  prompt_id: string // Unique identifier for this prompt
  story_id: string // References the story by ID
  feature_id?: string // Optional: resolved feature reference
  epic_id?: string // Optional: resolved epic reference
  content: string // Full interpolated prompt text
  role: string // AI role (e.g., "Software Engineer")
  task: string // Primary task (e.g., "Implement PR from story")
  generated_at: string // ISO timestamp
  template: string // Which template was used
}

/**
 * StoryWithPrompts: UI state binding story to its generated prompts.
 * Note: A story can have multiple prompts (implementation, analysis, etc.)
 * This keeps UI state while maintaining artifact separation.
 */
interface StoryWithPrompts extends StoryData {
  prompts?: AIPrompt[] // Array of generated prompts
  activePromptId?: string // Currently displayed prompt
  promptsLoading?: boolean
  promptsError?: string
  promptsExpanded?: boolean
}

interface FeatureWithStories extends FeatureData {
  stories?: StoryWithPrompts[]
  storiesLoading?: boolean
  storiesError?: string
}

interface PipelineOutput {
  document: {
    document_id: string
    original_filename: string
  }
  markdown: {
    content: string
    path: string
  }
  epics: EpicData[] // Changed from single epic to array
  features: FeatureData[]
  stories: StoryData[]
}

type PipelineStage = 'idle' | 'uploading' | 'converting' | 'deriving-epic' | 'complete' | 'error'

interface GeneratedFeatureResponse {
  ok: boolean
  epic_id: string
  feature_count: number
  features: FeatureData[]
}

export default function GovernanceWorkflowPage(): JSX.Element {
  const [projectId, setProjectId] = useState<string>('demo-project')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<PipelineOutput | null>(null)
  const [showMarkdown, setShowMarkdown] = useState<boolean>(false)
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())
  const [generatingFeatures, setGeneratingFeatures] = useState<Set<string>>(new Set())
  const [featuresByEpic, setFeaturesByEpic] = useState<Map<string, FeatureWithStories[]>>(new Map())
  const [addingToBacklog, setAddingToBacklog] = useState<Set<string>>(new Set())
  const [backlogMessage, setBacklogMessage] = useState<{ type: 'success' | 'error' | 'loading' | ''; text: string }>({ type: '', text: '' })

  const toggleFeatureExpanded = (featureId: string) => {
    const newExpanded = new Set(expandedFeatures)
    if (newExpanded.has(featureId)) {
      newExpanded.delete(featureId)
    } else {
      newExpanded.add(featureId)
    }
    setExpandedFeatures(newExpanded)
  }

  const generateFeaturesForEpic = async (epic: EpicData) => {
    if (!output) return

    setGeneratingFeatures(prev => new Set(prev).add(epic.epic_id))

    try {
      // Find governance summaries referenced by this epic
      const summaries = output.epics
        .filter(e => e.epic_id === epic.epic_id)
        .flatMap(e => e.governance_references)

      const response = await fetch(`/api/epics/${epic.epic_id}/generate-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epic,
          // For now, pass empty summaries - in production this would come from retrieving from MinIO
          // based on the governance_references
          summaries: output.epics
            .flatMap(e => 
              e.governance_references.map(ref => ({
                section_id: ref,
                title: `Section: ${ref}`,
                obligations: [],
                outcomes: [],
                actors: [],
                constraints: []
              }))
            )
        }),
      })

      const data: GeneratedFeatureResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.ok === false ? (typeof data === 'object' && 'error' in data ? (data as any).error : 'Failed to generate features') : 'Failed to generate features')
      }

      // Add generated features to output and group by epic
      const newFeatures = data.features as FeatureWithStories[]
      const updatedFeatures = [...(output.features as FeatureWithStories[]), ...newFeatures]
      const newFeaturesByEpic = new Map(featuresByEpic)
      newFeaturesByEpic.set(epic.epic_id, newFeatures)

      setOutput({ ...output, features: updatedFeatures })
      setFeaturesByEpic(newFeaturesByEpic)
    } catch (err) {
      console.error('Failed to generate features:', err)
      alert(`Error generating features: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setGeneratingFeatures(prev => {
        const next = new Set(prev)
        next.delete(epic.epic_id)
        return next
      })
    }
  }

  const createStoriesForFeature = async (feature: FeatureWithStories, epic: EpicData) => {
    if (!output) return

    // Update feature state to loading in featuresByEpic
    const updatedFeaturesByEpic = new Map(featuresByEpic)
    const epicFeatures = updatedFeaturesByEpic.get(epic.epic_id) || []
    updatedFeaturesByEpic.set(
      epic.epic_id,
      epicFeatures.map(f =>
        f.feature_id === feature.feature_id
          ? { ...f, storiesLoading: true, storiesError: undefined }
          : f
      )
    )
    setFeaturesByEpic(updatedFeaturesByEpic)

    try {
      const res = await fetch(`/api/features/${feature.feature_id}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature,
          epic,
          governanceContent: output.markdown.content,
          projectId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create stories')
      }

      console.log('[UI] Stories received:', data.stories)

      // Validate stories array
      if (!data.stories || !Array.isArray(data.stories) || data.stories.length === 0) {
        throw new Error('No stories were generated. The feature may not have sufficient criteria.')
      }

      // Update feature with generated stories in featuresByEpic
      const updatedFeaturesByEpic2 = new Map(featuresByEpic)
      const epicFeatures2 = updatedFeaturesByEpic2.get(epic.epic_id) || []
      updatedFeaturesByEpic2.set(
        epic.epic_id,
        epicFeatures2.map(f =>
          f.feature_id === feature.feature_id
            ? { ...f, stories: data.stories, storiesLoading: false, storiesError: undefined }
            : f
        )
      )
      setFeaturesByEpic(updatedFeaturesByEpic2)
      
      // Expand the feature to show stories
      const newExpanded = new Set(expandedFeatures)
      newExpanded.add(feature.feature_id)
      setExpandedFeatures(newExpanded)
      
      console.log('[UI] Stories created for feature:', feature.feature_id)
    } catch (err) {
      const errorMsg = (err as Error).message
      console.error('[UI] Story creation failed:', errorMsg)
      
      // Update feature error state
      const updatedFeaturesByEpic3 = new Map(featuresByEpic)
      const epicFeatures3 = updatedFeaturesByEpic3.get(epic.epic_id) || []
      updatedFeaturesByEpic3.set(
        epic.epic_id,
        epicFeatures3.map(f =>
          f.feature_id === feature.feature_id
            ? { ...f, storiesLoading: false, storiesError: errorMsg, stories: undefined }
            : f
        )
      )
      setFeaturesByEpic(updatedFeaturesByEpic3)
    }
  }

  const deleteStoriesForFeature = async (feature: FeatureWithStories) => {
    if (!output) return

    try {
      const res = await fetch(`/api/features/${feature.feature_id}/stories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyPath: `docs/stories/${feature.feature_id}-stories.md`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete stories')
      }

      // Remove stories from feature in featuresByEpic
      const updatedFeaturesByEpic = new Map(featuresByEpic)
      const epicFeatures = updatedFeaturesByEpic.get(feature.epic_id) || []
      updatedFeaturesByEpic.set(
        feature.epic_id,
        epicFeatures.map(f =>
          f.feature_id === feature.feature_id
            ? { ...f, stories: undefined }
            : f
        )
      )
      setFeaturesByEpic(updatedFeaturesByEpic)
    } catch (err) {
      const errorMsg = (err as Error).message
      alert(`Failed to delete stories: ${errorMsg}`)
    }
  }

  const generatePromptForStory = async (story: StoryWithPrompts, feature: FeatureWithStories, epic: EpicData) => {
    if (!output) return

    // Validation: Ensure Epic and Feature references are resolved (not undefined)
    if (!epic || !epic.epic_id) {
      alert('Error: Epic reference is missing. Cannot generate prompt without proper context.')
      return
    }

    if (!feature || !feature.feature_id) {
      alert('Error: Feature reference is missing. Cannot generate prompt without proper context.')
      return
    }

    // Update story state to loading in featuresByEpic
    const updatedFeaturesByEpic = new Map(featuresByEpic)
    const epicFeatures = updatedFeaturesByEpic.get(epic.epic_id) || []
    updatedFeaturesByEpic.set(
      epic.epic_id,
      epicFeatures.map(f =>
        f.feature_id === feature.feature_id
          ? {
              ...f,
              stories: (f.stories || []).map(s =>
                s.story_id === story.story_id
                  ? { ...s, promptsLoading: true, promptsError: undefined }
                  : s
              ),
            }
          : f
      )
    )
    setFeaturesByEpic(updatedFeaturesByEpic)

    try {
      const res = await fetch(`/api/stories/${story.story_id}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          feature: {
            feature_id: feature.feature_id,
            title: feature.title,
          },
          epic: {
            epic_id: epic.epic_id,
            title: epic.title,
          },
          governanceMarkdown: output.markdown.content,
          repoUrl: 'https://github.com/dgaspard/muse',
          defaultBranch: 'main',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate prompt')
      }

      // Create AIPrompt object (separate from story)
      const newPrompt: AIPrompt = {
        prompt_id: `prompt-${story.story_id}-${Date.now()}`,
        story_id: story.story_id,
        feature_id: feature.feature_id,
        epic_id: epic.epic_id,
        content: data.prompt,
        role: 'Software Engineer', // Extract from template if needed
        task: 'Implement feature from user story',
        generated_at: new Date().toISOString(),
        template: 'Prompt-muse-User-Story-Implementation-PR',
      }

      // Update story with new prompt in featuresByEpic
      const updatedFeaturesByEpic2 = new Map(featuresByEpic)
      const epicFeatures2 = updatedFeaturesByEpic2.get(epic.epic_id) || []
      updatedFeaturesByEpic2.set(
        epic.epic_id,
        epicFeatures2.map(f =>
          f.feature_id === feature.feature_id
            ? {
                ...f,
                stories: (f.stories || []).map(s =>
                  s.story_id === story.story_id
                    ? {
                        ...s,
                        prompts: [...(s.prompts || []), newPrompt],
                        activePromptId: newPrompt.prompt_id,
                        promptsLoading: false,
                        promptsError: undefined,
                        promptsExpanded: true,
                      }
                    : s
                ),
              }
            : f
        )
      )
      setFeaturesByEpic(updatedFeaturesByEpic2)
    } catch (err) {
      const errorMsg = (err as Error).message
      const updatedFeaturesByEpic3 = new Map(featuresByEpic)
      const epicFeatures3 = updatedFeaturesByEpic3.get(epic.epic_id) || []
      updatedFeaturesByEpic3.set(
        epic.epic_id,
        epicFeatures3.map(f =>
          f.feature_id === feature.feature_id
            ? {
                ...f,
                stories: (f.stories || []).map(s =>
                  s.story_id === story.story_id
                    ? { ...s, promptsLoading: false, promptsError: errorMsg }
                    : s
                ),
              }
            : f
        )
      )
      setFeaturesByEpic(updatedFeaturesByEpic3)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatEpicForCopy = (epic: EpicData): string => {
    return `# Epic: ${epic.title}

ID: ${epic.epic_id}

## Objective
${epic.objective}

## Success Criteria
${epic.success_criteria.map(c => `- ${c}`).join('\n')}

## Governance References
${epic.governance_references.map(r => `- ${r}`).join('\n')}`
  }

  const formatFeatureForCopy = (feature: FeatureData): string => {
    return `# Feature: ${feature.title}

ID: ${feature.feature_id}
Epic: ${feature.epic_id}

## Description
${feature.description}

## Acceptance Criteria
${feature.acceptance_criteria.map(c => `- ${c}`).join('\n')}

## Governance References
${feature.governance_references.map(r => `- ${r}`).join('\n')}`
  }

  const formatStoryForCopy = (story: StoryData): string => {
    return `# User Story: ${story.title}

ID: ${story.story_id}
Epic: ${story.derived_from_epic}
Feature: ${story.derived_from_feature}

## Story
**As a** ${story.role}
**I want** ${story.capability}
**So that** ${story.benefit}

## Acceptance Criteria
${story.acceptance_criteria.map(c => `- ${c}`).join('\n')}

## Governance References
${story.governance_references.map(r => `- ${r}`).join('\n')}`
  }

  const addFeatureToBacklog = async (
    feature: FeatureData,
    epic: EpicData
  ): Promise<void> => {
    try {
      // Add to loading set and trigger re-render
      const updatedLoading = new Set(addingToBacklog)
      updatedLoading.add(feature.feature_id)
      setAddingToBacklog(updatedLoading)
      
      setBacklogMessage({ type: 'loading', text: 'Materializing artifacts to /docs...' })

      // Get stories and prompts for this feature
      const featuresForEpic = featuresByEpic.get(epic.epic_id) || []
      const featureData = featuresForEpic.find(f => f.feature_id === feature.feature_id)
      const stories = featureData?.stories || []
      
      // Extract all prompts from all stories for this feature
      const prompts: AIPrompt[] = []
      stories.forEach(story => {
        if (story.prompts) {
          prompts.push(...story.prompts)
        }
      })

      const response = await fetch(
        `/api/features/${feature.feature_id}/materialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feature,
            epic,
            stories,
            prompts,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(
          data.error || `HTTP ${response.status}: Failed to materialize artifacts`
        )
      }

      const data = await response.json()
      setBacklogMessage({
        type: 'success',
        text: `Artifacts materialized to /docs`,
      })

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setBacklogMessage({ type: '', text: '' })
        const updatedDone = new Set(addingToBacklog)
        updatedDone.delete(feature.feature_id)
        setAddingToBacklog(updatedDone)
      }, 3000)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setBacklogMessage({ type: 'error', text: errorMsg })
      const updatedError = new Set(addingToBacklog)
      updatedError.delete(feature.feature_id)
      setAddingToBacklog(updatedError)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    const fd = new FormData()
    fd.append('projectId', projectId)
    fd.append('file', file)

    setStage('uploading')
    setError(null)
    setOutput(null)

    try {
      // Execute full pipeline via API
      setStage('converting')
      const res = await fetch('/api/pipeline/execute', {
        method: 'POST',
        body: fd,
      })

      // Read response as text first (can only read body once)
      const responseText = await res.text()

      // Check if response is OK
      if (!res.ok) {
        let errorMessage = `Server error: ${res.status} ${res.statusText}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorMessage
          if (errorData.validationBlockedPipeline && errorData.details) {
            errorMessage = `Validation Failed: ${errorData.details}\n\nYour document must:\n- Be at least 500 characters\n- Follow governance document standards`
          }
        } catch {
          // Response is not JSON, use plain text
          if (responseText) errorMessage = responseText
        }
        throw new Error(errorMessage)
      }

      // Parse successful response as JSON
      const data = JSON.parse(responseText)

      if (!data.ok) {
        // Improve error messaging for validation failures
        let errorMessage = data.error || 'Pipeline execution failed'
        if (data.validationBlockedPipeline && data.details) {
          errorMessage = `Validation Failed: ${data.details}\n\nYour document must:\n- Be at least 500 characters\n- Follow governance document standards`
        }
        throw new Error(errorMessage)
      }

      setStage('complete')
      setOutput(data as PipelineOutput)
    } catch (err) {
      setStage('error')
      setError((err as Error).message || 'Unknown error')
    }
  }

  const renderStageIndicator = () => {
    const stages: { key: PipelineStage; label: string }[] = [
      { key: 'uploading', label: 'Uploading Document' },
      { key: 'converting', label: 'Converting to Markdown' },
      { key: 'deriving-epic', label: 'Deriving Epics' },
    ]

    const currentIndex = stages.findIndex(s => s.key === stage)

    return (
      <div style={{ marginBottom: 24 }}>
        {stages.map((s, index) => (
          <div
            key={s.key}
            style={{
              padding: '8px 12px',
              marginBottom: 4,
              borderLeft: index <= currentIndex ? '4px solid #4CAF50' : '4px solid #DDD',
              backgroundColor: index === currentIndex ? '#F0F8FF' : '#FFF',
              color: index <= currentIndex ? '#000' : '#999',
            }}
          >
            {s.label} {index === currentIndex && '⏳'}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Muse — Governance-to-Delivery Pipeline</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Upload a governance document to derive Epic, Features, and User Stories. All artifacts are generated from the
        governance source and can be reviewed before use.
      </p>

      <form onSubmit={onSubmit} style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Project ID
            <input
              value={projectId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectId(e.target.value)}
              style={{ marginLeft: 8, padding: 4 }}
              disabled={stage !== 'idle' && stage !== 'error' && stage !== 'complete'}
            />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            Governance Document
            <input
              type="file"
              accept=".docx,application/pdf,.txt"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ marginLeft: 8 }}
              disabled={stage !== 'idle' && stage !== 'error' && stage !== 'complete'}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={stage !== 'idle' && stage !== 'error' && stage !== 'complete'}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Execute Pipeline
        </button>
      </form>

      {(stage === 'uploading' || stage === 'converting' || stage === 'deriving-epic') && renderStageIndicator()}

      {error && (
        <div style={{ padding: 16, backgroundColor: '#FFEBEE', border: '1px solid #F44336', marginBottom: 24 }}>
          <strong>Error:</strong>
          <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'monospace', fontSize: 12 }}>
            {error}
          </pre>
        </div>
      )}

      {backlogMessage.text && (
        <div style={{ 
          padding: 16, 
          backgroundColor: backlogMessage.type === 'error' ? '#FFEBEE' : backlogMessage.type === 'success' ? '#E8F5E9' : '#FFF9C4',
          border: `1px solid ${backlogMessage.type === 'error' ? '#F44336' : backlogMessage.type === 'success' ? '#4CAF50' : '#FBC02D'}`,
          marginBottom: 24,
          borderRadius: 4
        }}>
          {backlogMessage.type === 'loading' && '⏳ '}
          {backlogMessage.type === 'success' && '✅ '}
          {backlogMessage.type === 'error' && '❌ '}
          {backlogMessage.text}
        </div>
      )}

      {output && (
        <>
          {/* Document Info */}
          <div style={{ marginBottom: 32, padding: 16, backgroundColor: '#F5F5F5', borderRadius: 4 }}>
            <h3>Document</h3>
            <p>
              <strong>Filename:</strong> {output.document.original_filename}
            </p>
            <p>
              <strong>Document ID:</strong> {output.document.document_id}
            </p>
          </div>

          {/* Governance Markdown (collapsible) */}
          <div style={{ marginBottom: 32 }}>
            <button
              onClick={() => setShowMarkdown(!showMarkdown)}
              style={{ padding: '8px 16px', cursor: 'pointer', marginBottom: 8 }}
            >
              {showMarkdown ? 'Hide' : 'Show'} Governance Markdown
            </button>
            {showMarkdown && (
              <div style={{ padding: 16, backgroundColor: '#FAFAFA', border: '1px solid #DDD', overflowX: 'auto' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{output.markdown.content}</pre>
              </div>
            )}
          </div>

          {/* Epics */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ marginBottom: 16 }}>Epics ({output.epics.length})</h2>
            {output.epics.map((epic, index) => (
              <div 
                key={epic.epic_id} 
                style={{ 
                  marginBottom: 24, 
                  padding: 16, 
                  border: '2px solid #2196F3', 
                  borderRadius: 4,
                  backgroundColor: index % 2 === 0 ? '#F5F9FF' : '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0' }}>Epic {index + 1}: {epic.title}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => generateFeaturesForEpic(epic)}
                      disabled={generatingFeatures.has(epic.epic_id)}
                      style={{ 
                        padding: '6px 12px', 
                        backgroundColor: generatingFeatures.has(epic.epic_id) ? '#ccc' : '#4CAF50', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 2, 
                        cursor: generatingFeatures.has(epic.epic_id) ? 'not-allowed' : 'pointer' 
                      }}
                    >
                      {generatingFeatures.has(epic.epic_id) ? '⏳ Generating...' : '✨ Generate Features'}
                    </button>
                    <button onClick={() => copyToClipboard(formatEpicForCopy(epic))} style={{ padding: '6px 12px' }}>
                      📋 Copy Epic
                    </button>
                  </div>
                </div>
                <p>
                  <strong>ID:</strong> {epic.epic_id}
                </p>
                <h4>Objective</h4>
                <p>{epic.objective}</p>
                <h4>Success Criteria</h4>
                <ul>
                  {epic.success_criteria.map((criterion, i) => (
                    <li key={i}>{criterion}</li>
                  ))}
                </ul>
                <h4>Governance References</h4>
                <ul>
                  {epic.governance_references.map((ref, i) => (
                    <li key={i}>{ref}</li>
                  ))}
                </ul>

                {/* Inline Features for this Epic */}
                {featuresByEpic.get(epic.epic_id) && featuresByEpic.get(epic.epic_id)!.length > 0 && (
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px solid #E3F2FD' }}>
                    <h4 style={{ color: '#2196F3' }}>Generated Features ({featuresByEpic.get(epic.epic_id)!.length})</h4>
                    {featuresByEpic.get(epic.epic_id)!.map((feature, fIdx) => (
                      <div key={fIdx} style={{ marginBottom: 16, padding: 12, backgroundColor: '#F5F9FF', border: '1px solid #90CAF9', borderRadius: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: '0 0 6px 0', color: '#1976D2' }}>{feature.title}</h5>
                            <p style={{ margin: '4px 0', fontSize: 13, color: '#555' }}>
                              <strong>ID:</strong> {feature.feature_id}
                            </p>
                            <p style={{ margin: '8px 0 4px 0', fontSize: 13 }}>{feature.description}</p>
                            <div style={{ marginTop: 8 }}>
                              <strong style={{ fontSize: 12 }}>Acceptance Criteria:</strong>
                              <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 12 }}>
                                {feature.acceptance_criteria.map((criterion, k) => (
                                  <li key={k}>{criterion}</li>
                                ))}
                              </ul>
                            </div>
                            {feature.governance_references.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <strong style={{ fontSize: 12 }}>Governance References:</strong>
                                <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 11, color: '#666' }}>
                                  {feature.governance_references.map((ref, k) => (
                                    <li key={k}>{ref}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => copyToClipboard(formatFeatureForCopy(feature))} 
                            style={{ padding: '4px 8px', marginLeft: 8, whiteSpace: 'nowrap', fontSize: 12 }}
                          >
                            📋 Copy
                          </button>
                          <button 
                            onClick={() => addFeatureToBacklog(feature, epic)}
                            disabled={addingToBacklog.has(feature.feature_id)}
                            style={{ 
                              padding: '4px 8px', 
                              marginLeft: 8, 
                              whiteSpace: 'nowrap', 
                              fontSize: 12,
                              backgroundColor: addingToBacklog.has(feature.feature_id) ? '#ccc' : '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: 2,
                              cursor: addingToBacklog.has(feature.feature_id) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {addingToBacklog.has(feature.feature_id) ? '⏳' : '📄'} Materialize
                          </button>
                        </div>

                        {/* Story Generation Button */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E3F2FD' }}>
                          {!feature.stories && (
                            <button
                              onClick={() => createStoriesForFeature(feature, epic)}
                              disabled={feature.storiesLoading}
                              style={{ 
                                padding: '6px 12px', 
                                backgroundColor: feature.storiesLoading ? '#ccc' : '#2196F3', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: 2, 
                                cursor: feature.storiesLoading ? 'not-allowed' : 'pointer',
                                fontSize: 12
                              }}
                            >
                              {feature.storiesLoading ? '⏳ Generating...' : '✨ Generate User Stories'}
                            </button>
                          )}
                          
                          {/* Display Generated Stories */}
                          {feature.stories && feature.stories.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <button
                                onClick={() => toggleFeatureExpanded(feature.feature_id)}
                                style={{ 
                                  padding: '8px 12px', 
                                  backgroundColor: '#f5f5f5', 
                                  border: '1px solid #ddd', 
                                  borderRadius: 2, 
                                  cursor: 'pointer', 
                                  width: '100%', 
                                  textAlign: 'left', 
                                  fontWeight: 'bold',
                                  fontSize: 12
                                }}
                              >
                                {expandedFeatures.has(feature.feature_id) ? '▼' : '▶'} User Stories ({feature.stories.length})
                              </button>
                              {expandedFeatures.has(feature.feature_id) && (
                                <div style={{ marginTop: 8 }}>
                                  {feature.stories.map((story, j) => (
                                    <div key={j} style={{ marginBottom: 10, padding: 10, backgroundColor: '#fff', border: '1px solid #E3F2FD', borderRadius: 2 }}>
                                      <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: 12, color: '#1976D2' }}>
                                        {story.title}
                                      </p>
                                      <p style={{ margin: '4px 0', fontSize: 11, color: '#666' }}>
                                        <strong>ID:</strong> {story.story_id}
                                      </p>
                                      <p style={{ margin: '4px 0', fontSize: 11 }}>
                                        <strong>As a</strong> {story.role}, <strong>I want</strong> {story.capability}, <strong>so that</strong> {story.benefit}.
                                      </p>
                                      {story.acceptance_criteria.length > 0 && (
                                        <div style={{ marginTop: 6 }}>
                                          <strong style={{ fontSize: 10 }}>Acceptance Criteria:</strong>
                                          <ul style={{ margin: '3px 0', paddingLeft: 18, fontSize: 10 }}>
                                            {story.acceptance_criteria.map((criterion, k) => (
                                              <li key={k}>{criterion}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                        <button 
                                          onClick={() => copyToClipboard(formatStoryForCopy(story))} 
                                          style={{ padding: '3px 6px', fontSize: 10 }}
                                        >
                                          📋 Copy
                                        </button>
                                        <button 
                                          onClick={() => generatePromptForStory(story as StoryWithPrompts, feature, epic)}
                                          disabled={(story as StoryWithPrompts).promptsLoading}
                                          style={{ 
                                            padding: '3px 6px', 
                                            fontSize: 10,
                                            backgroundColor: (story as StoryWithPrompts).promptsLoading ? '#ccc' : '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 2,
                                            cursor: (story as StoryWithPrompts).promptsLoading ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {(story as StoryWithPrompts).promptsLoading ? '⏳ Generating...' : '📝 Generate AI Prompt'}
                                        </button>
                                      </div>

                                      {/* AI Prompts Section: Separate from Story artifact */}
                                      {((story as StoryWithPrompts).prompts && (story as StoryWithPrompts).prompts!.length > 0) && (
                                        <div style={{ marginTop: 12, padding: 8, backgroundColor: '#F9F9F9', border: '1px solid #2196F3', borderRadius: 2 }}>
                                          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#1976D2', marginBottom: 6 }}>
                                            🤖 AI Prompts ({(story as StoryWithPrompts).prompts!.length})
                                          </div>
                                          {(story as StoryWithPrompts).prompts!.map((prompt, pIdx) => (
                                            <div key={pIdx} style={{ marginBottom: 8, padding: 6, backgroundColor: '#FFF', border: '1px solid #90CAF9', borderRadius: 2 }}>
                                              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                                <strong>Type:</strong> {prompt.template.replace('Prompt-muse-', '').replace('-', ' ')} 
                                                {' '}
                                                <span style={{ fontSize: 9, color: '#999' }}>({new Date(prompt.generated_at).toLocaleDateString()})</span>
                                              </div>
                                              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
                                                <strong>Role:</strong> {prompt.role} | <strong>Task:</strong> {prompt.task}
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const updatedFeaturesByEpic = new Map(featuresByEpic)
                                                  const epicFeatures = updatedFeaturesByEpic.get(feature.epic_id) || []
                                                  updatedFeaturesByEpic.set(
                                                    feature.epic_id,
                                                    epicFeatures.map(f =>
                                                      f.feature_id === feature.feature_id
                                                        ? {
                                                            ...f,
                                                            stories: (f.stories || []).map(s =>
                                                              s.story_id === story.story_id
                                                                ? { 
                                                                    ...s, 
                                                                    promptsExpanded: (s as StoryWithPrompts).activePromptId === prompt.prompt_id ? false : true,
                                                                    activePromptId: prompt.prompt_id
                                                                  }
                                                                : s
                                                            ),
                                                          }
                                                        : f
                                                    )
                                                  )
                                                  setFeaturesByEpic(updatedFeaturesByEpic)
                                                }}
                                                style={{
                                                  padding: '3px 6px',
                                                  backgroundColor: (story as StoryWithPrompts).activePromptId === prompt.prompt_id ? '#2196F3' : '#E3F2FD',
                                                  border: '1px solid #1976D2',
                                                  borderRadius: 2,
                                                  cursor: 'pointer',
                                                  fontSize: 9,
                                                  fontWeight: 'bold',
                                                  color: (story as StoryWithPrompts).activePromptId === prompt.prompt_id ? '#FFF' : '#1976D2',
                                                }}
                                              >
                                                {(story as StoryWithPrompts).activePromptId === prompt.prompt_id ? '▼ Hide' : '▶ Show'}
                                              </button>
                                              <button 
                                                onClick={() => copyToClipboard(prompt.content)} 
                                                style={{ padding: '3px 6px', marginLeft: 4, fontSize: 9 }}
                                              >
                                                📋 Copy
                                              </button>
                                              {(story as StoryWithPrompts).activePromptId === prompt.prompt_id && (story as StoryWithPrompts).promptsExpanded && (
                                                <div style={{ marginTop: 6, padding: 8, backgroundColor: '#F5F5F5', borderRadius: 2, border: '1px solid #ddd', fontSize: 9, maxHeight: 350, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                                  {prompt.content}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {(story as StoryWithPrompts).promptsError && (
                                        <div style={{ marginTop: 8, padding: 8, backgroundColor: '#FFEBEE', border: '1px solid #F44336', borderRadius: 2, color: '#C62828', fontSize: 10 }}>
                                          <strong>Prompt Error:</strong> {(story as StoryWithPrompts).promptsError}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => deleteStoriesForFeature(feature)}
                                style={{ 
                                  padding: '4px 8px', 
                                  backgroundColor: '#F44336', 
                                  color: 'white', 
                                  border: 'none', 
                                  borderRadius: 2, 
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  marginTop: 8
                                }}
                              >
                                🗑️ Delete Stories
                              </button>
                            </div>
                          )}

                          {feature.storiesError && (
                            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#FFEBEE', border: '1px solid #F44336', borderRadius: 2, color: '#C62828', fontSize: 12 }}>
                              <strong>Error:</strong> {feature.storiesError}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: 16, backgroundColor: '#FFF3E0', border: '1px solid #FF9800', marginTop: 32 }}>
            <strong>Note:</strong> These artifacts are derived from the governance document and are for review purposes.
            They are not authoritative until committed to your project repository or imported into your workflow tools.
          </div>
        </>
      )}
    </div>
  )
}
