# AI Implementation Prompt — MUSE-007 (Agent-Based): Derive INVEST-Compliant User Stories from Features

## Context

You are contributing to **Muse**, a governance-first AI platform that incrementally translates intent into delivery-ready artifacts using **bounded, testable agents**.

At this point in the Muse pipeline:

- **MUSE-002** — Original governance document is immutable
- **MUSE-003** — Governance Markdown exists
- **MUSE-004** — Governance Markdown is committed to Git
- **MUSE-005** — An Epic was derived via a bounded agent
- **MUSE-006** — Features were derived from the Epic via a bounded agent

**MUSE-007 completes the product-intent decomposition loop** by translating Features into **clear, testable, INVEST-compliant user stories** that developers can implement.

---

## User Story (Agent-Based)

**As a product owner**,  
I want Muse to generate INVEST-compliant user stories,  
So that developers receive clear, testable requirements.

---

## Agent Declaration

### Agent Name

FeatureToStoryAgent

markdown
Copy code

### Agent Responsibility

- Decompose one or more Features into **INVEST-compliant User Stories**
- Produce stories that are:
  - Independent
  - Negotiable
  - Valuable
  - Estimable
  - Small
  - Testable
- Preserve traceability to:
  - Feature
  - Epic
  - Governance source sections

This agent:

- ❌ Does not design solutions
- ❌ Does not write code
- ❌ Does not invent scope not implied by the Feature
- ✅ Produces delivery-ready requirements

---

## Preconditions

- A Features Markdown file exists at:
/docs/features/<document_id>-features.md

yaml
Copy code

- Features reference:
- `epic_id`
- Source Epic path
- Features are already committed to Git
- `muse.yaml` exists and tracks Epic and Feature artifacts

---

## Agent Input

- Features Markdown file (read-only)
- Feature metadata (from YAML front matter)
- Path to the source Features file
- Governance Markdown (read-only, for traceability references)

---

## Agent Output (Strict Schema)

The agent MUST output data conforming to the following schema:

```yaml
stories:
- story_id: string
  title: string
  role: string
  capability: string
  benefit: string
  derived_from_feature: string
  derived_from_epic: string
  governance_references:
    - section: string
      path: string
  acceptance_criteria:
    - string
Constraints:

At least one User Story per Feature

Every story MUST reference:

Feature

Epic

Governance source section(s)

No additional fields are allowed

User Story Artifact Requirements
File Output
Write User Stories as Markdown to:

bash
Copy code
/docs/stories/<document_id>-stories.md
Canonical Muse Story Format
markdown
Copy code
---
derived_from_epic: epic-001
derived_from_features:
  - feature-001
source_features: docs/features/doc-7f3a-features.md
generated_at: 2026-01-11T12:00:00Z
---

## User Story: <Story Title>
**Story ID:** story-001  
**Derived From Feature:** feature-001  
**Derived From Epic:** epic-001  

**As a** <role>,  
**I want** <capability>,  
**So that** <benefit>.

### Governance References
- Section: <Section Name>  
  Source: <path to governance markdown>

### Acceptance Criteria
- <criterion 1>
- <criterion 2>
- <criterion 3>
INVEST Compliance Requirements
Each User Story MUST:

Be independently understandable

Deliver user or system value

Be small enough to implement in a single iteration

Include acceptance criteria that make the story testable

Avoid technical implementation detail

Validation MUST fail if any of these are missing.

Traceability Requirements
Every story MUST reference:

Feature ID

Epic ID

Governance Markdown section(s)

muse.yaml MUST be updated to register:

Stories artifact path

Associated Features and Epic

Generation timestamp

Existing entries in muse.yaml MUST NOT be modified

Agent Workflow Requirements
Execution Model
Implement using a bounded agent workflow

Recommended framework: LangGraph

Graph must include:

Load Features Markdown

Load Governance Markdown (read-only)

Invoke FeatureToStoryAgent

Validate Agent Output (schema + INVEST rules)

Write Stories Markdown

Register artifact

Commit + PR

Validation
If agent output fails validation:

Retry once

Fail hard on second failure

No silent correction or inferred scope

Git & Workflow Requirements
Branching
Create a new branch:

bash
Copy code
muse-007/derive-user-stories-agent
Commit
Commit Stories Markdown and muse.yaml

Commit message format:

sql
Copy code
muse-007: derive INVEST user stories from features
Pull Request
Open a Pull Request targeting the default branch

PR title:

makefile
Copy code
muse-007: derive INVEST-compliant user stories
PR description must reference:

Epic ID

Feature IDs

Governance source document

Testing Requirements (MANDATORY)
Unit Tests (Required)
Create unit tests that verify:

Stories Markdown file is generated

At least one story exists per Feature

Each story:

Uses canonical Muse story format

References the correct Feature and Epic

Includes governance section references

Includes acceptance criteria

INVEST compliance rules are enforced

muse.yaml is updated correctly

Failure occurs if Features file is missing or invalid

Test constraints:

Use fixture Feature and Governance Markdown

Mock agent responses where feasible

No external network calls

Deterministic execution

End-to-End Integration Test (MODIFIED & REQUIRED)
Modify the existing e2e integration test to include this step:

Upload governance document

Convert to Markdown (MUSE-003)

Commit governance Markdown (MUSE-004)

Derive Epic (MUSE-005)

Derive Features (MUSE-006)

Derive User Stories (MUSE-007)

Assertions:

Stories are created from Features

Each story references:

Feature

Epic

Governance section

Git diff shows:

Epic

Features

Stories

PR includes all derived artifacts

This test validates full pipeline continuity, not story quality.

Documentation Output
Create a Markdown document at:

bash
Copy code
/docs/stories/agent-based-story-derivation.md
This document must explain:

Why INVEST matters for AI-generated requirements

How product owners should review stories

How governance traceability flows into delivery

How Muse prevents requirement hallucination

Constraints
Do not modify Epic or Feature artifacts

Do not introduce technical design

Do not bypass validation rules

Do not bypass Git workflow

Definition of Done
FeatureToStoryAgent is implemented

INVEST-compliant User Stories are derived

Stories reference governance source sections

Traceability from Governance → Epic → Feature → Story is preserved

New branch is created

Pull Request is opened

Unit tests pass

End-to-end integration test passes

Documentation is complete
