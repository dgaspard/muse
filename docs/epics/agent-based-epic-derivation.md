# Agent-Based Epic Derivation

## Purpose

This document explains why Epic derivation requires an AI agent, how bounded agents differ from creative AI, and how product owners should review agent-generated Epics.

---

## Why Epic Derivation Requires an Agent

Up to MUSE-005, Muse has operated as a **deterministic pipeline**:

- **MUSE-002** — Store original document (SHA-256 hash, immutable)
- **MUSE-003** — Convert to Markdown (deterministic extraction)
- **MUSE-004** — Commit to Git (deterministic commit message)

These steps transform data but do not interpret intent.

**MUSE-005 is the first interpretive step** because:

1. **Intent extraction requires reasoning**
   - A governance document describes requirements, policies, or objectives
   - Extracting the *high-level outcome* (Epic) requires understanding context and purpose
   - This cannot be achieved with regex or template-based extraction

2. **Abstraction requires judgment**
   - An Epic represents the "what" and "why", not the "how"
   - Multiple requirements may map to a single Epic objective
   - Success criteria must be measurable but not implementation-specific

3. **Language is ambiguous**
   - Governance documents use natural language
   - Same requirement might be phrased differently across documents
   - Agent must normalize and abstract intent consistently

---

## The Role of GovernanceIntentAgent

The **GovernanceIntentAgent** is a bounded AI agent with a single responsibility:

> **Extract exactly one Epic from a governance document**

### What the Agent Does

- ✅ Reads governance Markdown
- ✅ Extracts high-level objective
- ✅ Identifies measurable success criteria
- ✅ Outputs structured data conforming to a strict schema

### What the Agent Does NOT Do

- ❌ Does not brainstorm new features
- ❌ Does not create user stories
- ❌ Does not invent requirements
- ❌ Does not add implementation details
- ❌ Does not make up data

---

## Bounded Agents vs Creative AI

### Bounded Agent (GovernanceIntentAgent)

| Property | Value |
|----------|-------|
| **Temperature** | Low and fixed (deterministic) |
| **Input** | Governance Markdown only (read-only) |
| **Output** | Strict schema (validated) |
| **Validation** | Schema enforcement + retry on failure |
| **Purpose** | Extract intent, not create content |
| **Traceability** | Every output references source document |

### Creative AI (What This Is NOT)

| Property | Value |
|----------|-------|
| **Temperature** | High (exploratory) |
| **Input** | Open-ended prompts |
| **Output** | Free-form, no strict schema |
| **Validation** | None or minimal |
| **Purpose** | Generate new ideas or content |
| **Traceability** | Often unclear or fabricated |

**Key Difference**: A bounded agent operates within strict constraints and must justify all outputs with evidence from the source document.

---

## Output Schema and Validation

The agent MUST produce output conforming to this schema:

```yaml
epic:
  epic_id: string
  derived_from: string (document_id)
  source_markdown: string (path)
  objective: string (single paragraph)
  success_criteria:
    - string (measurable criterion)
    - string (measurable criterion)
```plaintext

### Validation Rules

1. **All fields are required**
   - Missing fields cause validation failure and retry

2. **No additional fields allowed**
   - Extra fields indicate hallucination or schema violation

3. **success_criteria must be non-empty array**
   - Minimum of 1 criterion
   - Each criterion must be a string

4. **Retry logic**
   - If validation fails, agent retries once
   - Second failure causes hard error (no silent correction)

---

## How Product Owners Should Review Epics

### What to Look For

#### 1. Traceability

- ✅ Epic references the correct `document_id`
- ✅ Epic includes path to source governance Markdown
- ✅ Epic objective matches intent expressed in source document

**Red Flags**:

- Epic references a document that doesn't exist
- Epic includes details not present in source
- Epic contradicts source document

#### 2. Abstraction Level

- ✅ Epic describes **outcomes**, not implementation
- ✅ Epic is high-level and executive-readable
- ✅ Success criteria are **measurable** but not technical

**Good Example**:

```markdown
## Objective
Enable traceable governance document processing through automated conversion and version control.

## Success Criteria
- All governance documents are stored immutably with unique identifiers
- Document changes are tracked in version control with approval workflows
- Audit trails demonstrate compliance with regulatory requirements
```plaintext

**Bad Example** (too implementation-specific):

```markdown
## Objective
Build a FastAPI service that converts PDFs using Pandoc.

## Success Criteria
- API endpoint `/convert` accepts multipart/form-data
- Uses Pandoc 2.18 or later
- Returns JSON with conversion status
```plaintext

#### 3. Completeness

- ✅ Objective is a single, clear paragraph
- ✅ Success criteria are specific and verifiable
- ✅ All criteria align with the objective

**Questions to Ask**:

- Can we measure whether these criteria are met?
- Are we missing critical success criteria from the source document?
- Is the objective broad enough to encompass all requirements?

### When to Reject an Epic

Reject the Epic if:

1. **Hallucination detected**
   - Epic includes requirements not in source document
   - Epic references non-existent systems or features

2. **Schema violation**
   - Missing required fields
   - Extra fields present
   - Invalid data types

3. **Misalignment with source**
   - Epic objective doesn't match document intent
   - Success criteria don't reflect document requirements

4. **Too specific or too vague**
   - Epic includes implementation details (too specific)
   - Epic is so abstract it provides no guidance (too vague)

### Approval Workflow

1. **Review Epic Markdown** in Pull Request
2. **Compare with source governance document**
   - Open source document in `docs/governance/`
   - Verify Epic accurately reflects intent

3. **Check muse.yaml traceability**
   - Ensure `artifacts.epics[]` includes correct metadata
   - Verify `derived_from` matches document

4. **Approve or request changes**
   - Use PR comments to suggest refinements
   - Agent can re-run derivation if needed

