# Muse Developer Guide

**Last Updated:** January 15, 2026  
**Status:** Prototype (Pre-Alpha)

---

## Table of Contents

1. [What is Muse?](#what-is-muse)
2. [Architecture Overview](#architecture-overview)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Core Concepts](#core-concepts)
6. [Development Workflow](#development-workflow)
7. [Testing Strategy](#testing-strategy)
8. [Key Components Deep Dive](#key-components-deep-dive)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

---

## What is Muse?

### Purpose

**Muse converts governance and compliance documents into actionable engineering artifacts.**

It transforms heavy policy documents into:
- **Markdown** (structured, version-controlled documentation)
- **Epics** (high-level strategic objectives)
- **Features** (mid-level capabilities)
- **User Stories** (concrete, testable requirements)
- **AI Implementation Prompts** (ready-to-execute coding instructions)

### Target Audience

**Primary:** Product owners and engineering managers in **regulated industries** (healthcare, government, finance, defense) who need to bridge the gap between compliance documents and deliverable software.

**Secondary:** Platform engineers who implement the requirements derived from governance policies.

### Core Hypothesis

There's a disconnect between platform engineers and customers in regulated industries:
- Requirements are misaligned → over-engineered solutions
- Delivery is slow → compliance risk increases
- Adoption suffers → trust issues grow

**Muse solves this** by making governance traceable, actionable, and Git-native.

---

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User (Browser)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    apps/web (Next.js UI)                     │
│  • Governance document upload                                │
│  • Pipeline orchestration UI                                 │
│  • Epic/Feature/Story visualization                          │
│  • AI Prompt generation                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              services/api (Node.js + Express)                │
│  • Document storage (MinIO integration)                      │
│  • Markdown conversion orchestration                         │
│  • Semantic derivation pipeline                              │
│  • AI prompt interpolation                                   │
└────┬─────────────────────┬────────────────────┬─────────────┘
     │                     │                    │
     ↓                     ↓                    ↓
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  services/  │  │   services/      │  │   Storage       │
│  pipeline   │  │   workers        │  │   Layer         │
│  (Python)   │  │   (Node.js)      │  │                 │
│             │  │                  │  │  • Postgres     │
│  • DOCX→MD  │  │  • Background    │  │  • Redis        │
│  • PDF→MD   │  │    jobs          │  │  • MinIO        │
│  • Extract  │  │  • Health check  │  │    (S3-compat)  │
└─────────────┘  └──────────────────┘  └─────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | Server-side rendered UI, governance workflow |
| **API** | Node.js 20 + Express + TypeScript | REST API, pipeline orchestration |
| **Pipeline** | Python 3.11 + FastAPI | Document conversion, text extraction |
| **Workers** | Node.js 20 + TypeScript | Background job processing (placeholder) |
| **Data Store** | Postgres 15 | Structured metadata (future) |
| **Cache** | Redis 7 | Session management, job queues (future) |
| **Object Store** | MinIO (S3-compatible) | Original documents, generated artifacts |
| **Orchestration** | Docker Compose | Local development environment |

---

## Getting Started

### Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
- **Node.js 20+** (for local development outside containers)
- **Python 3.11+** (optional, for local pipeline development)
- **Git** (for version control)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/dgaspard/muse.git
cd muse

# 2. Copy environment template
cp .env.example .env
# Edit .env if needed (defaults work for local dev)

# 3. Start all services
docker-compose up --build

# 4. Verify health endpoints (in another terminal)
curl http://localhost:3000/          # Web UI
curl http://localhost:4000/health    # API
curl http://localhost:8000/health    # Pipeline
curl http://localhost:4100/health    # Workers
```

### Verify Installation

All services should respond with health checks:

```bash
# Run smoke tests
npm run smoke

# Or manually
bash ./scripts/smoke_test.sh
```

**Expected Output:**
```
✅ Web UI is up (HTTP 200)
✅ API health check passed
✅ Pipeline health check passed
✅ Workers health check passed
✅ Postgres is ready
✅ Redis is reachable
✅ MinIO is ready
```

---

## Project Structure

```
muse/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── pages/              # Routes & pages
│       │   └── governance.tsx  # Main governance workflow UI
│       ├── tests/              # Frontend tests
│       └── Dockerfile
│
├── services/
│   ├── api/                    # Node.js API (Express)
│   │   ├── src/
│   │   │   ├── index.ts        # Main entry point, routes
│   │   │   ├── storage/        # Document store abstraction
│   │   │   ├── conversion/     # Markdown converters
│   │   │   ├── orchestration/  # Pipeline orchestrator
│   │   │   └── semantic/       # Epic/Feature/Story agents
│   │   └── Dockerfile
│   │
│   ├── pipeline/               # Python FastAPI service
│   │   ├── app/
│   │   │   └── main.py         # Document conversion endpoints
│   │   └── requirements.txt
│   │
│   └── workers/                # Node.js background workers
│       ├── src/
│       │   └── worker.ts       # Heartbeat + health endpoint
│       └── Dockerfile
│
├── contracts/                  # Product specifications (IMMUTABLE)
│   ├── product-vision.md
│   ├── user-story-format.md
│   ├── ai-prompt-format-spec.md
│   └── ai-constraints-policy.md
│
├── prompts/                    # AI prompt templates
│   └── Prompt-muse-User-Story-Implementation-PR.md
│
├── docs/                       # Implementation documentation
│   ├── API_STORY_DERIVATION.md
│   ├── governance/
│   └── Implementation Summaries/
│
├── scripts/                    # Automation scripts
│   ├── smoke_test.sh           # Health check validation
│   ├── e2e_upload.sh           # End-to-end upload test
│   └── test_story_derivation.sh
│
├── .github/
│   ├── workflows/
│   │   ├── integration.yml     # CI/CD pipeline
│   │   └── smoke.yml           # Smoke test workflow
│   └── copilot-instructions.md # AI assistant guidance
│
├── storage/                    # Local Docker volumes (gitignored)
│   ├── postgres/
│   ├── redis/
│   └── minio/
│
├── docker-compose.yml          # Service orchestration
├── package.json                # Root workspace config
└── README.md                   # Quick start guide
```

---

## Core Concepts

### Artifact Hierarchy

Muse enforces a strict hierarchy from governance to implementation:

```
Governance Document (PDF/DOCX)
        ↓
    Markdown (structured text)
        ↓
    Epic (strategic objective)
        ↓
    Feature (capability)
        ↓
    User Story (testable requirement)
        ↓
    AI Prompt (implementation instructions)
```

### Artifact Boundaries

**Product Artifacts** (what to build):
- **Epics:** Strategic objectives with success criteria
- **Features:** Specific capabilities with acceptance criteria
- **User Stories:** Concrete requirements in "As a... I want... So that..." format

**Execution Artifacts** (how to build):
- **AI Prompts:** Implementation instructions with role, task, context

**Critical:** These boundaries are **ENFORCED** by type system and validation. Product artifacts NEVER contain execution instructions, and vice versa.

### Semantic Pipeline

The **Semantic Pipeline** is Muse's core transformation engine:

1. **Document Upload** → Store original in MinIO as immutable system of record
2. **Markdown Conversion** → Extract structured text from DOCX/PDF
3. **Epic Derivation** → AI agent extracts strategic objectives
4. **Feature Generation** → AI agent derives capabilities from epics
5. **Story Derivation** → AI agent creates testable user stories from features
6. **Prompt Generation** → Template interpolation creates implementation prompts

Each stage is **traceable** and **auditable** via Git.

### Storage Strategy

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| **Original Documents** | MinIO (S3) | Immutable system of record, regulatory compliance |
| **Markdown Artifacts** | Git (future) | Version control, diffs, audit trail |
| **Metadata** | Postgres (future) | Structured queries, relationships |
| **Session State** | Redis (future) | Temporary UI state, job queues |

---

## Development Workflow

### Typical Development Cycle

```bash
# 1. Start the stack
docker-compose up --build

# 2. Make code changes in your editor
# (Files are mounted as volumes, changes reflect immediately)

# 3. View logs for specific service
docker-compose logs -f api          # API logs
docker-compose logs -f pipeline     # Pipeline logs

# 4. Run tests
npm run smoke                       # Smoke tests
npm run e2e-upload                  # E2E upload test

# 5. Stop services
docker-compose down
```

### Local Development (Outside Docker)

**API Service:**
```bash
cd services/api
npm install
npm run dev          # ts-node-dev with hot reload
# API runs on http://localhost:4000
```

**Pipeline Service:**
```bash
cd services/pipeline
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Pipeline runs on http://localhost:8000
```

**Web UI:**
```bash
cd apps/web
npm install
npm run dev          # Next.js dev server
# Web runs on http://localhost:3000
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes, commit frequently
git add .
git commit -m "feat: add new capability"

# 3. Push and create PR
git push origin feature/your-feature-name
# Open PR on GitHub

# 4. CI runs smoke tests automatically
# Review, address feedback, merge
```

---

## Testing Strategy

### Test Pyramid

```
         /\
        /  \
       / E2E \              ← End-to-end (scripts/e2e_upload.sh)
      /______\
     /        \
    / Integration\          ← Integration (smoke_test.sh)
   /____________\
  /              \
 /   Unit Tests   \         ← Unit (apps/web/tests/, future)
/__________________\
```

### Current Test Coverage

| Type | Location | Purpose | Run Command |
|------|----------|---------|-------------|
| **Smoke Tests** | `scripts/smoke_test.sh` | Verify all services are up | `npm run smoke` |
| **E2E Upload** | `scripts/e2e_upload.sh` | Test document upload flow | `npm run e2e-upload` |
| **Unit Tests** | `apps/web/tests/` | Frontend component tests | `npm test` (future) |

### Running Tests

```bash
# Smoke tests (all health endpoints)
npm run smoke

# E2E upload test (full stack integration)
npm run e2e-upload

# CI workflow (GitHub Actions)
# Runs automatically on PR, or manually via Actions UI
```

---

## Key Components Deep Dive

### 1. Web UI (`apps/web`)

**Purpose:** User-facing governance workflow interface

**Key Files:**
- `pages/governance.tsx` — Main governance pipeline UI
  - Document upload
  - Epic/Feature/Story visualization
  - AI prompt generation

**Tech:**
- Next.js 14 (App Router)
- TypeScript (strict mode)
- React hooks for state management

**API Integration:**
```typescript
// Upload governance document
POST /pipeline/execute
Body: { file: File, projectId: string }

// Generate features from epic
POST /epics/:epicId/generate-features
Body: { epic: EpicData, summaries: string[] }

// Generate user stories from feature
POST /features/:featureId/stories
Body: { feature: FeatureData, epic: EpicData, governanceContent: string }

// Generate AI implementation prompt
POST /stories/:storyId/generate-prompt
Body: { story: StoryData, feature: FeatureData, epic: EpicData, governanceMarkdown: string }
```

### 2. API Service (`services/api`)

**Purpose:** Backend REST API orchestrating document processing and derivation

**Key Files:**
- `src/index.ts` — Main entry point with all routes
- `src/storage/documentStore.ts` — MinIO/S3 abstraction
- `src/conversion/documentToMarkdownConverter.ts` — Document conversion registry
- `src/orchestration/MusePipelineOrchestrator.ts` — Full pipeline orchestrator
- `src/semantic/EpicDerivationAgent.ts` — AI-powered epic extraction
- `src/semantic/FeatureGenerationAgent.ts` — Feature generation from epics
- `src/semantic/UserStoryGenerationAgent.ts` — Story derivation from features

**Key Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/uploads` | POST | Upload original document to MinIO |
| `/documents/:id` | GET | Retrieve original document |
| `/convert/:id` | POST | Convert document to Markdown |
| `/pipeline/execute` | POST | Full pipeline (upload → markdown → epics → features → stories) |
| `/epics/:id/generate-features` | POST | Generate features from an epic |
| `/features/:id/stories` | POST | Generate user stories from a feature |
| `/stories/:id/generate-prompt` | POST | Generate AI implementation prompt |

**Tech:**
- Express.js (REST API framework)
- Multer (file upload handling)
- MinIO SDK (S3-compatible storage)
- Claude API (AI-powered semantic derivation)

### 3. Pipeline Service (`services/pipeline`)

**Purpose:** Document conversion and text extraction

**Key Files:**
- `app/main.py` — FastAPI application
- Document converters (DOCX, PDF, TXT)

**Endpoints:**
- `/health` — Health check
- `/convert` — Document conversion (future expansion)

**Tech:**
- FastAPI (async Python framework)
- Uvicorn (ASGI server)
- python-docx, pypdf (document parsing)

### 4. Workers Service (`services/workers`)

**Purpose:** Background job processing (future expansion)

**Current State:** Placeholder with health endpoint and heartbeat logging

**Key Files:**
- `src/worker.ts` — Simple health server

**Future:**
- Bull/BullMQ integration for job queues
- Long-running background tasks
- Event-driven processing

---

## Common Tasks

### Add a New API Endpoint

```typescript
// services/api/src/index.ts

app.post('/my-new-endpoint', async (req: Request, res: Response) => {
  try {
    const { data } = req.body
    
    // Validate input
    if (!data) {
      return res.status(400).json({ ok: false, error: 'data required' })
    }
    
    // Process request
    const result = await processData(data)
    
    // Return response
    return res.json({ ok: true, result })
  } catch (err) {
    console.error('Endpoint failed', err)
    return res.status(500).json({ ok: false, error: 'processing failed' })
  }
})
```

### Add a New UI Page

```typescript
// apps/web/pages/my-new-page.tsx

import React from 'react'

export default function MyNewPage() {
  return (
    <div>
      <h1>My New Page</h1>
      {/* Your content here */}
    </div>
  )
}
```

Access at: `http://localhost:3000/my-new-page`

### Add a Document Converter

```typescript
// services/api/src/conversion/myConverter.ts

import { DocumentToMarkdownConverter } from './documentToMarkdownConverter'

export class MyConverter implements DocumentToMarkdownConverter {
  async convert(stream: NodeJS.ReadableStream, mimeType: string, metadata: any) {
    // Read stream
    const buffer = await streamToBuffer(stream)
    
    // Extract text
    const text = extractTextFromFormat(buffer)
    
    // Generate Markdown with frontmatter
    const markdown = generateMarkdown(text, metadata)
    
    return {
      content: markdown,
      metadata: { /* ... */ },
      suggestedFilename: 'output.md'
    }
  }
}

// Register in converterRegistry
converterRegistry.register('application/my-type', new MyConverter())
```

### Modify AI Prompt Template

```bash
# Edit the template file
vim prompts/Prompt-muse-User-Story-Implementation-PR.md

# Template uses {{variable}} placeholders
# Available variables defined in services/api/src/index.ts (POST /stories/:id/generate-prompt)
```

**Available Template Variables:**
- `{{user_story_id}}` — Story identifier
- `{{user_story_title}}` — Story title
- `{{user_story_role}}` — "As a..."
- `{{user_story_capability}}` — "I want to..."
- `{{user_story_benefit}}` — "So that..."
- `{{epic_id}}`, `{{epic_title}}` — Epic references (traceability only)
- `{{feature_id}}`, `{{feature_title}}` — Feature references (traceability only)
- `{{acceptance_criteria}}` — Formatted list of ACs
- `{{repo_url}}`, `{{default_branch}}` — Git context

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker ps

# Check port conflicts
lsof -i :3000   # Web
lsof -i :4000   # API
lsof -i :8000   # Pipeline
lsof -i :5432   # Postgres
lsof -i :6379   # Redis
lsof -i :9000   # MinIO

# Rebuild from scratch
docker-compose down -v    # Remove volumes
docker-compose up --build --force-recreate
```

### MinIO Connection Errors

```bash
# Verify MinIO is ready
curl http://localhost:9000/minio/health/ready

# Check credentials in .env
cat .env | grep MINIO

# Recreate buckets
docker-compose restart createbuckets
```

### API Returns 500 Errors

```bash
# Check API logs
docker-compose logs -f api

# Common issues:
# - MinIO not ready → Wait for createbuckets to complete
# - Missing environment variables → Check .env
# - Prompt template not found → Verify prompts/ directory is mounted
```

### Pipeline Conversion Fails

```bash
# Check pipeline logs
docker-compose logs -f pipeline

# Verify supported formats
curl http://localhost:8000/convert/supported-formats

# Test with simple TXT file first
```

### Tests Fail

```bash
# Ensure stack is running
docker-compose ps

# Run with verbose output
bash -x ./scripts/smoke_test.sh

# Check individual health endpoints
curl -v http://localhost:4000/health
curl -v http://localhost:8000/health
curl -v http://localhost:4100/health
```

---

## Development Best Practices

### 1. Follow Project Constraints

- ❌ **Do NOT** modify files under `/contracts` without explicit instruction
- ❌ **Do NOT** modify tests to make failures pass — fix code or add proper tests
- ✅ **Do** prefer explicit, readable code over clever abstractions
- ✅ **Do** add `// TODO:` comments when uncertain
- ✅ **Do** assume regulated environments (favor explicit checks, logs, auditability)

### 2. Keep PRs Small

- Focus on single feature or fix
- Include tests where applicable
- Describe manual verification steps

### 3. Document Your Changes

- Update README if adding new capabilities
- Add inline comments for non-obvious logic
- Create implementation summaries in `docs/Implementation Summaries/`

### 4. Maintain Artifact Boundaries

Product Artifacts ≠ Execution Artifacts

**Never:**
- Put execution instructions in User Stories
- Put business requirements in AI Prompts
- Mix Epic/Feature/Story content types

**Always:**
- Use type system to enforce boundaries
- Validate references before generation
- Keep traceability metadata separate from executable content

---

## Next Steps for New Developers

1. **Run the stack** → Verify all health endpoints respond
2. **Read the contracts** → Understand product vision and constraints
3. **Explore the UI** → Upload a sample governance doc, derive artifacts
4. **Review recent PRs** → See examples of accepted contributions
5. **Pick a task** → Check `backlog/` for upcoming features
6. **Ask questions** → Open issues for clarification

---

## Resources

- **Product Vision:** `/contracts/product-vision.md`
- **Architecture:** `/architecture/muse-architecture.md`
- **User Story Format:** `/contracts/user-story-format.md`
- **AI Prompt Spec:** `/contracts/ai-prompt-format-spec.md`
- **Validation Guide:** `/VALIDATION_GUIDE.md`
- **Contributing:** `/CONTRIBUTING.md`

---

## Contact & Support

**Project Owner:** dgaspard (GitHub: @dgaspard)  
**Repository:** https://github.com/dgaspard/muse  
**Issues:** Open an issue for bugs, questions, or feature requests

**This is a prototype.** When in doubt:
1. Open an issue describing the change
2. Include a suggested implementation
3. Wait for feedback before proceeding

---

**Tip:** Always verify your changes don't break the smoke tests before opening a PR!

```bash
npm run smoke && npm run e2e-upload
```
