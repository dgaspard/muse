# AI Prompt — PROMPT-MUSE-001

## Prompt Identity Header

```text
Prompt ID: PROMPT-MUSE-001
Associated Story ID: MUSE-001
Prompt Type: implementation
Target System: muse-web + muse-api
```plaintext

---

## Source Traceability

```markdown
### Source Documents
- contracts/user-story-format.md
- contracts/ai-prompt-format-spec.md

### Derived From
- User Story: MUSE-001 — Upload governance document via web UI
```plaintext

---

## Role and Perspective

You are acting as a **full-stack platform engineer** building a
prototype web application in a regulated environment.

---

## Problem Statement

Implement the initial user-facing capability that allows a
**policy owner** to upload a governance or compliance document
through a web interface and associate it with a project.

This capability establishes the entry point into the Muse
workflow and must be simple, explicit, and reliable.

---

## Regulatory and Policy Constraints

```markdown
### Constraints
- Do not modify or transform the uploaded document at this stage
- Do not perform downstream processing (no conversion, no AI analysis)
- Preserve the original file exactly as uploaded
- Associate each upload with a project identifier
```plaintext

---

## Instructions to the AI

```markdown
### Instructions
1. Implement a minimal web UI that allows a user to select and
   upload a file (DOCX, PDF, or TXT)
2. Require the user to select or provide a project identifier before upload
3. Send the file to the backend API using multipart/form-data
4. Implement a backend endpoint that accepts the upload and
   associates it with the project
5. Store the file using an existing object storage abstraction
   (do not inline file contents in memory beyond upload)
6. Return a clear success response confirming upload completion
7. Do not introduce authentication, authorization, or role
   enforcement (prototype mode)
8. Favor explicit, readable code over abstractions
```plaintext

---

## Inputs and Assumptions

```markdown
### Inputs
- File: DOCX, PDF, or TXT
- Project ID: string (provided by user or selected in UI)

### Assumptions
- A project already exists or a placeholder project ID is acceptable
- Object storage (e.g., S3-compatible) is already configured
```plaintext

---

## Expected Outputs

```markdown
### Output Expectations
- Web UI component that supports file selection and upload
- Backend API endpoint (POST) to receive uploads
- Clear JSON response confirming upload success
- Basic logging that includes project ID and document ID
```plaintext

---

## Safety and Guardrails

```markdown
### Guardrails
- Do not log file contents
- Do not log sensitive document data
- Do not modify tests to make failures pass
- Do not add speculative features beyond the user story
```plaintext

---

## Validation Checklist

```markdown
- [ ] User can upload a DOCX, PDF, or TXT file via the web UI
- [ ] Upload request includes a project identifier
- [ ] Backend successfully receives and stores the file
- [ ] User receives a clear confirmation of upload completion
- [ ] No downstream processing is triggered
```plaintext

---

## Regeneration Metadata

```json
{
  "prompt_id": "PROMPT-MUSE-001",
  "story_id": "MUSE-001",
  "version": "1.0",
  "regenerate_on": [
    "story_change",
    "ui_framework_change"
  ]
}
```plaintext

---

## Definition of a Successful Implementation

This prompt is successfully implemented when a policy owner can
upload a governance document, associate it with a project, and
receive confirmation — without requiring any additional Muse
capabilities to exist.

---

*This prompt intentionally scopes only the entry-point capability.
All analysis, conversion, and AI behavior is deferred to subsequent
stories.*