---

## Agent Workflow Implementation

### Execution Flow

```mermaid
graph TD
    A[Load Governance Markdown] --> B[Invoke GovernanceIntentAgent]
    B --> C[Validate Schema]
    C -->|Valid| D[Write Epic Markdown]
    C -->|Invalid| E{Retry?}
    E -->|First Failure| B
    E -->|Second Failure| F[Fail Hard]
    D --> G[Update muse.yaml]
    G --> H[Commit to Git]
    H --> I[Open Pull Request]
```plaintext

### Implementation Notes

- **Framework**: Can use LangGraph or similar for bounded agent workflows
- **Temperature**: Must be low and fixed (e.g., 0.1-0.2)
- **No external tools**: Agent only reads provided input files
- **Deterministic**: Same input should produce same output

---

## Testing Requirements

### Unit Tests (Required)

Tests MUST verify:

- ✅ Agent output conforms to schema
- ✅ Epic includes objective and at least one success criterion
- ✅ Epic references correct `document_id`
- ✅ Source Markdown path is correct
- ✅ `muse.yaml` is updated correctly
- ✅ Invalid or missing governance Markdown causes failure

### Integration Test (Proposed)

End-to-end test that:

1. Uploads a governance document (MUSE-002)
2. Converts to Markdown (MUSE-003)
3. Commits Markdown to Git (MUSE-004)
4. Runs agent workflow (MUSE-005)
5. Opens Pull Request
6. Verifies Epic content, traceability, and PR metadata

---

## Constraints and Limitations

### What the Agent Cannot Do

- **Cannot modify governance Markdown**
  - Source documents are read-only
  - Agent extracts intent, does not alter source

- **Cannot create Features or User Stories**
  - MUSE-005 only generates Epics
  - Features and stories come later (MUSE-006+)

- **Cannot introduce implementation details**
  - Agent must stay at Epic abstraction level
  - Technical decisions are made by engineers, not agents

- **Cannot bypass validation**
  - Schema violations cause hard failure
  - No silent correction or inference

### When to Re-Run Derivation

Re-run Epic derivation when:

1. **Source governance document is updated**
   - New version uploaded and committed
   - Intent or requirements have changed

2. **Epic is rejected in PR review**
   - Product owner identifies misalignment
   - Agent can retry with refined prompt (if needed)

3. **Schema or validation rules change**
   - Existing Epics may need regeneration
   - Document schema changes in CHANGELOG

---

## Examples

### Example 1: Document Upload Policy

**Source Governance Markdown** (`docs/governance/doc-upload-policy.md`):

```markdown
---
document_id: doc-7f3a5d2b
---

# Document Upload and Storage Policy

All governance documents must be uploaded through a secure interface and stored immutably.

## Requirements

- Documents must have unique identifiers
- Original files must be preserved without modification
- Metadata must include upload timestamp and user
- Documents must be retrievable by identifier
```plaintext

**Generated Epic** (`docs/epics/doc-7f3a5d2b-epic.md`):

```markdown
---
epic_id: epic-doc-7f3a
derived_from: doc-7f3a5d2b
source_markdown: docs/governance/doc-upload-policy.md
generated_at: 2026-01-11T10:15:00Z
---

# Epic: Secure Governance Document Upload and Storage

## Objective

Enable secure upload and immutable storage of governance documents with unique identifiers and comprehensive metadata for traceability and compliance.

## Success Criteria

- Documents have unique identifiers based on content hashing
- Original files are preserved without modification in object storage
- Metadata includes upload timestamp, user, and document properties
- Documents are retrievable by identifier through API or interface
```plaintext

### Example 2: Git Governance Workflow

**Source Governance Markdown** (`docs/governance/git-workflow.md`):

```markdown
---
document_id: doc-a1b2c3d4
---

# Git-Based Governance Workflow

Governance changes must follow the same review process as code changes.

## Workflow Requirements

- Governance Markdown is committed to Git
- Changes are reviewed through Pull Requests
- Approvals are tracked in Git history
- Audit trails are maintained through Git log
```plaintext

**Generated Epic** (`docs/epics/doc-a1b2c3d4-epic.md`):

```markdown
---
epic_id: epic-doc-a1b2
derived_from: doc-a1b2c3d4
source_markdown: docs/governance/git-workflow.md
generated_at: 2026-01-11T10:20:00Z
---

# Epic: Git-Based Governance Change Management

## Objective

Implement Git-based workflow for governance changes to enable transparent review, approval tracking, and audit compliance through version control.

## Success Criteria

- Governance Markdown files are committed to Git repository
- All changes require Pull Request review before merge
- Approvals are captured in Git commit history and metadata
- Audit trails demonstrate compliance through Git log analysis
```plaintext

---

## Future Enhancements

### Potential Improvements

1. **LLM Integration**
   - Replace rule-based extraction with actual LLM call
   - Use OpenAI, Anthropic Claude, or similar
   - Maintain low temperature for consistency

2. **Multi-Epic Support**
   - Some complex documents may map to multiple Epics
   - Agent could identify logical boundaries and split

3. **Stakeholder Identification**
   - Extract stakeholder roles from governance documents
   - Auto-assign CODEOWNERS for PR reviews

4. **Compliance Mapping**
   - Map success criteria to regulatory requirements
   - Auto-generate compliance matrix

5. **Change Impact Analysis**
   - When governance document changes, identify affected Epics
   - Trigger re-derivation workflow automatically

---

## Contact and Feedback

For questions or issues with Epic derivation:

1. **Review agent logs** for validation errors
2. **Check source governance document** for completeness
3. **Open GitHub issue** with:
   - Document ID
   - Expected vs actual Epic output
   - Validation error messages (if any)

This is a prototype feature — feedback is essential for refinement.
