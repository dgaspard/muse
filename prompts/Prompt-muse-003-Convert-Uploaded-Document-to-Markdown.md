# AI Implementation Prompt — MUSE-003: Convert Uploaded Document to Markdown

## Context

You are contributing to **Muse**, a governance-first AI platform that transforms uploaded policy and governance documents into structured, reviewable artifacts tracked in GitHub.

Muse treats the **original uploaded document as an immutable system of record** (see MUSE-002).  
All transformations must be *derived artifacts* and fully traceable back to the source document.

---

## User Story

**As a platform**,  
I want to convert uploaded governance documents into Markdown,  
So that they are diffable, reviewable, and version-controlled in GitHub.

---

## Preconditions

- A source document has already been persisted immutably
- A `document_id` exists and is authoritative
- The original document **must not** be modified

---

## Functional Requirements

### Markdown Generation

- Generate a Markdown (`.md`) representation of the uploaded document
- Preserve:
  - Headings and subheadings (mapped to `#`, `##`, `###`, etc.)
  - Section ordering
  - Paragraph boundaries
- Output must be **plain Markdown**
- No HTML output

### Traceability

- Generated Markdown must include:
  - `document_id`
  - checksum of the original document
  - generation timestamp
- Metadata must be included as **YAML front matter** at the top of the file

Example:

```yaml
---
document_id: doc-7f3a
source_checksum: sha256:9c82...
generated_at: 2026-01-10T19:05:00Z
derived_artifact: governance_markdown
---
```

### Determinism

- Same source document → same Markdown structure (given the same converter)
- No hallucinated sections
- No inferred or summarized policy meaning

## Non-Functional Requirements

- **Cloud-agnostic**: Converter must support at least:
  - PDF
  - DOCX
- **Pluggable architecture**: Must support multiple converter implementations
- **Git-diff friendly**: Markdown output must be cleanly diffable

## Implementation Tasks

### 1. Markdown Conversion Service

- Create a `DocumentToMarkdownConverter` interface
- Implement at least one concrete converter
  - Input: `document_id`
  - Output: Markdown file + metadata

### 2. Artifact Registration

- Register generated Markdown in the project manifest (`muse.yaml`)
- Ensure it references the correct `document_id`

### 3. Filesystem Output

- Write Markdown to `/docs/governance/<document_id>.md`

## Testing Requirements (MANDATORY)

### Unit Tests (Required)

Create unit tests that verify:

- Markdown file is generated
- Headings are preserved correctly
- Section order is unchanged
- YAML front matter exists and is valid
- Source `document_id` and checksum match the immutable original
- Converter fails gracefully for unsupported formats

**Test constraints:**

- Use fixture documents
- Avoid external APIs
- Tests must be deterministic

### Integration Test (Proposed)

Document or stub an integration test that:

- Uploads a document
- Persists it immutably (MUSE-002)
- Converts it to Markdown (MUSE-003)
- Verifies:
  - Traceability links
  - Markdown diffs cleanly in Git

## Documentation Output

Create a Markdown document at `/docs/governance/markdown-derivation.md`

This document must explain:

- Why Markdown is used
- What is preserved vs what is not preserved
- How reviewers should treat Markdown vs the original document

## Constraints

- Do not modify the original document
- Do not interpret, summarize, or infer meaning
- Do not introduce new headings or structure
- Do not remove legally significant sections

## Definition of Done

- Markdown is generated deterministically
- Headings and sections are preserved
- Unit tests pass
- Artifact is traceable to the source document
- Documentation is complete
