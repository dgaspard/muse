# AI Implementation Prompt — MUSE-005 (Agent-Based): Derive Epic from Governance Document

## Context

You are contributing to **Muse**, a governance-first AI platform that treats policy documents as source code and introduces **agent-based reasoning only where interpretation is required**.

Up to this point, Muse has operated as a deterministic pipeline:

- **MUSE-002** — Immutable source document
- **MUSE-003** — Deterministic Markdown conversion
- **MUSE-004** — Deterministic Git commit

**MUSE-005 is the first interpretive step.**  
This is where Muse must reason about *intent*, not just transform data.  
Therefore, this story **must be implemented using a bounded AI agent**.

---

## User Story (Agent-Based)

**As a product owner**,  
I want Muse to use an AI agent to derive a single Epic from the governance document,  
So that high-level outcomes and success criteria are clear before implementation begins.

---

## Agent Declaration

### Agent Name

GovernanceIntentAgent

markdown
Copy code

### Agent Responsibility

- Interpret governance intent
- Abstract *outcomes*, not requirements
- Produce **exactly one Epic**
- Operate under strict constraints and schema validation

This agent:

- ❌ Does not brainstorm
- ❌ Does not create features or stories
- ❌ Does not invent requirements
- ✅ Extracts intent directly supported by the source document

---

## Preconditions

- Governance Markdown exists at:
/docs/governance/<document_id>.md

yaml
Copy code

- Governance Markdown includes valid YAML front matter with:
- `document_id`
- Governance Markdown is already committed to Git
- `muse.yaml` exists and tracks prior artifacts

---

## Agent Input

- Governance Markdown file (read-only)
- `document_id`
- Path to source Markdown

---

## Agent Output (Strict Schema)

The agent MUST output data conforming to the following schema:

```yaml
epic:
epic_id: string
derived_from: document_id
source_markdown: string
objective: string
success_criteria:
  - string
Output must be deterministic given the same input

No additional fields are allowed

Epic Artifact Requirements
File Output
Write Epic as Markdown to:

bash
Copy code
/docs/epics/<document_id>-epic.md
Markdown Structure
markdown
Copy code
---
epic_id: epic-001
derived_from: doc-7f3a
source_markdown: docs/governance/doc-7f3a.md
generated_at: 2026-01-11T10:15:00Z
---

# Epic: <Epic Title>

## Objective
<single concise paragraph>

## Success Criteria
- <criterion 1>
- <criterion 2>
- <criterion 3>
Traceability Requirements
Epic MUST reference:

document_id

Path to source governance Markdown

muse.yaml MUST be updated with:

Epic path

Derivation source

Generation timestamp

No existing entries in muse.yaml may be modified

Agent Workflow Requirements
Execution Model
Implement using a bounded agent workflow

Recommended framework: LangGraph

Graph must include:

Load Governance Markdown

Invoke GovernanceIntentAgent

Validate Agent Output (schema + constraints)

Write Epic Markdown

Register artifact

Commit + PR

Validation
If agent output fails schema validation:

Retry once

Fail hard on second failure

No silent correction or inference

Git & Workflow Requirements
Branching
Create a new branch:

bash
Copy code
muse-005/derive-epic-agent
Commit
Commit Epic Markdown and muse.yaml

Commit message format:

makefile
Copy code
muse-005: derive epic via governance intent agent
Pull Request
Open a Pull Request targeting the default branch

PR title:

javascript
Copy code
muse-005: derive epic from governance document
PR description must reference:

document_id

Source governance Markdown path

Non-Functional Requirements
Agent temperature must be low and fixed

No external tools beyond reading provided inputs

Output must be executive-readable

No Markdown lint violations

Testing Requirements (MANDATORY)
Unit Tests (Required)
Create unit tests that verify:

Agent output conforms to schema

Epic includes:

Objective

At least one success criterion

Epic references correct document_id

Source Markdown path is correct

muse.yaml is updated correctly

Invalid or missing governance Markdown causes failure

Testing constraints:

Use fixture governance Markdown

Mock agent responses where feasible

No network calls

Deterministic test execution

Integration Test (Proposed)
Document or stub an integration test that:

Uploads a governance document

Converts it to Markdown (MUSE-003)

Commits governance Markdown (MUSE-004)

Runs the agent workflow (MUSE-005)

Opens a Pull Request

Verifies:

Epic content

Traceability links

Clean Git diff

PR metadata

Documentation Output
Create a Markdown document at:

bash
Copy code
/docs/epics/agent-based-epic-derivation.md
This document must explain:

Why Epic derivation requires an agent

Why this is the first interpretive step in Muse

How bounded agents differ from creative AI

How product owners should review Epics

Constraints
Do not modify governance Markdown

Do not create Features or User Stories

Do not introduce implementation details

Do not bypass schema validation

Do not bypass Git workflow

Definition of Done
GovernanceIntentAgent is implemented

Agent workflow is bounded and validated

Epic is derived and stored as Markdown

Epic includes objective and success criteria

Traceability is preserved

New branch is created

Pull Request is opened

Unit tests pass

Documentation is complete
