# Uploads (prototype)

This document describes the minimal upload endpoint implemented for
PROMPT-MUSE-001 (MUSE-001).

POST /uploads
- Accepts multipart/form-data with fields: `projectId` (string), `file` (file)
- Allowed file types: .docx, .pdf, .txt
- Stores the file under `MINIO_BUCKET` (default: `muse-uploads`) as
  `{projectId}/{documentId}-{originalFilename}`
- Response: `200 { ok:true, documentId, objectName, location }`

Notes
- Prototype: no authentication or authorization is enforced.
- The endpoint writes uploads to a temp dir then streams them to MinIO
  to avoid buffering file contents in memory.
