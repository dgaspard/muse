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

interface StoryData {
  story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  acceptance_criteria: string[]
  derived_from_feature: string
  derived_from_epic: string
  governance_references: string[]
}

interface FeatureWithStories extends FeatureData {
  stories?: StoryData[]
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
  epic: EpicData
  features: FeatureData[]
  stories: StoryData[]
}

type PipelineStage = 'idle' | 'uploading' | 'converting' | 'deriving-epic' | 'deriving-features' | 'deriving-stories' | 'complete' | 'error'

export default function GovernanceWorkflowPage(): JSX.Element {
  const [projectId, setProjectId] = useState<string>('demo-project')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<PipelineOutput | null>(null)
  const [showMarkdown, setShowMarkdown] = useState<boolean>(false)
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())

  const toggleFeatureExpanded = (featureId: string) => {
    const newExpanded = new Set(expandedFeatures)
    if (newExpanded.has(featureId)) {
      newExpanded.delete(featureId)
    } else {
      newExpanded.add(featureId)
    }
    setExpandedFeatures(newExpanded)
  }

  const createStoriesForFeature = async (feature: FeatureWithStories) => {
    if (!output) return

    // Update feature state to loading
    const updatedFeatures = output.features.map(f => 
      f.feature_id === feature.feature_id 
        ? { ...f, storiesLoading: true, storiesError: undefined } 
        : f
    ) as FeatureWithStories[]
    
    setOutput({ ...output, features: updatedFeatures })

    try {
      const res = await fetch(`/api/features/${feature.feature_id}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featurePath: `docs/features/${feature.epic_id}-${feature.feature_id.split('-').slice(-1)[0]}.md`,
          governancePath: output.markdown.path,
          projectId,
          epicId: feature.epic_id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create stories')
      }

      console.log('[UI] Stories received:', data.stories)

      // Validate stories array
      if (!data.stories || !Array.isArray(data.stories) || data.stories.length === 0) {
        throw new Error('No stories were generated. The feature may not have sufficient acceptance criteria.')
      }

      // Update feature with generated stories
      const updatedFeatures2 = output.features.map(f =>
        f.feature_id === feature.feature_id
          ? { ...f, stories: data.stories, storiesLoading: false, storiesError: undefined }
          : f
      ) as FeatureWithStories[]

      setOutput({ ...output, features: updatedFeatures2 })
      
      // Expand the feature to show stories
      const newExpanded = new Set(expandedFeatures)
      newExpanded.add(feature.feature_id)
      setExpandedFeatures(newExpanded)
      
      console.log('[UI] Stories created and expanded for feature:', feature.feature_id)
    } catch (err) {
      const errorMsg = (err as Error).message
      console.error('[UI] Story creation failed:', errorMsg)
      const updatedFeatures3 = output.features.map(f =>
        f.feature_id === feature.feature_id
          ? { ...f, storiesLoading: false, storiesError: errorMsg, stories: undefined }
          : f
      ) as FeatureWithStories[]

      setOutput({ ...output, features: updatedFeatures3 })
    }
  }

  const deleteStoriesForFeature = async (feature: FeatureWithStories) => {
    if (!output) return

    try {
      const res = await fetch(`/api/features/${feature.feature_id}/stories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyPath: `docs/stories/${feature.epic_id}-stories.md`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete stories')
      }

      // Remove stories from feature
      const updatedFeatures = output.features.map(f =>
        f.feature_id === feature.feature_id
          ? { ...f, stories: undefined }
          : f
      ) as FeatureWithStories[]

      setOutput({ ...output, features: updatedFeatures })
    } catch (err) {
      const errorMsg = (err as Error).message
      alert(`Failed to delete stories: ${errorMsg}`)
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
      { key: 'deriving-epic', label: 'Deriving Epic' },
      { key: 'deriving-features', label: 'Deriving Features' },
      { key: 'deriving-stories', label: 'Deriving User Stories' },
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

      {(stage === 'uploading' || stage === 'converting' || stage === 'deriving-epic' || stage === 'deriving-features' || stage === 'deriving-stories') && renderStageIndicator()}

      {error && (
        <div style={{ padding: 16, backgroundColor: '#FFEBEE', border: '1px solid #F44336', marginBottom: 24 }}>
          <strong>Error:</strong>
          <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'monospace', fontSize: 12 }}>
            {error}
          </pre>
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

          {/* Epic */}
          <div style={{ marginBottom: 32, padding: 16, border: '2px solid #2196F3', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Epic: {output.epic.title}</h2>
              <button onClick={() => copyToClipboard(formatEpicForCopy(output.epic))} style={{ padding: '6px 12px' }}>
                📋 Copy Epic
              </button>
            </div>
            <p>
              <strong>ID:</strong> {output.epic.epic_id}
            </p>
            <h3>Objective</h3>
            <p>{output.epic.objective}</p>
            <h3>Success Criteria</h3>
            <ul>
              {output.epic.success_criteria.map((criterion, i) => (
                <li key={i}>{criterion}</li>
              ))}
            </ul>
            <h3>Governance References</h3>
            <ul>
              {output.epic.governance_references.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Features ({output.features.length})</h2>
              <button
                onClick={() => copyToClipboard(output.features.map(formatFeatureForCopy).join('\n\n---\n\n'))}
                style={{ padding: '6px 12px' }}
              >
                📋 Copy All Features
              </button>
            </div>
            {(output.features as FeatureWithStories[]).map((feature, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 16, border: '1px solid #4CAF50', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{feature.title}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => copyToClipboard(formatFeatureForCopy(feature))} style={{ padding: '4px 8px' }}>
                      📋 Copy
                    </button>
                    {!feature.stories && (
                      <button
                        onClick={() => createStoriesForFeature(feature)}
                        disabled={feature.storiesLoading}
                        style={{ padding: '4px 8px', backgroundColor: feature.storiesLoading ? '#ccc' : '#2196F3', color: 'white', border: 'none', borderRadius: 2, cursor: feature.storiesLoading ? 'not-allowed' : 'pointer' }}
                      >
                        {feature.storiesLoading ? '⏳ Creating...' : '✨ Create Stories'}
                      </button>
                    )}
                    {feature.stories && (
                      <button
                        onClick={() => deleteStoriesForFeature(feature)}
                        style={{ padding: '4px 8px', backgroundColor: '#F44336', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      >
                        🗑️ Delete Stories
                      </button>
                    )}
                  </div>
                </div>
                <p>
                  <strong>ID:</strong> {feature.feature_id} | <strong>Epic:</strong> {feature.epic_id}
                </p>
                <h4>Description</h4>
                <p>{feature.description}</p>
                <h4>Acceptance Criteria</h4>
                <ul>
                  {feature.acceptance_criteria.map((criterion, j) => (
                    <li key={j}>{criterion}</li>
                  ))}
                </ul>
                <h4>Governance References</h4>
                <ul>
                  {feature.governance_references.map((ref, j) => (
                    <li key={j}>{ref}</li>
                  ))}
                </ul>

                {/* User Stories Section (Expandable) */}
                {feature.stories && feature.stories.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                    <button
                      onClick={() => toggleFeatureExpanded(feature.feature_id)}
                      style={{ padding: '8px 12px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 'bold' }}
                    >
                      {expandedFeatures.has(feature.feature_id) ? '▼' : '▶'} User Stories ({feature.stories.length})
                    </button>
                    {expandedFeatures.has(feature.feature_id) && (
                      <div style={{ marginTop: 12 }}>
                        {feature.stories.map((story, j) => (
                          <div key={j} style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <div style={{ flex: 1 }}>
                                <h5 style={{ margin: '0 0 8px 0' }}>{story.title}</h5>
                                <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                                  <strong>ID:</strong> {story.story_id}
                                </p>
                                <p style={{ margin: '4px 0' }}>
                                  <strong>As a</strong> {story.role}, <strong>I want</strong> {story.capability}, <strong>so that</strong> {story.benefit}.
                                </p>
                                <h6 style={{ margin: '8px 0 4px 0' }}>Acceptance Criteria</h6>
                                <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 12 }}>
                                  {story.acceptance_criteria.map((criterion, k) => (
                                    <li key={k}>{criterion}</li>
                                  ))}
                                </ul>
                              </div>
                              <button onClick={() => copyToClipboard(formatStoryForCopy(story))} style={{ padding: '4px 8px', marginLeft: 8, whiteSpace: 'nowrap' }}>
                                📋
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Debug info */}
                {feature.stories && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#E3F2FD', border: '1px solid #2196F3', borderRadius: 2, fontSize: 11 }}>
                    <strong>Debug:</strong> {feature.stories.length} stories loaded, expanded={String(expandedFeatures.has(feature.feature_id))}
                  </div>
                )}

                {feature.storiesError && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: '#FFEBEE', border: '1px solid #F44336', borderRadius: 2, color: '#C62828' }}>
                    <strong>Error:</strong> {feature.storiesError}
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
