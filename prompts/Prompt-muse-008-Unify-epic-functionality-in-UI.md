# AI Implementation Prompt — MUSE-008: End-to-End Governance Decomposition UI (Single-Page Workflow)

## Context

You are contributing to **Muse**, a governance-first AI platform that treats policy documents as source code and incrementally derives delivery artifacts using a **governed, agent-based pipeline**.

Up to this point, Muse capabilities exist as composable backend steps:

- **MUSE-002** — Persist original document (immutable)
- **MUSE-003** — Convert document to governance Markdown
- **MUSE-004** — Commit governance Markdown to Git
- **MUSE-005** — Derive Epic (agent-based)
- **MUSE-006** — Derive Features from Epic (agent-based)
- **MUSE-007** — Derive INVEST-compliant User Stories from Features (agent-based)

**MUSE-008 introduces a unifying frontend workflow** that allows a product owner to execute the *entire pipeline from a single page* and review the results before using them elsewhere.

This story intentionally revisits and integrates the original upload UI.

---

## User Story

**As a product owner**,  
I want to upload a governance document and see the derived Epic, Features, and User Stories on the same page,  
So that I can review and copy delivery artifacts into downstream tools.

---

## Functional Overview

The UI must orchestrate the following steps **in order**, within a single user flow:

1. Upload governance document
2. Persist original document locally (MUSE-002)
3. Convert document to governance Markdown (MUSE-003)
4. Derive Epic from Markdown (MUSE-005)
5. Derive Features from Epic (MUSE-006)
6. Derive User Stories from Features (MUSE-007)
7. Render Epic, Features, and Stories on-screen for review and copy

No Git commits or PRs are required in this story; this is a **review-first experience**.

---

## UI Requirements

### Page Scope

- Single-page interface (no multi-step wizard)
- Progressive disclosure of results as each step completes
- Clear indication of pipeline stage and status

### File Upload

- User can upload a single file (PDF or DOCX)
- File is stored locally using existing backend logic
- Upload triggers the full pipeline automatically

### Output Presentation

#### Governance Markdown

- Display in a collapsible section
- Read-only
- Optional (can be hidden by default)

#### Epic

- Display prominently at the top
- Show:
  - Epic title
  - Objective
  - Success criteria
- Include a **Copy to Clipboard** action

#### Features

- Display as a list or grouped cards
- Each Feature shows:
  - Title
  - Description
- Include **Copy** actions per Feature and for all Features

#### User Stories

- Display in canonical Muse story format
- Each story shows:
  - Role / Capability / Benefit
  - Acceptance Criteria
  - Governance references
- Include **Copy** actions per story and for all stories

### UX Constraints

- No inline editing
- No free-form AI chat
- UI reflects system outputs exactly
- Clear messaging that artifacts are *derived, not authoritative*

---

## Backend Orchestration Requirements

### Orchestration Service

- Introduce a `MusePipelineOrchestrator`
- Responsible for coordinating:
  - File upload
  - Markdown conversion
  - Agent-based derivations (Epic → Features → Stories)

### Execution Model

- Sequential execution
- Fail fast on error
- Return a single structured response containing:
  - document metadata
  - governance markdown
  - epic
  - features
  - user stories

Example response shape:

```json
{
  "document": { "document_id": "doc-123" },
  "markdown": { "content": "..." },
  "epic": { ... },
  "features": [ ... ],
  "stories": [ ... ]
}
Agent Usage Constraints
Reuse existing agents:

GovernanceIntentAgent (MUSE-005)

EpicDecompositionAgent (MUSE-006)

FeatureToStoryAgent (MUSE-007)

No new agent types introduced

Agent configuration must be deterministic and low-temperature

Testing Requirements (MANDATORY)
Unit Tests (Required)
Create unit tests that verify:

Orchestrator executes steps in correct order

Failure in any step halts execution

Returned payload includes:

Epic

Features

User Stories

UI components render provided data correctly

Copy-to-clipboard actions work as expected (mocked)

Test constraints:

Mock backend services and agents

No external network calls

Deterministic execution

End-to-End Integration Test (UPDATED & REQUIRED)
Extend the existing e2e integration test to include UI execution:

Upload a governance document via the UI

Run full pipeline:

Markdown

Epic

Features

User Stories

Assert:

All artifacts are rendered on the page

Epic, Features, and Stories match backend outputs

Copy actions return correct text

Verify:

No Git commits are created

No PRs are opened

This test validates user-facing continuity, not artifact quality.

Non-Functional Requirements
UI must remain responsive during processing

Display loading / progress indicators per stage

Errors must be surfaced clearly with stage context

No state persisted beyond session unless already implemented

Documentation Output
Create a Markdown document at:

vbnet
Copy code
/docs/ui/end-to-end-governance-workflow.md
This document must explain:

The purpose of the single-page workflow

How it differs from Git-backed automation

When to use UI review vs automated PR flows

How this UI supports product ownership and adoption

Constraints
Do not introduce free-form AI chat

Do not modify existing agent logic

Do not commit artifacts to Git in this flow

Do not bypass validation rules from prior stories

Definition of Done
User can upload a file

Full Muse pipeline executes end-to-end

Epic, Features, and User Stories are rendered on the same page

Artifacts are copyable

Unit tests pass

End-to-end integration test passes

Documentation is complete
