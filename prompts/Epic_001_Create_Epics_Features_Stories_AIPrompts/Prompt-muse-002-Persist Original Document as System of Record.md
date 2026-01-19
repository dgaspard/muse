# AI Implementation Prompt — MUSE-002: Persist Original Document as System of Record

## Context

You are contributing to **Muse**, a governance-first AI platform that transforms uploaded policy and governance documents into structured artifacts (Markdown, Epics, Features, User Stories, AI prompts, and GitHub PRs).

For auditability and compliance, Muse must treat the *original uploaded document* as the immutable **system of record**.

---

## User Story

**As a platform**,  
I want to store the original uploaded document unchanged,  
So that governance intent is preserved for audit and traceability.

---

## Functional Requirements

### Storage

- Persist the uploaded document **exactly as received** (byte-for-byte)
- Do **not** modify encoding, metadata, or file contents
- Store in an **append-only / immutable** manner (no overwrite, no mutation)

### Identity & Traceability

- Generate a **document_id** (UUID or content hash)
- Capture and persist:

  - original filename
  - MIME type
  - file size (bytes)
  - upload timestamp (UTC)
  - checksum (SHA-256 preferred)

- Ensure all downstream artifacts (Markdown, stories, prompts, PR metadata) reference this `document_id`

### Access

- Original document must be retrievable **read-only**
- Deletion or mutation must be prevented at the application layer

---

## Non-Functional Requirements

- Cloud-agnostic (works on local filesystem, S3-compatible storage, or Azure Blob)
- Deterministic behavior (same input → same checksum)
- Designed for audit, compliance, and legal discovery
- No parsing or transformation at this stage

---

## Implementation Tasks

1. **Storage Service**

   - Create a `DocumentStore` abstraction with methods:

     - `save_original(file_stream, metadata) -> document_id`
     - `get_original(document_id) -> file_stream + metadata`

   - Enforce immutability (fail if `document_id` already exists)

2. **Metadata Persistence**

   - Persist document metadata in a structured format (YAML or JSON)
   - Metadata must include checksum and storage URI

3. **Traceability Hook**

   - Ensure the returned `document_id` is:

     - injected into all derived artifacts
     - persisted in any project-level manifest (e.g. `muse.yaml` or `project.json`)

---

## Testing Requirements (MANDATORY)

### Unit Tests (Required)

Create unit tests that verify:

- File bytes written == file bytes read
- Checksum is correctly calculated and stored
- Attempting to overwrite an existing document fails
- Metadata is persisted and retrievable
- Storage adapter works with a mocked filesystem or in-memory store

### Integration Tests (Proposed)

Propose (and stub, if feasible) integration tests that:

- Upload a document → generate derived artifacts → confirm all artifacts reference the same `document_id`
- Restart the service → confirm original document remains accessible and unchanged
- Validate checksum consistency across service restarts

---

## Documentation Output

Create a Markdown file at: /docs/governance/original-document-system-of-record.md

The document must explain:

- Why the original document is immutable
- How traceability works across artifacts
- How auditors or reviewers can retrieve the source document

---

## Deliverables

- Storage service implementation
- Metadata schema
- Unit tests (passing)
- Integration test proposal (documented or stubbed)
- Governance documentation file

---

## Constraints

- Do not introduce business logic beyond storage and traceability
- Do not parse or interpret the document contents
- Prefer clarity and auditability over optimization

---

## Definition of Done

- Original document is stored immutably
- All future artifacts can be traced back to a single source document
- Tests demonstrate immutability, integrity, and traceability

## Test Plan — MUSE-002: Persist Original Document as System of Record

## Scope

- Validate immutability and fidelity of stored documents.
- Verify metadata accuracy and checksum determinism.
- Ensure traceability via document_id across artifacts.

## Unit Tests

1. **Round-trip bytes**

   - Save a sample file stream.
   - Read back and assert byte-for-byte equality with the original.

2. **Checksum calculation**

   - Compute SHA-256 on input fixture.
   - Assert stored checksum matches computed value.

3. **Immutability enforcement**

   - Attempt to save a document with an existing document_id.
   - Expect failure (exception/erroneous status), no overwrite occurs.

4. **Metadata persistence**

   - After save, retrieve metadata.
   - Assert presence and correctness of: document_id, filename, MIME type, size, upload timestamp, checksum, storage URI.

5. **Adapter independence**

   - Run save/get using a mocked filesystem or in-memory storage adapter.
   - Assert behaviors identical to default implementation.

## Integration Tests (Stubs/Proposed)

1. **Traceability through artifacts**

   - Upload a document to the pipeline.
   - Generate downstream artifacts (Markdown, stories, prompts, PR metadata).
   - Assert all artifacts reference the same document_id.

2. **Persistence across restarts**

   - Save a document.
   - Restart the service.
   - Retrieve original; assert bytes and checksum unchanged.

3. **Checksum consistency**

   - Recompute checksum after restart.
   - Assert equality with stored checksum and initial computation.

## Environmental Notes

- Tests should run against a mocked or in-memory store by default.
- For filesystem/S3-compatible adapters, gate with environment flags to avoid external dependencies during unit runs.
