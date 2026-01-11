# Original Document as System of Record

## Purpose

Muse treats the *original uploaded governance document* as the immutable **system of record**.
This ensures auditability, legal defensibility, and consistent traceability from downstream artifacts back to the exact bytes originally received.

## Why Immutability

- **Audit and compliance**: reviewers can confirm derived artifacts were generated from a known, unchanged source.
- **Legal discovery**: the original bytes can be produced without ambiguity about edits or normalization.
- **Reproducibility**: cryptographic hashes allow independent verification of integrity.

Muse enforces immutability at the application layer by refusing to overwrite an existing `documentId`.

## Identity and Integrity

- **documentId**: the SHA-256 checksum (hex) of the uploaded bytes.
- **checksumSha256**: stored alongside metadata for explicit integrity verification.

Because `documentId` is content-derived, identical uploads map to the same ID and are treated as already-present.

## Storage Model

Muse stores two objects (append-only):

- `original/{documentId}`: the raw uploaded bytes (no parsing or transformation)
- `metadata/{documentId}.json`: structured metadata (JSON)

When a `projectId` is provided on upload, Muse also writes a per-project pointer (append-only):

- `projects/{projectId}/documents/{documentId}.json`

This avoids mutable “single manifest” files while still enabling per-project traceability.

## Metadata Contents

The metadata document includes:

- `documentId`
- `checksumSha256`
- `originalFilename`
- `mimeType`
- `sizeBytes`
- `uploadedAtUtc`
- `storageUri`
- `originalObjectKey` and `metadataObjectKey`
- optional `projectId`

## Retrieval (Read-only)

The API exposes read-only access:

- `GET /documents/{documentId}` streams the original bytes
- `GET /documents/{documentId}/metadata` returns the persisted metadata

No delete or update endpoints are provided.

## Traceability Across Artifacts

Downstream artifacts (Markdown, stories, prompts, PR metadata) must carry and reference the same `documentId`.
In this prototype, the upload response returns `documentId` and full metadata so subsequent steps can persist and propagate it.

## Integration Test Proposal

- Upload document → generate artifacts → verify every artifact references the same `documentId`.
- Restart services → retrieve original → verify byte-for-byte equality and checksum consistency.
- Recompute SHA-256 independently → verify it matches `checksumSha256` and `documentId`.
