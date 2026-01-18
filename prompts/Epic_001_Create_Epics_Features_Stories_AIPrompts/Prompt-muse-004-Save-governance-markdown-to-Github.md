# AI Implementation Prompt — MUSE-004: Commit Governance Markdown to GitHub

## Context

You are contributing to **Muse**, a governance-first AI platform that treats policy artifacts with the same rigor as source code.

In Muse:

- The **original uploaded document** is immutable (MUSE-002)
- **Markdown governance artifacts** are derived, diffable representations (MUSE-003)
- GitHub is the system of collaboration, review, and approval

This user story operationalizes governance by ensuring derived Markdown artifacts are committed and traceable in Git history.

---

## User Story

**As a developer**,  
I want governance documentation committed to the repository as Markdown,  
So that policy changes are visible and reviewable like code.

---

## Preconditions

- A Markdown governance artifact exists
- The artifact is traceable to a `document_id`
- The repository is a valid Git repository with write access
- No uncommitted changes conflict with the governance artifact

---

## Functional Requirements

### Git Commit Behavior

- Commit generated Markdown files to:
/docs/governance/

markdown
Copy code

- One commit per governance artifact (no batching)
- Commits must be **non-interactive** and automation-safe

### Commit Message

- Commit message must reference:
- `document_id`
- originating filename
- Use a deterministic format:

docs(governance): add markdown derived from <document_id>

Source: <original_filename>

yaml
Copy code

### Traceability

- Commit must:
  - Include the Markdown file with YAML front matter intact
  - Be linked back to the immutable source document
- Update `muse.yaml` to record:
  - commit hash
  - artifact path
  - timestamp

Example `muse.yaml` update:

```yaml
artifacts:
  governance_markdown:
    path: docs/governance/doc-7f3a.md
    derived_from: doc-7f3a
    committed:
      commit_hash: abc123
      committed_at: 2026-01-10T19:30:00Z
Non-Functional Requirements
Git provider–agnostic (GitHub-compatible, but no GitHub-specific APIs)

Deterministic commits (same inputs → same commit diff)

Safe to run in CI/CD or headless environments

No force-push or history rewriting

Implementation Tasks
1. Git Commit Service
Create a GovernanceCommitService

Responsibilities:

Stage governance Markdown files

Create a commit with a deterministic message

Return commit hash

Fail gracefully if:

Git repo not found

Working tree is dirty with conflicting changes

2. Artifact Registration
Update muse.yaml with commit metadata

Ensure no mutation of existing artifact lineage

Testing Requirements (MANDATORY)
Unit Tests (Required)
Create unit tests that verify:

Markdown files are staged correctly

Commit message format is correct

Commit includes only the expected files

Commit references the correct document_id

muse.yaml is updated with commit metadata

Failure occurs if repository is not initialized

Test constraints:

Use a temporary or in-memory Git repository

Do not push to remote

Tests must be deterministic

Integration Test (Proposed)
Document or stub an integration test that:

Uploads a document

Persists it immutably (MUSE-002)

Converts it to Markdown (MUSE-003)

Commits the Markdown to Git (MUSE-004)

Verifies:

File exists in /docs/governance/

Commit hash is recorded

Git diff shows only governance changes

Documentation Output
Create a Markdown document at:

bash
Copy code
/docs/governance/git-governance-workflow.md
This document must explain:

Why governance artifacts are committed like code

How reviewers should review governance PRs

How commit history supports audit and compliance

Constraints
Do not modify the original source document

Do not rewrite Git history

Do not squash commits automatically

Do not commit unrelated files

Definition of Done
Governance Markdown is committed to Git

Commit message references the originating upload

Artifact lineage is preserved in muse.yaml

Unit tests pass

Documentation is complete

markdown
Copy code

If you want next, we can:
- Add **PR creation (MUSE-005)**  
- Introduce **CODEOWNERS + required reviewers for governance**  
- Wire commits into a **policy-change approval workflow**  
- Or design **rollback / superseded-policy semantics**

Just say the next story.
