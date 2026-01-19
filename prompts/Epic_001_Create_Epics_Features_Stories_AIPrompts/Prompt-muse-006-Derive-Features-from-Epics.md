# AI Implementation Prompt — MUSE-006 (Agent-Based): Derive Features from the Epic

## Context

You are contributing to **Muse**, a governance-first AI platform that incrementally translates intent into delivery artifacts using **bounded, testable agents**.

By this stage in the Muse pipeline:

- **MUSE-002** persisted the original document immutably
- **MUSE-003** produced governance Markdown
- **MUSE-004** committed governance artifacts to Git
- **MUSE-005** used an agent to derive a single Epic capturing high-level intent

**MUSE-006 continues the agent-based workflow**, moving from *outcome intent* (Epic) to *implementable capabilities* (Features).

This step still requires interpretation, but at a narrower, more constrained level than Epic derivation.

---

## User Story (Agent-Based)

**As a product owner**,  
I want Muse to derive Features from the Epic,  
So that large outcomes are broken into implementable capabilities.

---

## Agent Declaration

### Agent Name

EpicDecompositionAgent

yaml
Copy code

### Agent Responsibility

- Decompose a single Epic into a small, coherent set of Features
- Translate outcomes into **implementation-oriented capabilities**
- Preserve traceability to the Epic
- Operate under strict schema and validation rules

This agent:

- ❌ Does not create User Stories
- ❌ Does not invent scope unrelated to the Epic
- ❌ Does not redefine the Epic objective
- ✅ Focuses on “what capabilities must exist” to satisfy the Epic

---

## Preconditions

- An Epic Markdown file exists at:
/docs/epics/<document_id>-epic.md

yaml
Copy code

- Epic includes:
- Objective
- Success Criteria
- Valid YAML front matter
- Epic is already committed to Git
- `muse.yaml` exists and tracks the Epic artifact

---

## Agent Input

- Epic Markdown file (read-only)
- Epic metadata (from YAML front matter)
- Path to the Epic file

---

## Agent Output (Strict Schema)

The agent MUST output data conforming to the following schema:

```yaml
features:
- feature_id: string
  title: string
  derived_from_epic: string
  description: string
Constraints:

At least one Feature must be produced

Each Feature MUST reference the Epic

No additional fields are allowed

Feature Artifact Requirements
File Output
Write Features as Markdown to:

bash
Copy code
/docs/features/<document_id>-features.md
Markdown Structure
markdown
Copy code
---
derived_from_epic: epic-001
source_epic: docs/epics/doc-7f3a-epic.md
generated_at: 2026-01-11T11:00:00Z
---

# Features for Epic: <Epic Title>

## Feature: <Feature Title>
**Feature ID:** feature-001  
**Derived From Epic:** epic-001

### Description
<Implementation-oriented capability description>

---

## Feature: <Feature Title>
...
Feature Scope Guidance
Each Feature description should:

Describe a capability, not a task

Be implementable by one or more User Stories

Avoid technical design details

Be concrete enough to guide engineering

Traceability Requirements
Every Feature MUST reference:

epic_id

Feature artifact MUST reference:

Path to the source Epic

muse.yaml MUST be updated to register:

Feature artifact path

Associated Epic

Generation timestamp

Existing entries in muse.yaml MUST NOT be modified

Agent Workflow Requirements
Execution Model
Implement using a bounded agent workflow

Recommended framework: LangGraph

Graph must include:

Load Epic Markdown

Invoke EpicDecompositionAgent

Validate Agent Output (schema + constraints)

Write Features Markdown

Register artifact

Commit + PR

Validation
If agent output fails schema validation:

Retry once

Fail hard on second failure

No silent correction or scope inference

Git & Workflow Requirements
Branching
Create a new branch:

bash
Copy code
muse-006/derive-features-agent
Commit
Commit Features Markdown and muse.yaml

Commit message format:

csharp
Copy code
muse-006: derive features from epic
Pull Request
Open a Pull Request targeting the default branch

PR title:

csharp
Copy code
muse-006: derive features from epic
PR description must reference:

epic_id

Source Epic path

Non-Functional Requirements
Agent temperature must be low and fixed

Output must be deterministic given the same Epic

Features must be readable by product and engineering

No Markdown lint violations

Testing Requirements (MANDATORY)
Unit Tests (Required)
Create unit tests that verify:

Features Markdown file is generated

At least one Feature exists

Each Feature:

Has a title and description

References the correct epic_id

Feature descriptions are implementation-oriented (non-empty, non-generic)

muse.yaml is updated correctly

Failure occurs if Epic Markdown is missing or invalid

Test constraints:

Use fixture Epic Markdown files

Mock agent responses where feasible

No external network calls

Deterministic execution

Integration Smoke Test (Required)
Create an integration smoke test that verifies cross-story continuity:

Given an existing Epic (MUSE-005 output)

Run the Feature derivation workflow (MUSE-006)

Assert:

Features are created from the Epic

All Features reference the Epic

Immediately run the next workflow step:

Stub or invoke Feature → Story derivation (future MUSE-007)

Assert:

At least one downstream artifact can be created from the Features

This test does NOT validate story quality — only pipeline continuity.

Documentation Output
Create a Markdown document at:

bash
Copy code
/docs/features/agent-based-feature-derivation.md
This document must explain:

Why Features are derived from Epics

How Features differ from User Stories

How Feature scope supports incremental delivery

How traceability is preserved from Epic → Feature

Constraints
Do not modify the Epic

Do not create User Stories

Do not introduce technical design or implementation steps

Do not bypass schema validation

Do not bypass Git workflow

Definition of Done
EpicDecompositionAgent is implemented

Features are derived and stored as Markdown

Each Feature maps back to the Epic

Feature scope is implementation-oriented

Traceability is preserved

New branch is created

Pull Request is opened

Unit tests pass

Integration smoke test passes

Documentation is complete
