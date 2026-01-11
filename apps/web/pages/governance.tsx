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
            {output.features.map((feature, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 16, border: '1px solid #4CAF50', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{feature.title}</h3>
                  <button onClick={() => copyToClipboard(formatFeatureForCopy(feature))} style={{ padding: '4px 8px' }}>
                    📋 Copy
                  </button>
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
              </div>
            ))}
          </div>

          {/* User Stories */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>User Stories ({output.stories.length})</h2>
              <button
                onClick={() => copyToClipboard(output.stories.map(formatStoryForCopy).join('\n\n---\n\n'))}
                style={{ padding: '6px 12px' }}
              >
                📋 Copy All Stories
              </button>
            </div>
            {output.stories.map((story, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 16, border: '1px solid #FF9800', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>{story.title}</h3>
                  <button onClick={() => copyToClipboard(formatStoryForCopy(story))} style={{ padding: '4px 8px' }}>
                    📋 Copy
                  </button>
                </div>
                <p>
                  <strong>ID:</strong> {story.story_id} | <strong>Epic:</strong> {story.derived_from_epic} |{' '}
                  <strong>Feature:</strong> {story.derived_from_feature}
                </p>
                <h4>Story</h4>
                <p>
                  <strong>As a</strong> {story.role}
                  <br />
                  <strong>I want</strong> {story.capability}
                  <br />
                  <strong>So that</strong> {story.benefit}
                </p>
                <h4>Acceptance Criteria</h4>
                <ul>
                  {story.acceptance_criteria.map((criterion, j) => (
                    <li key={j}>{criterion}</li>
                  ))}
                </ul>
                <h4>Governance References</h4>
                <ul>
                  {story.governance_references.map((ref, j) => (
                    <li key={j}>{ref}</li>
                  ))}
                </ul>
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
