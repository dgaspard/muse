# MUSE Technical Architecture
## Governance-to-Delivery Pipeline — Architect's Reference

**Document Type:** Technical Architecture  
**Audience:** Software Architects, Senior Engineers, Technical Leads  
**Version:** 1.0  
**Date:** January 25, 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Component Architecture](#component-architecture)
4. [Data Flow & Sequence Diagrams](#data-flow--sequence-diagrams)
5. [API Specifications](#api-specifications)
6. [Data Models & Schemas](#data-models--schemas)
7. [AI Agent Architecture](#ai-agent-architecture)
8. [Storage Architecture](#storage-architecture)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Performance & Scalability](#performance--scalability)
11. [Testing Strategy](#testing-strategy)
12. [Security Architecture](#security-architecture)
13. [Deployment Architecture](#deployment-architecture)
14. [Technical Decisions & Rationale](#technical-decisions--rationale)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Tier                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 13 (React 18)                                    │  │
│  │  - SSR/SSG hybrid                                         │  │
│  │  - TypeScript 5.x                                         │  │
│  │  - Tailwind CSS for styling                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Tier                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js (Node.js 20 LTS)                             │  │
│  │  - TypeScript                                             │  │
│  │  - Rate limiting (express-rate-limit)                    │  │
│  │  - CORS enabled (prototype mode)                         │  │
│  │  - Multer for multipart/form-data                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MusePipelineOrchestrator (Coordination Layer)           │  │
│  │  - Sequential pipeline execution                         │  │
│  │  - Fail-fast error propagation                           │  │
│  │  - AI agent orchestration                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬────────────────┬────────────────┬─────────────────┘
             │                │                │
             ▼                ▼                ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   MinIO      │  │  PostgreSQL  │  │    Redis     │
  │ (S3-compat)  │  │   (Future)   │  │   (Cache)    │
  │              │  │              │  │              │
  │ - Documents  │  │ - Metadata   │  │ - Section    │
  │ - Immutable  │  │ - State      │  │   Summaries  │
  │   Storage    │  │ - Audit      │  │ - Rate Limit │
  └──────────────┘  └──────────────┘  └──────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 13.x | React framework with SSR/SSG |
| | React | 18.x | UI library |
| | TypeScript | 5.x | Type safety |
| | Tailwind CSS | 3.x | Utility-first styling |
| **Backend** | Node.js | 20 LTS | Runtime |
| | Express.js | 4.x | HTTP server framework |
| | TypeScript | 5.x | Type safety |
| | Multer | 1.x | File upload handling |
| **Storage** | MinIO | Latest | S3-compatible object storage |
| | PostgreSQL | 15 | Relational database (future) |
| | Redis | 7 | Caching & rate limiting |
| **Infrastructure** | Docker | 24.x | Containerization |
| | Docker Compose | 2.x | Local orchestration |
| **AI Integration** | Configurable | - | OpenAI, Anthropic, etc. |
| **Testing** | Vitest | 1.x | Unit/integration testing |
| | Jest | 29.x | Legacy test compatibility |

---

## Architecture Patterns

### 1. **Pipeline Pattern (Orchestration)**

The `MusePipelineOrchestrator` implements a sequential pipeline with fail-fast semantics:

```typescript
// Conceptual flow
executePipeline(fileBuffer, input) {
  try {
    // Step 1: Store original document (immutable)
    const docMetadata = await this.documentStore.saveOriginal(fileBuffer, input)
    
    // Step 2: Convert to Markdown (deterministic)
    const markdown = await this.converter.convert(docStream, mimeType, metadata)
    
    // Step 3: Validate Markdown (gating checkpoint)
    const validation = this.validator.validate(markdown.content)
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors}`)
    }
    
    // Step 4-7: AI-powered derivation (sequential)
    const epics = await this.deriveEpics(markdown)
    const features = await this.deriveFeatures(epics, markdown)
    const stories = await this.deriveStories(features, markdown)
    const prompts = await this.generatePrompts(stories)
    
    return { document, markdown, validation, epics, features, stories, prompts }
  } catch (error) {
    // Fail fast: halt pipeline and return error to caller
    throw error
  }
}
```

**Pattern Benefits**:
- Clear execution order (no concurrency complexity)
- Explicit error propagation
- Easy to reason about state transitions
- Supports retry at individual stages

**Trade-offs**:
- Higher latency (no parallelism)
- Single-threaded bottleneck
- Future enhancement: parallel feature/story derivation

---

### 2. **Strategy Pattern (Converter Registry)**

Document-to-Markdown conversion uses the Strategy pattern for extensibility:

```typescript
class ConverterRegistry implements DocumentToMarkdownConverter {
  private converters: Map<string, DocumentToMarkdownConverter> = new Map()
  
  register(converter: DocumentToMarkdownConverter) {
    for (const mimeType of converter.getSupportedMimeTypes()) {
      this.converters.set(mimeType, converter)
    }
  }
  
  async convert(stream: Readable, mimeType: string, metadata: any): Promise<MarkdownOutput> {
    const converter = this.converters.get(mimeType)
    if (!converter) {
      throw new Error(`Unsupported MIME type: ${mimeType}`)
    }
    return converter.convert(stream, mimeType, metadata)
  }
  
  supports(mimeType: string): boolean {
    return this.converters.has(mimeType)
  }
}
```

**Registered Converters**:
- `PdfToMarkdownConverter` — PDF documents
- `DocxToMarkdownConverter` — Microsoft Word
- `PlainTextConverter` — TXT files
- Future: `MarkdownPassthroughConverter`, `HtmlToMarkdownConverter`

---

### 3. **Repository Pattern (DocumentStore)**

Abstract storage interface with pluggable implementations:

```typescript
interface DocumentStore {
  saveOriginalFromBuffer(buffer: Buffer, input: SaveOriginalInput): Promise<DocumentMetadata>
  getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }>
  getMetadata(documentId: string): Promise<DocumentMetadata>
}

// Implementations:
class S3DocumentStore implements DocumentStore { /* MinIO/S3 backend */ }
class FileSystemDocumentStore implements DocumentStore { /* Local filesystem */ }
class InMemoryDocumentStore implements DocumentStore { /* Testing only */ }
```

**Storage Strategy Selection**:
```typescript
const documentStore: DocumentStore = (() => {
  const driver = process.env.DOCUMENT_STORE_DRIVER || 's3'
  
  if (driver === 'filesystem') {
    return new FileSystemDocumentStore({ rootDir: './storage/documents' })
  }
  
  return new S3DocumentStore({
    endpoint: process.env.MINIO_ENDPOINT,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
  })
})()
```

---

### 4. **Agent Pattern (AI Derivation)**

Each AI derivation step is encapsulated in a bounded agent:

```typescript
interface Agent<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>
}

// Example: EpicDerivationAgent
class EpicDerivationAgent implements Agent<SectionSummary[], Epic[]> {
  constructor(private documentId: string) {}
  
  async run(summaries: SectionSummary[]): Promise<Epic[]> {
    // Low-temperature LLM call with schema validation
    const response = await this.llm.generate({
      prompt: this.buildPrompt(summaries),
      temperature: 0.1, // Deterministic
      schema: EpicSchema, // JSON schema validation
    })
    
    // Validate output
    const epics = this.validateAndParse(response)
    
    // Enforce constraints
    if (epics.length > 12) {
      throw new Error('Epic count exceeds limit (12)')
    }
    
    return epics
  }
}
```

**Agent Characteristics**:
- Single responsibility (one artifact type per agent)
- Schema-validated output (no hallucination)
- Low temperature (deterministic, not creative)
- Explicit input/output contracts
- No side effects (pure function behavior)

---

### 5. **Rate Limiting Pattern**

Token-aware concurrency control for AI API calls:

```typescript
class RateLimiter {
  constructor(private maxConcurrent: number) {}
  private activeCount = 0
  private queue: Array<() => void> = []
  
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
  
  private async acquire() {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++
      return
    }
    
    // Wait for slot
    await new Promise<void>(resolve => this.queue.push(resolve))
  }
  
  private release() {
    this.activeCount--
    const next = this.queue.shift()
    if (next) {
      this.activeCount++
      next()
    }
  }
}

// Usage with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Unreachable')
}
```

---

## Component Architecture

### API Service (Express.js)

#### Directory Structure

```
services/api/src/
├── index.ts                    # Express app, route registration
├── orchestration/
│   └── MusePipelineOrchestrator.ts  # Pipeline coordination
├── storage/
│   ├── documentStore.ts        # Storage interface
│   ├── documentStoreFactory.ts # Factory for store instances
│   └── implementations/        # S3, FileSystem, InMemory
├── conversion/
│   ├── documentToMarkdownConverter.ts  # Converter interface
│   ├── PdfToMarkdownConverter.ts
│   ├── DocxToMarkdownConverter.ts
│   └── governanceMarkdownValidator.ts  # Quality validation
├── semantic/
│   ├── SectionSplitter.ts      # Split markdown into sections
│   ├── SectionSummaryJob.ts    # Summarize sections
│   ├── EpicDerivationAgent.ts  # Extract epics
│   ├── FeatureDerivationJob.ts # Derive features
│   ├── UserStoryGenerationAgent.ts  # Generate stories
│   └── RateLimiter.ts          # Concurrency control
├── governance/
│   ├── GovernanceIntentAgent.ts      # Legacy epic derivation
│   └── EpicDerivationWorkflow.ts     # Epic workflow
├── features/
│   ├── FeatureDerivationAgent.ts     # Feature extraction
│   ├── FeatureValueDerivationAgent.ts
│   ├── EpicDecompositionAgent.ts
│   └── FeatureDerivationWorkflow.ts
├── stories/
│   ├── FeatureToStoryAgent.ts        # Story generation
│   ├── StoryDerivationWorkflow.ts
│   └── storyRoutes.ts                # Story API endpoints
├── mcp/
│   ├── materializationService.ts     # Write to /docs
│   ├── artifactPersistence.ts        # File I/O helpers
│   ├── githubService.ts              # Git integration (future)
│   └── mcpToolServer.ts              # MCP protocol (future)
├── shared/
│   └── ArtifactValidation.ts         # Cross-artifact validation
└── materialize-endpoint.ts           # POST /features/:id/materialize
```

#### Key Endpoints

```typescript
// Main pipeline execution
POST /pipeline/execute
  - multipart/form-data: file (PDF/DOCX/TXT), projectId
  - Returns: { document, markdown, validation, epics, features, stories }
  - Rate limited: 10 requests per 15 minutes per IP

// Feature generation (on-demand)
POST /epics/:epicId/features
  - Body: { epic, governanceContent, projectId }
  - Returns: { epic_id, feature_count, features[] }

// Story generation (on-demand)
POST /features/:featureId/stories
  - Body: { feature, epic, governanceContent, projectId }
  - Returns: { feature_id, story_count, stories[] }

// AI Prompt generation
POST /stories/:storyId/generate-prompt
  - Body: { story, feature, epic, governanceMarkdown, repoUrl, defaultBranch }
  - Returns: { story_id, prompts[] }

// Materialization (save to /docs)
POST /features/:featureId/materialize
  - Body: { feature, epic, stories, prompts }
  - Returns: { success, filesCreated[], summary: { epics, features, stories, prompts } }

// Health check
GET /health
  - Returns: { ok: true, service: 'muse-api' }
```

---

### Frontend Service (Next.js)

#### Page Structure

```
apps/web/pages/
├── index.tsx               # Landing page
├── governance.tsx          # Main pipeline UI (upload → review → materialize)
├── upload.tsx              # Legacy simple upload
└── api/
    └── uploads.ts          # API route proxy (Next.js API routes)
```

#### Component Architecture (governance.tsx)

```typescript
// State management (React hooks)
const [projectId, setProjectId] = useState('')
const [file, setFile] = useState<File | null>(null)
const [stage, setStage] = useState<PipelineStage>('idle')
const [output, setOutput] = useState<PipelineOutput | null>(null)
const [error, setError] = useState<string | null>(null)

// Derived state (epic → features mapping)
const [featuresByEpic, setFeaturesByEpic] = useState<Map<string, FeatureWithStories[]>>(new Map())
const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())
const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())

