# Feature Generation API

## Overview

The Feature Generation API enables on-demand decomposition of an approved Epic into implementation-ready Features. This is typically triggered by a "Generate Features" button in the Epic detail UI.

## Endpoint

```
POST /api/epics/:epicId/generate-features
```

## Request Body

```json
{
  "epic": {
    "epic_id": "epic-47be9e5c-01",
    "title": "Document Management System",
    "objective": "Enable secure document processing with compliance audit trails",
    "success_criteria": [
      "Documents uploaded successfully",
      "Documents processed into metadata",
      "Audit trail maintained"
    ],
    "source_sections": ["sec-47be9e5c-01-abc", "sec-47be9e5c-01-def"]
  },
  "summaries": [
    {
      "section_id": "sec-47be9e5c-01-abc",
      "title": "File Upload Requirements",
      "obligations": [
        "System shall validate file types before storage",
        "System must reject files exceeding limits"
      ],
      "outcomes": [
        "Users can securely upload documents",
        "Invalid files are rejected with feedback"
      ],
      "actors": ["Document Uploader", "System Administrator"],
      "constraints": [
        "Maximum file size 100MB",
        "Supported formats: PDF, DOCX, TXT"
      ]
    },
    {
      "section_id": "sec-47be9e5c-01-def",
      "title": "Audit Requirements",
      "obligations": [
        "System shall maintain immutable audit logs",
        "System must record all access events"
      ],
      "outcomes": [
        "Complete audit trail available",
        "Access patterns can be analyzed"
      ],
      "actors": ["Compliance Officer", "Security Auditor"],
      "constraints": [
        "Audit logs retained for 7 years",
        "Tamper-evident storage required"
      ]
    }
  ]
}
```

## Response

### Success (200 OK)

```json
{
  "ok": true,
  "epic_id": "epic-47be9e5c-01",
  "feature_count": 3,
  "features": [
    {
      "feature_id": "epic-47be9e5c-01-feature-01",
      "epic_id": "epic-47be9e5c-01",
      "title": "Validate and Store Uploaded Files",
      "description": "System accepts and securely stores documents with format validation and size enforcement.",
      "acceptance_criteria": [
        "System validates file type against allowed list before storage",
        "System rejects files exceeding 100MB with clear error message",
        "Users receive confirmation when file is successfully stored"
      ],
      "governance_references": ["sec-47be9e5c-01-abc"]
    },
    {
      "feature_id": "epic-47be9e5c-01-feature-02",
      "epic_id": "epic-47be9e5c-01",
      "title": "Maintain Compliance Audit Trail",
      "description": "System records and retains all document access events in tamper-proof format for compliance verification.",
      "acceptance_criteria": [
        "All document access events recorded with timestamp and user identity",
        "Audit logs stored in tamper-evident format",
        "Compliance officers can retrieve audit trails for reporting"
      ],
      "governance_references": ["sec-47be9e5c-01-def"]
    },
    {
      "feature_id": "epic-47be9e5c-01-feature-03",
      "epic_id": "epic-47be9e5c-01",
      "title": "Extract Document Metadata",
      "description": "System processes uploaded documents to extract and index searchable metadata and content.",
      "acceptance_criteria": [
        "Metadata extracted from documents with >95% accuracy",
        "Processing completes within 5 minutes per document",
        "Extracted content indexed for discovery"
      ],
      "governance_references": ["sec-47be9e5c-01-abc", "sec-47be9e5c-01-def"]
    }
  ]
}
```

### Error (400 Bad Request)

```json
{
  "ok": false,
  "error": "epic object is required in request body"
}
```

### Error (500 Internal Server Error)

```json
{
  "ok": false,
  "error": "feature generation failed",
  "details": "Error message from agent"
}
```

## How It Works

### AI-Powered Path (When ANTHROPIC_API_KEY is set)

1. FeatureGenerationAgent sends the Epic and summaries to Claude Opus
2. Claude applies 5 hard constraints:
   - **Epic Alignment Is Mandatory** — Every feature directly supports epic objective
   - **Features Must Represent Capabilities, Not Sections** — System behavior, not governance structure
   - **Governance Is Context, Not Content** — References inform behavior, not copied
   - **Feature Count Discipline** — 3–7 features maximum
   - **Language and Quality Requirements** — Complete sentences, clear verbs, testable
3. Claude returns structured JSON with features
4. Features are validated and returned to client

### Rule-Based Fallback (When ANTHROPIC_API_KEY not set)

1. FeatureGenerationAgent groups governance summaries
2. Derives feature titles from obligations and outcomes
3. Generates acceptance criteria from observable outcomes
4. Includes governance section IDs as references
5. Ensures 3–7 features maximum constraint

## Hard Constraints Enforced

All features must pass these validation checks:

1. **Epic Alignment**: Each feature description explicitly supports epic.objective
2. **Capability-Oriented**: No "Introduction", "Overview", section titles, or citation lists
3. **No Governance Artifacts**: No governance text copied into descriptions or criteria
4. **Testable Criteria**: Each criterion describes observable, measurable behavior
5. **Valid Language**: Complete sentences using action verbs (create, validate, restrict, audit, etc.)

## Integration with Frontend

```typescript
// Example: React component calling feature generation
const generateFeatures = async (epic: Epic, summaries: SectionSummary[]) => {
  const response = await fetch(`/api/epics/${epic.epic_id}/generate-features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epic, summaries })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  
  const { features } = await response.json()
  return features // GeneratedFeature[]
}
```

## Testing the Endpoint

```bash
# With curl (example)
curl -X POST http://localhost:4000/api/epics/epic-test-01/generate-features \
  -H "Content-Type: application/json" \
  -d '{
    "epic": {
      "epic_id": "epic-test-01",
      "title": "Test Epic",
      "objective": "Test objective",
      "success_criteria": ["Criterion 1"],
      "source_sections": ["sec-001"]
    },
    "summaries": [...]
  }'
```

## Error Handling

The endpoint handles these error cases:

- **No epic**: Returns 400 with "epic object is required"
- **No summaries**: Returns 400 with "summaries array is required"
- **Epic ID mismatch**: Returns 400 with validation error
- **AI/fallback failure**: Returns 500 with error details

## Performance Notes

- **AI-powered path**: ~2-5 seconds per 3-5 summaries (depends on Claude latency)
- **Rule-based fallback**: <100ms per epic
- **Maximum features**: Capped at 7 per epic (constraint enforcement)
- **Token budget**: Falls back to rule-based if Claude API fails

## Example: Full Workflow

1. User views Epic "sec-47be9e5c-01" in UI
2. User clicks "Generate Features" button
3. Frontend fetches epic details and governance summaries from API
4. Frontend calls `POST /api/epics/:epicId/generate-features`
5. FeatureGenerationAgent uses Claude (AI path) or rules (fallback)
6. Features returned with titles, descriptions, acceptance criteria
7. UI displays features; user can edit or accept
8. Features stored as markdown artifacts in MinIO

## Future Enhancements

- [ ] User Stories automatically generated from feature acceptance criteria
- [ ] Feature estimation (story points) via Claude analysis
- [ ] Acceptance criteria validation against governance
- [ ] Feature dependency mapping
- [ ] Integration with ticketing system (Jira, Azure DevOps)
