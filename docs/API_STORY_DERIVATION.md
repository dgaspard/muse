# Story Derivation API Reference

## Endpoint

```
POST /api/stories/derive-from-documents
```

Derives user stories from feature and governance markdown documents stored in MinIO.

## Request

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `featureDocumentId` | string | Yes | Document ID of the feature markdown file in MinIO |
| `governanceDocumentId` | string | Yes | Document ID of the governance markdown file in MinIO |
| `projectId` | string | Yes | Project identifier (e.g., "myproject") |
| `epicId` | string | No | Epic identifier (e.g., "myproject-epic-01"). If not provided, extracted from feature front matter |

### Example Request

```bash
curl -X POST http://localhost:4000/api/stories/derive-from-documents \
  -H "Content-Type: application/json" \
  -d '{
    "featureDocumentId": "9f4fb6b6ed8107b96aa12e5038da6a02490c954a85e7a56d06d8fe0b8cfbdaf1",
    "governanceDocumentId": "a417e7cbf252089728b55a9aa0c119261285c79e6272c54a21c586bc3ac719ca",
    "projectId": "test-project",
    "epicId": "test-epic-01"
  }'
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "storiesGenerated": 5,
  "stories": [
    {
      "story_id": "test-test-project-test-epic-01-feature-01-story-01-user-can-navigate-to-the-login-page",
      "title": "User can navigate to the login page",
      "role": "user",
      "capability": "User can navigate to the login page",
      "benefit": "Users need a secure way to log in to the system using their email and password credentials.",
      "derived_from_feature": "test-project-test-epic-feature-01",
      "derived_from_epic": "test-epic-01",
      "governance_references": [
        {
          "document_id": "test-epic-01",
          "filename": "governance.md",
          "markdown_path": "governance.md",
          "sections": ["Requirements"]
        }
      ],
      "acceptance_criteria": [
        "User can navigate to the login page"
      ],
      "generated_at": "2026-01-11T12:34:56.789Z"
    }
    // ... more stories
  ]
}
```

### Error Responses

#### 400 Bad Request
Missing or invalid parameters:
```json
{
  "error": "featureDocumentId is required"
}
```

#### 500 Internal Server Error
Document not found or processing error:
```json
{
  "error": "Failed to derive stories",
  "message": "The specified key does not exist."
}
```

## Feature Markdown Format

Feature documents must follow this format:

```markdown
---
feature_id: myproject-myepic-feature-01
epic_id: myepic-01
---

# Feature: Feature Title

## Description
Detailed description of the feature and its business value.

## Acceptance Criteria
- First acceptance criterion
- Second acceptance criterion
- Third acceptance criterion
```

## Story Generation Rules

1. **One story per acceptance criterion** - Each criterion becomes a separate user story
2. **Maximum 5 stories per feature** - Prototype limitation
3. **INVEST compliance validation** - Stories are validated for Independent, Negotiable, Valuable, Estimable, Small, Testable
4. **Governance traceability** - Each story includes references to governance documents

## Story ID Format

Stories are named using the pattern:
```
<project>-<epic_id>-<feature_id>-story-<number>-<short-capability-name>
```

Example:
```
test-test-project-test-epic-01-feature-01-story-01-user-can-navigate-to-the-login-page
```

## How to Get Document IDs

### Option 1: Upload a new document
```bash
curl -X POST http://localhost:4000/uploads \
  -F "projectId=myproject" \
  -F "file=@feature.txt"
```

Returns:
```json
{
  "ok": true,
  "documentId": "9f4fb6b6ed8107b96aa12e5038da6a02...",
  "checksumSha256": "9f4fb6b6ed8107b96aa12e5038da6a02...",
  "metadata": { ... }
}
```

### Option 2: Query existing document metadata
```bash
curl http://localhost:4000/documents/{documentId}/metadata
```

## Complete Workflow Example

```bash
#!/bin/bash

# 1. Upload feature markdown
FEATURE_ID=$(curl -sf -X POST http://localhost:4000/uploads \
  -F "projectId=myproject" \
  -F "file=@feature.txt" | jq -r '.documentId')

# 2. Upload governance markdown
GOV_ID=$(curl -sf -X POST http://localhost:4000/uploads \
  -F "projectId=myproject" \
  -F "file=@governance.txt" | jq -r '.documentId')

# 3. Derive stories
curl -X POST http://localhost:4000/api/stories/derive-from-documents \
  -H "Content-Type: application/json" \
  -d "{
    \"featureDocumentId\": \"$FEATURE_ID\",
    \"governanceDocumentId\": \"$GOV_ID\",
    \"projectId\": \"myproject\",
    \"epicId\": \"myproject-epic-01\"
  }" | jq '.'
```

## Testing

Run the end-to-end test:
```bash
bash scripts/test_story_derivation.sh
```

This script:
1. Creates sample feature and governance markdown
2. Uploads them to MinIO
3. Calls the story derivation endpoint
4. Validates the generated stories

## Notes

- Document IDs are SHA-256 checksums of the file content
- Markdown files must use `.txt`, `.pdf`, or `.docx` extensions to upload
- Stories are generated in-memory and not persisted to database (prototype phase)
- Epic ID can be provided in request or extracted from feature front matter
