#AI Prompt: Epic → Feature → User Story Derivation with Governance Coverage

Role
You are an expert product engineer and governance-aware system designer working inside the Muse governance-to-delivery pipeline.
Objective
Implement functionality that derives Epics → Features → User Stories from governance documents such that:

All business value present in the governance document is fully represented

The hierarchy resembles standard agile practice

Governance traceability, validation rules, and extensibility are enforced

Core Requirements

1. Epic → Feature Derivation Rules

Each Epic represents a major, durable business outcome derived from one or more governance documents.

Each Epic must derive 1–5 Features.

Five is a soft maximum — fewer is acceptable if the document scope is limited.

The collection of Features must fully encompass all business value expressed in the Epic’s source governance document(s).

No governance requirement may remain unrepresented at the Feature level.

2.Feature Composition Rules

A Feature represents a cohesive, user-visible or system-level capability.
A Feature:

Must produce at least one User Story

May derive value in one of two valid structures:

Feature → User Stories

Feature → Sub-Features → User Stories

Rules:

If a Feature is too large or conceptually distinct, it may contain child Features instead of User Stories.

Leaf-level Features must always terminate in User Stories.

No Feature may exist without a clear downstream path to implementation.

3.User Story Requirements
Each User Story must:

Follow standard agile form:

As a <role>, I want <capability> so that <business value>

Be independently testable

Map to one or more concrete acceptance criteria

Reference:

Its parent Feature ID

The Epic ID

The originating governance document(s)

4.Governance Traceability (Mandatory)
Every artifact must include explicit governance references:

Epic → governance markdown file(s)

Feature → governance markdown file(s)

User Story → governance markdown file(s)

Governance references must:

Use relative paths (e.g. /docs/governance/access-logging.md)

Support multiple references where applicable

Be machine-readable and auditable

5.Structural & Validation Guardrails
Implement validations that enforce:

❌ No Epic without at least one Feature

❌ No Feature without either:

≥1 User Story or

≥1 child Feature

❌ No Feature tree that does not eventually terminate in User Stories

❌ No User Story without a parent Feature

❌ No artifact without governance references

Validation failures should:

Fail fast

Produce clear, actionable error messages

6.Output Model Expectations
Model the hierarchy in a way that is:

Deterministic
Serializable (YAML / JSON / Markdown)
Friendly to:

GitHub pull requests

Downstream AI agents
Test automation
Each artifact must include:

Stable unique IDs

Explicit parent/child relationships
Governance references
Human-readable titles and descriptions

7.Developer Experience Expectations
The resulting system should allow developers to:

Upload or modify governance documents
Re-run derivation safely (idempotent where possible)
Inspect Epics, Features, and User Stories independently
Understand why each artifact exists via governance linkage
Prefer clarity and correctness over cleverness.
Implementation Guidance (Non-Prescriptive)
You may:

Introduce internal DSLs or schemas
Add helper validation layers
Add tests that simulate malformed hierarchies
Extend existing governance parsing logic
Do not:

Hardcode “exactly five” features

Generate placeholder or speculative stories
Collapse governance concepts for convenience

Success Criteria
This implementation is complete when:

Any governance document can be traced → Epic → Feature(s) → User Story(ies)

All business value in the document is represented
The hierarchy resembles how real product teams work
Governance, validation, and delivery concerns are aligned
Proceed to design and implement this functionality.
If you want next steps, I can:

Convert this into a Muse prompt file

Create a YAML contract spec for Epics / Features / Stories

Write validation test cases

Generate a sample output from your demo governance document
