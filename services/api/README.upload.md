# Uploads (prototype)

This document describes the minimal upload endpoint implemented for
PROMPT-MUSE-001 (MUSE-001).

POST /uploads

- Accepts multipart/form-data with fields: `projectId` (string), `file` (file)
- Allowed file types: .docx, .pdf, .txt
- Stores the original bytes under `MINIO_BUCKET` (default: `muse-uploads`) as
  `original/{documentId}`
- Persists metadata as JSON at `metadata/{documentId}.json`
- `documentId` is the SHA-256 checksum (hex) of the uploaded bytes
- Response: `200 { ok:true, documentId, checksumSha256, objectName, location, metadata }`

GET /documents/:documentId

- Streams back the original bytes (read-only)

GET /documents/:documentId/metadata

- Returns persisted metadata (read-only)

Notes

- Prototype: no authentication or authorization is enforced.
- The endpoint writes uploads to a temp dir then streams them to MinIO
  to avoid buffering file contents in memory.
