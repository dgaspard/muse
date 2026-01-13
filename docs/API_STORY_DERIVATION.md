# Story Derivation API Reference

## Endpoint

```json
POST /api/stories/derive-from-documents
```plaintext

Derives user stories from feature and governance markdown documents stored in MinIO.

## Request

### Headers

```json
Content-Type: application/json
```plaintext

### Body Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
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
```plaintext

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "storiesGenerated": 5,
  "stories": [
    {
      "story_id": "myproject-myproject-epic-01-feature-01-story-01-user-can-navigate-to-login",
      "title": "User can navigate to the login page",
      "role": "user",
      "capability": "User can navigate to the login page",
      "benefit": "Users need a secure way to log in to the system using their email and password credentials.",
      "derived_from_feature": "myproject-epic-01-feature-01",
      "derived_from_epic": "epic-4c989d68",
      "governance_references": [
        {
          "document_id": "a417e7cbf252089728b55a9aa0c119261285c79e6272c54a21c586bc3ac719ca",
          "filename": "governance.md",
          "markdown_path": "docs/governance/a417e7cbf2520897...e719ca.md",
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
```plaintext

### Error Responses

#### 400 Bad Request

Missing or invalid parameters:

```json
{
  "error": "featureDocumentId is required"
}
```plaintext

#### 500 Internal Server Error

Document not found or processing error:

```json
{
  "error": "Failed to derive stories",
  "message": "The specified key does not exist."
}
```plaintext

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
```plaintext

## Story Generation Rules

1. **One story per acceptance criterion** - Each criterion becomes a separate user story
2. **Maximum 5 stories per feature** - Prototype limitation
3. **INVEST compliance validation** - Stories are validated for Independent, Negotiable, Valuable, Estimable, Small, Testable
4. **Governance traceability** - Each story includes references to governance documents

## Story ID Format

Stories use the canonical pattern:

```xml
<project>-<feature_id>-story-<NN>-<short-capability-name>
```plaintext

Notes:

- `<project>` is the first segment in `feature_id`
- `NN` is a zero-padded incremental number starting at 01
- `<short-capability-name>` is a kebab-cased summary of the capability

Example:

```text
myproject-myproject-epic-01-feature-01-story-01-user-can-navigate-to-login
```plaintext

## How to Get Document IDs

### Option 1: Upload a new document

```bash
curl -X POST http://localhost:4000/uploads \
  -F "projectId=myproject" \
  -F "file=@feature.txt"
```plaintext

Returns:

```json
{
  "ok": true,
  "documentId": "9f4fb6b6ed8107b96aa12e5038da6a02...",
  "checksumSha256": "9f4fb6b6ed8107b96aa12e5038da6a02...",
  "metadata": { ... }
}
```plaintext

### Option 2: Query existing document metadata

```bash
curl http://localhost:4000/documents/{documentId}/metadata
```plaintext

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
```plaintext

## Testing

To validate story derivation locally:

- Use the workflow example above to upload documents and call the endpoint.
- Confirm the response contains `success: true` and `storiesGenerated` > 0.
- Inspect API logs via `docker compose logs -f api` for validation messages.

## Notes

- Document IDs are SHA-256 checksums of the file content
- The upload route accepts markdown or text files for prototype testing
- Stories are generated in-memory and returned by the API (no DB persistence in prototype)
- `epicId` can be provided in the request or inferred from the feature front matter (`epic_id`)