// Pipeline execution flow
const runPipeline = async () => {
  setStage('uploading')
  setError(null)
  
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', projectId)
  
  try {
    setStage('converting')
    const response = await fetch('/api/pipeline/execute', {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      throw new Error(await response.text())
    }
    
    const data: PipelineOutput = await response.json()
    
    setOutput(data)
    setStage('complete')
    
    // Initialize feature mapping
    const epicMap = new Map<string, FeatureWithStories[]>()
    data.epics.forEach(epic => {
      const epicFeatures = data.features.filter(f => f.epic_id === epic.epic_id)
      epicMap.set(epic.epic_id, epicFeatures)
    })
    setFeaturesByEpic(epicMap)
    
  } catch (err) {
    setError((err as Error).message)
    setStage('error')
  }
}

// On-demand feature generation
const generateFeaturesForEpic = async (epic: EpicData) => {
  const response = await fetch(`/api/epics/${epic.epic_id}/features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      epic,
      governanceContent: output.markdown.content,
      projectId,
    }),
  })
  
  const data = await response.json()
  
  // Update featuresByEpic map
  const updated = new Map(featuresByEpic)
  updated.set(epic.epic_id, data.features)
  setFeaturesByEpic(updated)
}

// Materialization
const materializeAll = async () => {
  // For each feature with stories and prompts, call materialize endpoint
  for (const [epicId, features] of featuresByEpic) {
    for (const feature of features) {
      if (feature.stories && feature.stories.length > 0) {
        await fetch(`/api/features/${feature.feature_id}/materialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature,
            epic: output.epics.find(e => e.epic_id === epicId),
            stories: feature.stories,
            prompts: feature.stories.flatMap(s => s.prompts || []),
          }),
        })
      }
    }
  }
  
  alert('Materialization complete. Files saved to /docs.')
}
```

---

## Data Flow & Sequence Diagrams

### End-to-End Pipeline Sequence

```
┌───────┐         ┌─────┐         ┌────────────┐         ┌──────────┐         ┌───────┐
│Browser│         │ API │         │Orchestrator│         │AI Agents │         │Storage│
└───┬───┘         └──┬──┘         └─────┬──────┘         └────┬─────┘         └───┬───┘
    │                │                   │                     │                   │
    │ POST /pipeline │                   │                     │                   │
    │ (multipart)    │                   │                     │                   │
    ├───────────────>│                   │                     │                   │
    │                │ executePipeline() │                     │                   │
    │                ├──────────────────>│                     │                   │
    │                │                   │ saveOriginal()      │                   │
    │                │                   ├─────────────────────────────────────────>│
    │                │                   │                     │     (MinIO PUT)   │
    │                │                   │<─────────────────────────────────────────┤
    │                │                   │ documentMetadata    │                   │
    │                │                   │                     │                   │
    │                │                   │ getOriginal()       │                   │
    │                │                   ├─────────────────────────────────────────>│
    │                │                   │<─────────────────────────────────────────┤
    │                │                   │ stream              │                   │
    │                │                   │                     │                   │
    │                │                   │ convert(stream)     │                   │
    │                │                   │ [PdfConverter]      │                   │
    │                │                   ├─────────────────────│                   │
    │                │                   │                     │                   │
    │                │                   │ markdownOutput      │                   │
    │                │                   │<────────────────────┤                   │
    │                │                   │                     │                   │
    │                │                   │ validate(markdown)  │                   │
    │                │                   │ [Validator]         │                   │
    │                │                   ├─────────────────────│                   │
    │                │                   │                     │                   │
    │                │                   │ validationResult    │                   │
    │                │                   │<────────────────────┤                   │
    │                │                   │                     │                   │
    │                │                   │ ❌ if invalid:      │                   │
    │                │                   │    throw Error      │                   │
    │                │                   │                     │                   │
    │                │                   │ ✅ if valid:        │                   │
    │                │                   │                     │                   │
    │                │                   │ split(markdown)     │                   │
    │                │                   │ [SectionSplitter]   │                   │
    │                │                   ├─────────────────────│                   │
    │                │                   │ sections[]          │                   │
    │                │                   │<────────────────────┤                   │
    │                │                   │                     │                   │
    │                │                   │ for each section:   │                   │
    │                │                   │   summarize()       │                   │
    │                │                   ├─────────────────────>│ [SectionSummaryJob]
    │                │                   │                     ├─> LLM API         │
    │                │                   │                     │<─ summary         │
    │                │                   │<─────────────────────┤                  │
    │                │                   │ summaries[]         │  (cached in Redis)│
    │                │                   │                     │                   │
    │                │                   │ deriveEpics()       │                   │
    │                │                   ├─────────────────────>│ [EpicAgent]      │
    │                │                   │                     ├─> LLM API         │
    │                │                   │                     │<─ epics (1-12)    │
    │                │                   │<─────────────────────┤                  │
    │                │                   │ epics[]             │                   │
    │                │                   │                     │                   │
    │                │                   │ for each epic:      │                   │
    │                │                   │   deriveFeatures()  │                   │
    │                │                   ├─────────────────────>│ [FeatureAgent]   │
    │                │                   │                     ├─> LLM API         │
    │                │                   │                     │<─ features (≤5)   │
    │                │                   │<─────────────────────┤                  │
    │                │                   │ features[]          │                   │
    │                │                   │                     │                   │
    │                │                   │ for each feature:   │                   │
    │                │                   │   deriveStories()   │                   │
    │                │                   ├─────────────────────>│ [StoryAgent]     │
    │                │                   │                     ├─> LLM API         │
    │                │                   │                     │<─ stories (1-5)   │
    │                │                   │                     │   + INVEST valid  │
    │                │                   │<─────────────────────┤                  │
    │                │                   │ stories[]           │                   │
    │                │                   │                     │                   │
    │                │                   │ generatePrompts()   │                   │
    │                │                   │ [PromptGenerator]   │                   │
    │                │                   ├─────────────────────│                   │
    │                │                   │ prompts[]           │                   │
    │                │                   │<────────────────────┤                   │
    │                │                   │                     │                   │
    │                │ PipelineOutput    │                     │                   │
    │                │<──────────────────┤                     │                   │
    │ JSON Response  │                   │                     │                   │
    │<───────────────┤                   │                     │                   │
    │                │                   │                     │                   │
    │ Render UI      │                   │                     │                   │
    │ (epics,        │                   │                     │                   │
    │  features,     │                   │                     │                   │
    │  stories,      │                   │                     │                   │
    │  prompts)      │                   │                     │                   │
    │                │                   │                     │                   │
    │ User clicks    │                   │                     │                   │
    │ "Materialize"  │                   │                     │                   │
    │                │                   │                     │                   │
    │ POST /features │                   │                     │                   │
    │ /:id/materialize│                  │                     │                   │
    ├───────────────>│                   │                     │                   │
    │                │ materialize()     │                     │                   │
    │                ├──────────────────>│                     │                   │
    │                │ [MaterializationService]               │                   │
    │                │                   │                     │                   │
    │                │                   │ Write to /docs:     │                   │
    │                │                   │   epics/*.yaml      │                   │
    │                │                   │   features/*.yaml   │                   │
    │                │                   │   stories/*.yaml    │                   │
    │                │                   │   prompts/*.md      │                   │
    │                │                   │ (filesystem I/O)    │                   │
    │                │                   │                     │                   │
    │                │ { success: true } │                     │                   │
    │                │<──────────────────┤                     │                   │
    │<───────────────┤                   │                     │                   │
    │                │                   │                     │                   │
```

---

### Materialization Flow

```
User clicks "Materialize" button
    ↓
Frontend collects:
  - Epic data
  - Feature data
  - Stories data
  - Prompts data
    ↓
POST /features/:featureId/materialize
    ↓
MaterializationService.materialize()
    ↓
┌─────────────────────────────────────┐
│ 1. Create directories:              │
│    /docs/epics                      │
│    /docs/features                   │
│    /docs/stories                    │
│    /docs/prompts                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Write Epic YAML:                 │
│    /docs/epics/{epic-slug}.yaml     │
│                                     │
│    id: epic-47be9e5c-01            │
│    title: "Personnel Records..."    │
│    objective: "..."                 │
│    success_criteria: [...]          │
│    governance_references: [...]     │
│    created_at: "2026-01-25..."      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. Write Feature YAML:              │
│    /docs/features/{feature-id}.yaml │
│                                     │
│    id: epic-...-feature-02          │
│    title: "Secure Personnel..."     │
│    epic_id: epic-47be9e5c-01       │
│    description: "..."               │
│    acceptance_criteria: [...]       │
│    governance_references: [...]     │
│    created_at: "2026-01-25..."      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. Write Story YAML (per story):    │
│    /docs/stories/{story-id}.yaml    │
│                                     │
│    id: epic-...-story-01            │
│    title: "Encrypt Records"         │
│    role: "authorized service"       │
│    capability: "encrypts data"      │
│    benefit: "protects information"  │
│    acceptance_criteria: [...]       │
│    derived_from_feature: "..."      │
│    derived_from_epic: "..."         │
│    governance_references: [...]     │
│    created_at: "2026-01-25..."      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. Write AI Prompt MD (per prompt): │
│    /docs/prompts/{story-id}.prompt.md│
│                                     │
│    # AI Prompt: {prompt-id}         │
│    **Story ID:** {story-id}         │
│    **Role:** Software Engineer      │
│    **Task:** Implement PR from story│
│    **Template:** Prompt-muse-...    │
│                                     │
│    ## Prompt Content                │
│    ```                              │
│    <full interpolated prompt>       │
│    ```                              │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 6. Return success response:         │
│    {                                │
│      success: true,                 │
│      filesCreated: [                │
│        "docs/epics/...",            │
│        "docs/features/...",         │
│        "docs/stories/...",          │
│        "docs/prompts/..."           │
│      ],                             │
│      summary: {                     │
│        epics: 1,                    │
│        features: 1,                 │
│        stories: 4,                  │
│        prompts: 4                   │
│      }                              │
│    }                                │
└─────────────────────────────────────┘
```

---

## API Specifications

### POST /pipeline/execute

**Purpose**: Execute full governance-to-delivery pipeline

**Request**:
```http
POST /pipeline/execute HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="policy.pdf"
Content-Type: application/pdf

<binary PDF data>
------WebKitFormBoundary
Content-Disposition: form-data; name="projectId"

proj-001
------WebKitFormBoundary--
```

**Response** (200 OK):
```json
{
  "document": {
    "document_id": "47be9e5c71786f7600fb6e34629e353eb087cd344edc38b4c9e2874a39703f44",
    "original_filename": "policy.pdf"
  },
  "markdown": {
    "content": "---\ndocument_id: 47be9e5c...\n---\n\n# Policy Title\n\n...",
    "path": "docs/governance/47be9e5c....md"
  },
  "validation": {
    "isValid": true,
    "contentLength": 15234,
    "headingCount": 42,
    "errors": []
  },
  "epics": [
    {
      "epic_id": "epic-47be9e5c-01",
      "title": "Personnel Records Management System",
      "objective": "Enable compliant management of personnel records...",
      "success_criteria": [
        "All personnel records encrypted at rest and in transit",
        "Access restricted based on user role",
        "Complete audit trail for all access events"
      ],
      "governance_references": ["sec-47be9e5c-01-b0c3b14d"]
    }
  ],
  "features": [
    {
      "feature_id": "epic-47be9e5c-01-feature-02",
      "title": "Secure Personnel Records with Role-Based Access Controls",
      "business_value": "Protect personnel data from unauthorized access",
      "description": "Implement encryption, RBAC, and audit logging...",
      "acceptance_criteria": [
        "Electronic records encrypted with AES-256",
        "User roles restrict data access appropriately",
        "All access attempts logged"
      ],
      "risk_of_not_delivering": ["Compliance violations", "Data breaches"],
      "epic_id": "epic-47be9e5c-01",
      "governance_references": ["sec-47be9e5c-01-b0c3b14d"]
    }
  ],
  "stories": [
    {
      "story_id": "epic-47be9e5c-01-feature-02-story-01",
      "title": "Encrypt Electronic Personnel Records",
      "role": "authorized system service",
      "capability": "encrypts data",
      "benefit": "protects information",
      "acceptance_criteria": [
        "System applies AES-256 encryption to all personnel records",
        "System establishes TLS 1.3+ connections for data transfers",
        "System validates encryption before read/write operations",
        "System logs encryption operations for audit"
      ],
      "derived_from_feature": "epic-47be9e5c-01-feature-02",
      "derived_from_epic": "epic-47be9e5c-01",
      "governance_references": ["sec-47be9e5c-01-b0c3b14d"]
    }
  ]
}
```

**Error Response** (400 Bad Request):
```json
{
  "ok": false,
  "error": "Governance content validation failed. Pipeline blocked at agent gating.\nINCOMPLETE_CONTENT: Document appears to be a placeholder or stub. Real governance content expected. (Ensure the document is complete before processing.)"
}
```

**Rate Limiting**:
- 10 requests per 15 minutes per IP
- Returns 429 Too Many Requests if exceeded

---

### POST /features/:featureId/materialize

**Purpose**: Write artifacts to `/docs` folder

**Request**:
```http
POST /features/epic-47be9e5c-01-feature-02/materialize HTTP/1.1
Content-Type: application/json

{
  "feature": {
    "feature_id": "epic-47be9e5c-01-feature-02",
    "title": "Secure Personnel Records with Role-Based Access Controls",
    "epic_id": "epic-47be9e5c-01",
    "description": "...",
    "acceptance_criteria": [...],
    "governance_references": [...]
  },
  "epic": {
    "epic_id": "epic-47be9e5c-01",
    "title": "Personnel Records Management System",
    "objective": "...",
    "success_criteria": [...],
    "governance_references": [...]
  },
  "stories": [
    {
      "story_id": "epic-47be9e5c-01-feature-02-story-01",
      "title": "Encrypt Electronic Personnel Records",
      ...
    }
  ],
  "prompts": [
    {
      "prompt_id": "prompt-epic-47be9e5c-01-feature-02-story-01-1769380159574",
      "story_id": "epic-47be9e5c-01-feature-02-story-01",
      "content": "# Muse — User Story to Pull Request...",
      "role": "Software Engineer",
      "task": "Implement feature from user story",
      "template": "Prompt-muse-User-Story-Implementation-PR",
      "generated_at": "2026-01-25T22:29:19.574Z"
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "filesCreated": [
    "docs/epics/personnel-records-management-system.yaml",
    "docs/features/epic-47be9e5c-01-feature-02.yaml",
    "docs/stories/encrypt-electronic-personnel-records.yaml",
    "docs/prompts/encrypt-electronic-personnel-records.prompt.md"
  ],
  "errors": [],
  "summary": {
    "epics": 1,
    "features": 1,
    "stories": 1,
    "prompts": 1
  }
}
```

---

## Data Models & Schemas

### Document Metadata

```typescript
type DocumentMetadata = {
  documentId: string              // SHA-256 hash of document content
  checksumSha256: string          // Same as documentId (redundant for clarity)
  originalFilename: string        // User-provided filename
  mimeType: string                // 'application/pdf', 'application/vnd...', 'text/plain'
  sizeBytes: number               // File size
  uploadedAtUtc: string           // ISO 8601 timestamp
  storageUri: string              // Full URI (e.g., 's3://muse-documents/...')
  originalObjectKey: string       // S3 key for original document
  metadataObjectKey: string       // S3 key for metadata JSON
  projectId?: string              // Optional project association
}
```

### Markdown Output

```typescript
type MarkdownOutput = {
  content: string                 // Full Markdown with YAML front matter
  metadata: {
    source_checksum: string       // SHA-256 of original document
    document_id: string            // Document ID
    generated_at: string           // ISO 8601 timestamp
    derived_artifact: 'governance_markdown'
    original_filename: string
  }
  suggestedFilename: string       // E.g., '47be9e5c....md'
}
```

### Epic Schema

```typescript
type Epic = {
  epic_id: string                 // Format: 'epic-{docId}-{nn}'
  title: string                   // Human-readable title
  objective: string               // Single paragraph describing high-level goal
  success_criteria: string[]      // Measurable outcomes (1-10 items)
  governance_references: string[] // Section IDs (format: 'sec-{docId}-{hash}')
  derived_from?: string           // Document ID (optional)
  generated_at?: string           // ISO 8601 timestamp
}
```

**Validation Rules**:
- `epic_id`: Required, must match pattern `epic-[a-z0-9-]+`
- `title`: Required, 10-200 characters
- `objective`: Required, single paragraph, 50-1000 characters
- `success_criteria`: Required array, 1-10 items, each 20-500 characters
- `governance_references`: Required array, 1+ items

### Feature Schema

```typescript
type Feature = {
  feature_id: string              // Format: '{epicId}-feature-{nn}'
  epic_id: string                 // Parent epic ID
  title: string                   // Human-readable title
  business_value: string          // Why this matters (business perspective)
  description: string             // What the feature provides
  acceptance_criteria: string[]   // How to verify (testable conditions)
  risk_of_not_delivering: string[] // Risks if feature is not built
  parent_feature_id?: string      // For nested features (optional)
  governance_references: string[] // Section IDs
  generated_at?: string           // ISO 8601 timestamp
}
```

**Validation Rules**:
- `feature_id`: Required, must match pattern `{epic_id}-feature-\d+`
- `epic_id`: Required, must reference existing epic
- `title`: Required, 10-200 characters
- `description`: Required, 50-1000 characters
- `acceptance_criteria`: Required array, 1-10 items
- Maximum 5 features per epic (enforced by agent)

### User Story Schema

```typescript
type UserStory = {
  story_id: string                // Format: '{featureId}-story-{nn}'
  title: string                   // Human-readable title
  role: string                    // "As a..." (actor)
  capability: string              // "I want to..." (action)
  benefit: string                 // "So that..." (value)
  acceptance_criteria: string[]   // Testable conditions
  derived_from_feature: string    // Parent feature ID
  derived_from_epic: string       // Grandparent epic ID
  governance_references: string[] // Section IDs
  generated_at?: string           // ISO 8601 timestamp
}
```

**INVEST Validation Rules**:
- `title`: Must NOT contain implementation keywords: "implement", "code", "build", "create API"
- `benefit`: Must be meaningful (>10 characters, not just "to comply")
- `acceptance_criteria`: Required array, 1-10 items, each testable
- `role`: Required, typically "user", "admin", "system service"
- Maximum 5 stories per feature (enforced by agent)

### AI Prompt Schema

```typescript
type AIPrompt = {
  prompt_id: string               // Unique ID (format: 'prompt-{storyId}-{timestamp}')
  story_id: string                // Parent story ID
  feature_id?: string             // Resolved feature ID
  epic_id?: string                // Resolved epic ID
  content: string                 // Full interpolated prompt text (Markdown)
  role: string                    // AI role (e.g., "Software Engineer")
  task: string                    // Primary task (e.g., "Implement PR from story")
  generated_at: string            // ISO 8601 timestamp
  template: string                // Template name (e.g., "Prompt-muse-User-Story-Implementation-PR")
}
```

### Validation Result Schema

```typescript
type ValidationResult = {
  isValid: boolean                // Overall validation pass/fail
  contentLength: number           // Character count (excluding YAML front matter)
  headingCount: number            // Number of Markdown headings found
  errors: Array<{
    code: string                  // Error code (e.g., 'INCOMPLETE_CONTENT')
    message: string               // Human-readable error message
    suggestion?: string           // Optional guidance for fixing
  }>
}
```

**Validation Error Codes**:
- `INCOMPLETE_CONTENT` — Document appears to be placeholder/stub (<500 chars)
- `MISSING_HEADINGS` — No Markdown headings found (<2 headings)
- `PLACEHOLDER_TEXT` — Common placeholder patterns detected ("Lorem ipsum", "TODO", "FIXME")

---

## AI Agent Architecture

### Agent Design Principles

1. **Single Responsibility**: Each agent produces exactly one artifact type
2. **Schema-Validated Output**: JSON schema validation prevents hallucination
3. **Low Temperature**: Deterministic output (temperature 0.1-0.2)
4. **Explicit Traceability**: All outputs reference source sections
5. **Fail Fast**: Invalid outputs cause hard error (no silent correction)
6. **Retry Logic**: One retry with exponential backoff for transient failures

### Agent Hierarchy

```
Pipeline Orchestrator
    ↓
SectionSplitter (deterministic)
    ↓
SectionSummaryJob (AI-powered, cached)
    ↓
EpicDerivationAgent (AI-powered)
    ↓
FeatureDerivationJob (AI-powered)
    ↓
FeatureToStoryAgent (AI-powered, INVEST-validated)
    ↓
PromptGenerator (template-based, deterministic)
```

### SectionSummaryJob (AI Agent)

**Purpose**: Summarize individual governance sections for downstream agents

**Input**: Section (id, title, content)  
**Output**: SectionSummary (obligations, actors, constraints, references)

```typescript
class SectionSummaryJob {
  constructor(private cache: Map<string, SectionSummary>) {}
  
  async run(sectionId: string, title: string, content: string): Promise<SectionSummary> {
    // Check cache first (Redis-backed)
    const cacheKey = crypto.createHash('sha256').update(content).digest('hex')
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    // Call LLM with structured prompt
    const prompt = `
You are analyzing a section of a governance document.
Extract key information in structured format.

Section Title: ${title}
Section Content:
${content}

Output JSON:
{
  "obligations": ["string array of must/shall/should requirements"],
  "actors": ["string array of roles mentioned (user, admin, system)"],
  "constraints": ["string array of limitations or boundaries"],
  "references": ["string array of external references (laws, standards)"]
}
`
    
    const response = await this.llm.generate({
      prompt,
      temperature: 0.1,
      responseFormat: 'json_object',
    })
    
    const summary: SectionSummary = {
      section_id: sectionId,
      title,
      obligations: response.obligations || [],
      actors: response.actors || [],
      constraints: response.constraints || [],
      references: response.references || [],
    }
    
    // Cache for future runs
    this.cache.set(cacheKey, summary)
    
    return summary
  }
}
```

**Caching Strategy**:
- Key: SHA-256 hash of section content
- Storage: Redis with TTL (7 days)
- Invalidation: Re-process if content changes (hash mismatch)

---

### EpicDerivationAgent (AI Agent)

**Purpose**: Extract 1-12 high-level Epics from governance summaries

**Input**: SectionSummary[]  
**Output**: Epic[] (1-12 epics)

**Prompt Template**:
```
You are a product management AI agent.
Your task is to extract high-level Epics from governance document summaries.

Constraints:
- Generate 1-12 Epics (no more, no fewer if content supports it)
- Each Epic must have:
  - Unique epic_id (format: epic-{docId}-{nn})
  - Title (10-200 chars, executive-readable)
  - Objective (single paragraph, 50-1000 chars)
  - Success criteria (1-10 measurable outcomes)
  - Governance references (section IDs)
- Do NOT include implementation details
- Do NOT invent requirements not in summaries

Section Summaries:
${summaries.map(s => `Section ${s.section_id}: ${s.title}\nObligations: ${s.obligations.join(', ')}\n`).join('\n')}

Output JSON schema:
{
  "epics": [
    {
      "epic_id": "string",
      "title": "string",
      "objective": "string",
      "success_criteria": ["string"],
      "source_sections": ["string (section IDs)"]
    }
  ]
}
```

**Schema Validation**:
```typescript
const EpicSchema = z.object({
  epics: z.array(z.object({
    epic_id: z.string().regex(/^epic-[a-z0-9-]+$/),
    title: z.string().min(10).max(200),
    objective: z.string().min(50).max(1000),
    success_criteria: z.array(z.string().min(20).max(500)).min(1).max(10),
    source_sections: z.array(z.string()).min(1),
  })).min(1).max(12),
})
```

**Error Handling**:
```typescript
async run(summaries: SectionSummary[]): Promise<Epic[]> {
  const response = await this.llm.generate({ prompt, temperature: 0.1 })
  
  // Parse and validate
  let epics: Epic[]
  try {
    const parsed = JSON.parse(response)
    epics = EpicSchema.parse(parsed).epics
  } catch (error) {
    throw new Error(`Epic derivation validation failed: ${error.message}`)
  }
  
  // Enforce epic count limit
  if (epics.length > 12) {
    throw new Error(`Too many epics generated: ${epics.length} (max 12)`)
  }
  
  return epics
}
```

---

### FeatureToStoryAgent (AI Agent with INVEST Validation)

**Purpose**: Generate INVEST-compliant User Stories from Features

**Input**: Feature, Epic, Governance Markdown  
**Output**: UserStory[] (1-5 stories per feature)

**INVEST Validation** (Post-Generation):
```typescript
function validateINVEST(story: UserStory): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Independent: Check for tight coupling keywords
  // (This is heuristic; true independence requires human review)
  
  // Negotiable: Detect implementation leakage in title
  const implementationKeywords = ['implement', 'code', 'build', 'create api', 'setup', 'configure']
  const lowerTitle = story.title.toLowerCase()
  if (implementationKeywords.some(kw => lowerTitle.includes(kw))) {
    errors.push(`Title contains implementation detail: "${story.title}"`)
  }
  
  // Valuable: Benefit must be meaningful
  if (story.benefit.length < 10 || story.benefit.toLowerCase() === 'to comply') {
    errors.push(`Benefit is too vague: "${story.benefit}"`)
  }
  
  // Estimable: Acceptance criteria must be clear
  if (story.acceptance_criteria.length === 0) {
    errors.push('No acceptance criteria provided (not estimable)')
  }
  
  // Small: (Subjective; we enforce max 5 stories per feature)
  
  // Testable: Each acceptance criterion should be verifiable
  for (const criterion of story.acceptance_criteria) {
    if (criterion.length < 10 || criterion.includes('etc') || criterion.includes('...')) {
      errors.push(`Acceptance criterion is vague: "${criterion}"`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}
```

**Agent Flow with Validation**:
```typescript
async deriveStories(feature: Feature, epic: Epic, markdown: string): Promise<UserStory[]> {
  const prompt = this.buildPrompt(feature, epic, markdown)
  const response = await this.llm.generate({ prompt, temperature: 0.1 })
  
  let stories: UserStory[]
  try {
    stories = JSON.parse(response).stories
  } catch (error) {
    throw new Error(`Story parsing failed: ${error.message}`)
  }
  
  // INVEST validation (fail fast)
  for (const story of stories) {
    const validation = validateINVEST(story)
    if (!validation.valid) {
      throw new Error(
        `INVEST validation failed for story ${story.story_id}:\n${validation.errors.join('\n')}`
      )
    }
  }
  
  return stories
}
```

---

## Storage Architecture

### MinIO (S3-Compatible Object Storage)

**Bucket Structure**:
```
muse-documents/
├── originals/
│   └── {documentId}/
│       ├── original.pdf          # Immutable original document
│       └── metadata.json         # DocumentMetadata
└── artifacts/
    └── {documentId}/
        ├── governance.md         # Converted Markdown
        ├── epics/
        │   └── {epicId}.md
        ├── features/
        │   └── {featureId}.md
        └── stories/
            └── {storyId}.md
```

**S3 API Usage**:
```typescript
class S3DocumentStore implements DocumentStore {
  private s3: S3Client
  
  constructor(config: { endpoint, accessKey, secretKey, bucket }) {
    this.s3 = new S3Client({
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      region: 'us-east-1', // MinIO doesn't care, but SDK requires it
      forcePathStyle: true, // Required for MinIO
    })
    this.bucket = config.bucket
  }
  
  async saveOriginalFromBuffer(buffer: Buffer, input: SaveOriginalInput): Promise<DocumentMetadata> {
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    const documentId = checksumSha256
    
    // Check if document already exists (idempotency)
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: `originals/${documentId}/original`,
      }))
      throw new DocumentAlreadyExistsError(documentId)
    } catch (error) {
      if (error.name !== 'NotFound') throw error
    }
    
    // Upload original document
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: `originals/${documentId}/original`,
      Body: buffer,
      ContentType: input.mimeType,
      Metadata: {
        originalFilename: input.originalFilename,
        checksumSha256,
      },
    }))
    
    // Upload metadata
    const metadata: DocumentMetadata = {
      documentId,
      checksumSha256,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedAtUtc: input.uploadedAtUtc || new Date().toISOString(),
      storageUri: `s3://${this.bucket}/originals/${documentId}/original`,
      originalObjectKey: `originals/${documentId}/original`,
      metadataObjectKey: `originals/${documentId}/metadata.json`,
      projectId: input.projectId,
    }
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: `originals/${documentId}/metadata.json`,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
    }))
    
    return metadata
  }
  
  async getOriginal(documentId: string): Promise<{ stream: Readable; metadata: DocumentMetadata }> {
    // Fetch metadata first
    const metadataResponse = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: `originals/${documentId}/metadata.json`,
    }))
    
    const metadataJson = await metadataResponse.Body!.transformToString()
    const metadata: DocumentMetadata = JSON.parse(metadataJson)
    
    // Fetch original document stream
    const docResponse = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: `originals/${documentId}/original`,
    }))
    
    return {
      stream: docResponse.Body as Readable,
      metadata,
    }
  }
}
```

---

### Redis (Caching & Rate Limiting)

**Use Cases**:
1. **Section Summary Cache** — Key: SHA-256 of section content, Value: SectionSummary JSON
2. **Rate Limiting State** — Tracks concurrent AI API calls per session
3. **Future: Distributed Locks** — For concurrent pipeline execution

**Cache Implementation**:
```typescript
class RedisSectionSummaryCache implements Map<string, SectionSummary> {
  constructor(private redis: Redis) {}
  
  async get(key: string): Promise<SectionSummary | undefined> {
    const json = await this.redis.get(`summary:${key}`)
    return json ? JSON.parse(json) : undefined
  }
  
  async set(key: string, value: SectionSummary): Promise<void> {
    await this.redis.set(
      `summary:${key}`,
      JSON.stringify(value),
      'EX',
      7 * 24 * 60 * 60, // 7 days TTL
    )
  }
  
  has(key: string): Promise<boolean> {
    return this.redis.exists(`summary:${key}`).then(count => count > 0)
  }
}
```

---

### Filesystem (/docs Materialization)

**Directory Structure**:
```
/docs
├── epics/
│   └── personnel-records-management-system.yaml
├── features/
│   └── epic-47be9e5c-01-feature-02.yaml
├── stories/
│   ├── encrypt-electronic-personnel-records.yaml
│   ├── log-personnel-record-access.yaml
│   ├── enforce-role-based-access.yaml
│   └── track-physical-record-access.yaml
└── prompts/
    ├── encrypt-electronic-personnel-records.prompt.md
    ├── log-personnel-record-access.prompt.md
    ├── enforce-role-based-access.prompt.md
    └── track-physical-record-access.prompt.md
```

**File Naming Conventions**:
- **Epics**: `{epic-title-slug}.yaml` (human-readable, max 50 chars)
- **Features**: `{feature-id}.yaml` (machine ID for uniqueness)
- **Stories**: `{story-title-slug}.yaml` (human-readable, max 50 chars)
- **Prompts**: `{story-title-slug}.prompt.md` (matches story filename)

---

## Error Handling & Resilience

### Error Categories

| Category | HTTP Status | Handling Strategy |
|----------|-------------|-------------------|
| **Validation Error** | 400 Bad Request | Return detailed error with suggestions; user fixes input |
| **Rate Limit** | 429 Too Many Requests | Client retries after delay (exponential backoff) |
| **AI API Failure** | 502 Bad Gateway | Retry once with backoff; fail if second attempt fails |
| **Storage Failure** | 500 Internal Server Error | Log error; alert operations; retry transient errors |
| **Document Already Exists** | 409 Conflict | Return existing document ID; idempotent behavior |
| **Unsupported Format** | 415 Unsupported Media Type | Return supported formats list |

### Fail-Fast Pipeline

```typescript
// Pipeline execution with explicit error propagation
async executePipeline(fileBuffer: Buffer, input: SaveOriginalInput): Promise<PipelineOutput> {
  try {
    // Stage 1: Upload (network I/O, can fail)
    const document = await this.documentStore.saveOriginalFromBuffer(fileBuffer, input)
    
    // Stage 2: Conversion (CPU-intensive, can fail on malformed documents)
    const { stream } = await this.documentStore.getOriginal(document.documentId)
    const markdown = await this.converter.convert(stream, document.mimeType, {
      documentId: document.documentId,
      checksumSha256: document.checksumSha256,
      originalFilename: document.originalFilename,
    })
    
    // Stage 3: Validation (GATING CHECKPOINT)
    const validation = this.validator.validate(markdown.content)
    if (!validation.isValid) {
      // Block pipeline if validation fails (no AI agent execution)
      throw new ValidationError(
        'Governance content validation failed. Pipeline blocked.',
        validation.errors
      )
    }
    
    // Stage 4-7: AI-powered derivation (can fail on rate limits, timeouts, schema violations)
    const epics = await this.deriveEpics(markdown)
    const features = await this.deriveFeatures(epics, markdown)
    const stories = await this.deriveStories(features, markdown)
    
    return {
      document: {
        document_id: document.documentId,
        original_filename: document.originalFilename,
      },
      markdown: {
        content: markdown.content,
        path: `docs/governance/${document.documentId}.md`,
      },
      validation,
      epics,
      features,
      stories,
    }
  } catch (error) {
    // Log error with context
    console.error('[Pipeline] Execution failed:', {
      error: error.message,
      stack: error.stack,
      input: { filename: input.originalFilename, mimeType: input.mimeType },
    })
    
    // Re-throw with additional context
    throw new PipelineExecutionError(
      `Pipeline failed at stage: ${this.getCurrentStage()}`,
      error
    )
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = (error) => true, // Retry all errors by default
  } = options
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Check if error is retryable
      if (!shouldRetry(error) || attempt === maxRetries - 1) {
        throw error
      }
      
      // Calculate backoff delay
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      )
      
      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`, {
        error: error.message,
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error('Unreachable')
}

// Usage in AI agent
async deriveEpics(markdown: MarkdownOutput): Promise<Epic[]> {
  return retryWithBackoff(
    async () => {
      const response = await this.llm.generate({ prompt, temperature: 0.1 })
      return this.parseAndValidate(response)
    },
    {
      maxRetries: 2, // One retry (total 2 attempts)
      baseDelayMs: 2000,
      shouldRetry: (error) => {
        // Retry rate limits and network errors, not validation errors
        return error.name === 'RateLimitError' || error.name === 'NetworkError'
      },
    }
  )
}
```

---

## Performance & Scalability

### Current Performance Baseline

| Stage | Latency (Typical) | Notes |
|-------|-------------------|-------|
| **Document Upload** | 100-500ms | Depends on file size (1-10MB typical) |
| **Markdown Conversion** | 2-5 seconds | PDF parsing is CPU-intensive |
| **Validation** | 10-50ms | Regex + heuristics (fast) |
| **Section Splitting** | 50-200ms | Deterministic (fast) |
| **Section Summaries** | 5-10 seconds | Parallel AI calls (cached after first run) |
| **Epic Derivation** | 3-8 seconds | Single AI call |
| **Feature Derivation** | 5-15 seconds | One call per epic (sequential) |
| **Story Derivation** | 10-30 seconds | One call per feature (sequential) |
| **Prompt Generation** | <100ms | Template-based (no AI) |
| **Total Pipeline** | **10-30 seconds** | For typical 10-50 page documents |

### Scalability Considerations

#### Current Bottlenecks

1. **Sequential Feature/Story Derivation**
   - Features derived one epic at a time
   - Stories derived one feature at a time
   - **Fix**: Parallelize with Promise.all (risk: rate limit violations)

2. **Single-Threaded Node.js**
   - CPU-intensive PDF parsing blocks event loop
   - **Fix**: Offload to worker threads or separate service

3. **Synchronous API Calls**
   - Frontend blocks until entire pipeline completes
   - **Fix**: WebSocket streaming or background job queue

4. **No Caching Beyond Sections**
   - Re-derive epics/features/stories on every run
   - **Fix**: Cache intermediate artifacts with content-addressable keys

#### Scalability Targets

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| **Concurrent Users** | 1-5 (prototype) | 50-100 (production) |
| **Document Size** | 1-10MB | 50MB |
| **Pipeline Throughput** | 1 doc/30 sec | 10 docs/sec (parallel) |
| **Cache Hit Rate** | 80% (sections) | 95% (all artifacts) |
| **Availability** | Best-effort | 99.9% SLA |

#### Horizontal Scaling Strategy

```
┌────────────┐
│   Load     │
│  Balancer  │
└─────┬──────┘
      │
      ├─────────────┬─────────────┬─────────────┐
      ▼             ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  API-01  │  │  API-02  │  │  API-03  │  │  API-N   │
│ (Express)│  │ (Express)│  │ (Express)│  │ (Express)│
└─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘
      │             │             │             │
      └─────────────┴─────────────┴─────────────┘
                    ▼
            ┌───────────────┐
            │  Redis Cluster│
            │  (Shared Cache)│
            └───────────────┘
                    ▼
            ┌───────────────┐
            │  MinIO Cluster│
            │  (Shared Docs) │
            └───────────────┘
```

**Key Changes for Scale**:
- Stateless API instances (no in-memory state)
- Shared Redis cache for section summaries
- Distributed MinIO (replicated storage)
- Background job queue (BullMQ + Redis)
- Async pipeline execution (return job ID, poll for completion)

---

## Testing Strategy

### Test Pyramid

```
          ┌─────────────┐
          │   E2E Tests │  ← 5% (slow, comprehensive)
          │  (Playwright)│
        ┌─┴─────────────┴─┐
        │ Integration Tests│ ← 20% (realistic, moderate speed)
        │    (Vitest)      │
      ┌─┴───────────────────┴─┐
      │     Unit Tests         │ ← 75% (fast, focused)
      │    (Vitest/Jest)       │
      └────────────────────────┘
```

### Unit Tests

**Coverage Target**: >80% for core logic

**Focus Areas**:
- DocumentStore implementations (S3, FileSystem, InMemory)
- Converters (PDF, DOCX, PlainText)
- Validation logic (INVEST, schema, content quality)
- AI agent parsing and error handling
- Rate limiter and retry logic

**Example**:
```typescript
describe('FeatureToStoryAgent', () => {
  let agent: FeatureToStoryAgent
  let mockLLM: jest.Mocked<LLMClient>
  
  beforeEach(() => {
    mockLLM = {
      generate: jest.fn(),
    }
    agent = new FeatureToStoryAgent(mockLLM)
  })
  
  it('should generate INVEST-compliant stories', async () => {
    mockLLM.generate.mockResolvedValue({
      stories: [
        {
          story_id: 'epic-001-feature-01-story-01',
          title: 'Encrypt Personnel Records', // No implementation keywords
          role: 'authorized service',
          capability: 'encrypts data',
          benefit: 'protects sensitive information', // Meaningful benefit
          acceptance_criteria: [
            'System applies AES-256 encryption',
            'System validates encryption before writes',
          ],
          derived_from_feature: 'epic-001-feature-01',
          derived_from_epic: 'epic-001',
          governance_references: ['sec-001-abc'],
        },
      ],
    })
    
    const stories = await agent.deriveStories(mockFeature, mockEpic, mockMarkdown)
    
    expect(stories).toHaveLength(1)
    expect(stories[0].title).not.toMatch(/implement|code|build/)
    expect(stories[0].benefit.length).toBeGreaterThan(10)
    expect(stories[0].acceptance_criteria.length).toBeGreaterThan(0)
  })
  
  it('should reject stories with implementation keywords in title', async () => {
    mockLLM.generate.mockResolvedValue({
      stories: [
        {
          story_id: 'epic-001-feature-01-story-01',
          title: 'Implement encryption API', // ❌ Implementation keyword
          role: 'developer',
          capability: 'writes code',
          benefit: 'to comply',
          acceptance_criteria: ['Code compiles'],
          derived_from_feature: 'epic-001-feature-01',
          derived_from_epic: 'epic-001',
          governance_references: [],
        },
      ],
    })
    
    await expect(agent.deriveStories(mockFeature, mockEpic, mockMarkdown))
      .rejects
      .toThrow(/INVEST validation failed.*implementation detail/)
  })
})
```

---

### Integration Tests

**Focus Areas**:
- Full pipeline execution (upload → materialize)
- DocumentStore + MinIO integration
- Redis cache integration
- Error propagation through pipeline stages

**Example**:
```typescript
describe('MusePipelineOrchestrator (Integration)', () => {
  let orchestrator: MusePipelineOrchestrator
  let documentStore: DocumentStore
  let minioContainer: StartedTestContainer
  
  beforeAll(async () => {
    // Start MinIO test container
    minioContainer = await new GenericContainer('minio/minio')
      .withExposedPorts(9000)
      .withCommand(['server', '/data'])
      .start()
    
    documentStore = new S3DocumentStore({
      endpoint: `http://localhost:${minioContainer.getMappedPort(9000)}`,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      bucket: 'test-bucket',
    })
    
    const converter = new ConverterRegistry()
    orchestrator = new MusePipelineOrchestrator(documentStore, converter)
  })
  
  afterAll(async () => {
    await minioContainer.stop()
  })
  
  it('should execute full pipeline for valid PDF', async () => {
    const pdfBuffer = await fs.promises.readFile('fixtures/sample-policy.pdf')
    
    const output = await orchestrator.executePipeline(pdfBuffer, {
      originalFilename: 'sample-policy.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
    })
    
    // Assertions
    expect(output.document.document_id).toMatch(/^[a-f0-9]{64}$/) // SHA-256
    expect(output.markdown.content).toContain('---\ndocument_id:')
    expect(output.validation.isValid).toBe(true)
    expect(output.epics.length).toBeGreaterThan(0)
    expect(output.features.length).toBeGreaterThan(0)
    expect(output.stories.length).toBeGreaterThan(0)
  })
  
  it('should fail fast on invalid markdown', async () => {
    const invalidBuffer = Buffer.from('Lorem ipsum') // Too short, placeholder
    
    await expect(
      orchestrator.executePipeline(invalidBuffer, {
        originalFilename: 'invalid.txt',
        mimeType: 'text/plain',
        sizeBytes: invalidBuffer.length,
      })
    ).rejects.toThrow(/Governance content validation failed/)
  })
})
```

---

### E2E Tests

**Focus Areas**:
- Browser-based workflow (upload → review → materialize)
- File download/materialization
- Error handling in UI

**Example** (Playwright):
```typescript
import { test, expect } from '@playwright/test'

test('governance workflow - upload to materialization', async ({ page }) => {
  // Navigate to governance page
  await page.goto('http://localhost:3000/governance')
  
  // Fill project ID
  await page.fill('input[name="projectId"]', 'test-project')
  
  // Upload file
  await page.setInputFiles('input[type="file"]', 'fixtures/sample-policy.pdf')
  
  // Click "Run Pipeline"
  await page.click('button:has-text("Run Pipeline")')
  
  // Wait for pipeline completion (up to 60 seconds)
  await expect(page.locator('text=Pipeline Complete')).toBeVisible({ timeout: 60000 })
  
  // Verify epics rendered
  await expect(page.locator('[data-testid="epic-card"]')).toHaveCount(1, { timeout: 5000 })
  
  // Expand epic
  await page.click('[data-testid="epic-card"] button:has-text("Expand")')
  
  // Verify features rendered
  await expect(page.locator('[data-testid="feature-card"]')).toHaveCount(1, { timeout: 5000 })
  
  // Generate stories for first feature
  await page.click('[data-testid="feature-card"] button:has-text("Generate Stories")')
  await expect(page.locator('[data-testid="story-card"]')).toHaveCount(4, { timeout: 30000 })
  
  // Materialize all artifacts
  await page.click('button:has-text("Materialize All")')
  await expect(page.locator('text=Materialization complete')).toBeVisible({ timeout: 10000 })
  
  // Verify files created (check filesystem or download)
  // (Requires test harness to check /docs directory)
})
```

---

## Security Architecture

*(See separate document: `security-implementation-plan.md` for comprehensive security design)*

### Current Security Posture (Prototype)

**Authentication**: ❌ None (local development only)  
**Authorization**: ❌ None (all users see all documents)  
**Encryption at Rest**: ❌ None (MinIO unencrypted)  
**Encryption in Transit**: ⚠️ HTTP (no TLS)  
**Audit Logging**: ⚠️ Minimal (basic console logs)  
**Rate Limiting**: ✅ Implemented (express-rate-limit)

### Planned Security (Production Roadmap)

**Phase 1: Authentication & Authorization**
- OAuth2/SAML integration (external IdP)
- JWT-based session management
- Role-based access control (RBAC)

**Phase 2: Encryption**
- TLS 1.3+ for all HTTP traffic
- AES-256 encryption for MinIO (at-rest)
- Application-level encryption for sensitive fields (optional)

**Phase 3: Audit Logging**
- Tamper-evident logs (append-only, signed)
- Log all document access attempts
- Log all artifact modifications

**Phase 4: Compliance**
- GDPR data retention policies
- HIPAA-compliant audit trails (if applicable)
- SOX-compliant change management

---

## Deployment Architecture

### Local Development (Docker Compose)

```yaml
services:
  # Database (future use)
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    volumes: ["./storage/postgres:/var/lib/postgresql/data"]
  
  # Cache & rate limiting
  redis:
    image: redis:7
    ports: ["6379:6379"]
    volumes: ["./storage/redis:/data"]
  
  # Object storage
  minio:
    image: minio/minio:latest
    command: server /data
    ports: ["9000:9000"]
    volumes: ["./storage/minio:/data"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
  
  # API service
  api:
    build: ./services/api
    ports: ["4000:4000"]
    depends_on: [postgres, redis, minio]
    environment:
      - MINIO_ENDPOINT=http://minio:9000
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./docs:/app/docs  # Mount /docs for materialization
  
  # Worker service (future: background jobs)
  workers:
    build: ./services/workers
    ports: ["4100:4100"]
    depends_on: [redis]
  
  # Frontend
  web:
    build: ./apps/web
    ports: ["3000:3000"]
    depends_on: [api]
    environment:
      - API_ENDPOINT=http://api:4000
```

**Startup Command**:
```bash
docker-compose up --build
```

---

### Production Deployment (Azure - Planned)

```
┌───────────────────────────────────────────────────────────┐
│                     Azure Front Door                       │
│  (Global Load Balancer + WAF + DDoS Protection)          │
└────────────────────────┬──────────────────────────────────┘
                         │
      ┌──────────────────┴──────────────────┐
      │                                     │
      ▼                                     ▼
┌────────────────┐                  ┌────────────────┐
│   Web App      │                  │   API App      │
│  (Next.js SSR) │                  │  (Express.js)  │
│   Container    │◄─────────────────┤   Container    │
│   Instance     │  Internal Network│   Instances    │
└────────────────┘                  └───────┬────────┘
                                            │
                    ┌───────────────────────┼────────────────────┐
                    ▼                       ▼                    ▼
            ┌───────────────┐      ┌───────────────┐   ┌──────────────┐
            │ Azure Blob    │      │ Azure Cache   │   │ PostgreSQL   │
            │ Storage       │      │ for Redis     │   │ Flexible     │
            │ (Documents)   │      │ (Caching)     │   │ Server       │
            └───────────────┘      └───────────────┘   └──────────────┘
```

**Key Azure Services**:
- **Azure Container Instances** — Run Docker containers (API, workers)
- **Azure Blob Storage** — Replaces MinIO (S3-compatible)
- **Azure Cache for Redis** — Managed Redis
- **Azure PostgreSQL Flexible Server** — Managed database
- **Azure Front Door** — Global CDN + WAF
- **Azure Key Vault** — Secrets management (API keys, encryption keys)
- **Azure Monitor** — Logging + alerting

---

## Technical Decisions & Rationale

### 1. Why Sequential Pipeline (Not Parallel)?

**Decision**: Execute pipeline stages sequentially (upload → convert → validate → epics → features → stories)

**Rationale**:
- Simplicity: Easier to reason about, debug, and maintain
- Fail-fast: Early stages validate input before expensive AI calls
- Dependency chain: Each stage depends on previous stage output
- Rate limiting: Reduces risk of overwhelming AI API with parallel calls

**Trade-off**: Higher latency (10-30 seconds vs. potential 5-10 seconds with parallelism)

**Future Enhancement**: Parallelize feature/story derivation once rate limiting is robust

---

### 2. Why TypeScript (Not Python)?

**Decision**: Use TypeScript for both frontend and backend

**Rationale**:
- Single language across stack (reduced context switching)
- Strong typing prevents runtime errors
- Next.js + Express.js ecosystem is mature and well-documented
- Node.js handles I/O-bound workloads well (API calls, file uploads)

**Trade-off**: Python has better AI/ML ecosystem, but we're using AI APIs (not training models)

---

### 3. Why MinIO (Not Azure Blob Directly)?

**Decision**: Use MinIO for local development, Azure Blob for production

**Rationale**:
- MinIO is S3-compatible (easy to swap for Azure Blob)
- Local development doesn't require cloud credentials
- Faster iteration (no network latency to cloud)
- Cost-effective for prototyping

**Migration Path**: Change `DocumentStore` from `S3DocumentStore` to `AzureBlobDocumentStore` (same interface)

---

### 4. Why Low-Temperature AI (Not Creative)?

**Decision**: Use temperature 0.1-0.2 for all AI agents

**Rationale**:
- Deterministic output (same input → same output)
- Reduces hallucination risk
- Predictable behavior for auditing
- Not trying to generate creative content (just extracting structure from governance)

**Trade-off**: Less flexible, may miss edge cases that creative AI would catch

---

### 5. Why Fail-Fast Validation?

**Decision**: Block pipeline execution if governance Markdown fails validation

**Rationale**:
- Prevent garbage-in-garbage-out (placeholder content → nonsensical epics)
- Save AI API costs (don't call LLM for invalid input)
- Clear error messages guide user to fix document
- Enforces quality standards early

**Trade-off**: More false positives (valid documents rejected for minor issues)

---

### 6. Why YAML (Not JSON) for Materialized Files?

**Decision**: Use YAML for epics, features, stories (Markdown for prompts)

**Rationale**:
- Human-readable (easier to review in Git diffs)
- Comments allowed (YAML supports `#` comments for future annotations)
- Industry standard for configuration files
- Parseable by most tools (Jira, Azure DevOps import)

**Trade-off**: YAML parsing is slightly slower than JSON, but not a concern for file I/O

---

## Appendix: Key Interfaces

### LLMClient Interface (Abstraction for AI Providers)

```typescript
interface LLMClient {
  generate(options: {
    prompt: string
    temperature: number
    maxTokens?: number
    responseFormat?: 'text' | 'json_object'
    schema?: JSONSchema // For structured output validation
  }): Promise<string>
}

// Implementations:
class OpenAIClient implements LLMClient { /* ... */ }
class AnthropicClient implements LLMClient { /* ... */ }
class AzureOpenAIClient implements LLMClient { /* ... */ }
```

---

### Agent Interface (Generic AI Agent)

```typescript
interface Agent<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>
}

// Example: EpicDerivationAgent
class EpicDerivationAgent implements Agent<SectionSummary[], Epic[]> {
  async run(summaries: SectionSummary[]): Promise<Epic[]> { /* ... */ }
}
```

---

**Document Version**: 1.0  
**Last Updated**: January 25, 2026  
**Maintained By**: MUSE Engineering Team  
**Review Cycle**: Quarterly or after major architecture changes
